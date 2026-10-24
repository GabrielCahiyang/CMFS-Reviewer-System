import 'server-only'
import type { DecodedIdToken } from 'firebase-admin/auth'
import { adminServices, HttpError } from './firebase-admin'
import { validateEvent, type ActivityEvent } from '../activity-models'
import { applyEvent, dayKey, recomputeScore, type ValidatedScore } from './analytics'
import { parseQuestions } from '../question-schema'
import { questionsForSession } from '../question-presentation'
import type { StudySession } from '../study-models'

export async function ingestEvent(token: DecodedIdToken, body: unknown) {
  let input
  try { input = validateEvent(body) } catch (e) { throw new HttpError(400, (e as Error).message) }
  // Only a trusted custom claim can identify disposable test accounts. Keep their
  // browser verification traffic out of real learner activity and aggregates.
  if (token.cfmsTest === true) return { accepted: true, eventId: input.eventId }
  const { database, auth } = adminServices()
  const base = database.ref('cfms')
  const now = Date.now()
  // Distributed per-account rate limit; no IP addresses or tokens stored.
  const rate = await base.child(`admin/rateLimits/${token.uid}`).transaction((value) => {
    if (!value || now - value.since >= 60000) return { since: now, count: 1 }
    if (value.count >= 120) return
    return { since: value.since, count: value.count + 1 }
  })
  if (!rate.committed) throw new HttpError(429, 'Too many activity events. Try again shortly.')
  let session: StudySession | undefined
  if (input.sessionId) {
    session = (await base.child(`users/${token.uid}/sessions/${input.sessionId}`).get()).val()
    if (!session || session.categoryId !== input.categoryId || (input.questionId && !session.questionIds.includes(input.questionId)))
      throw new HttpError(403, 'This activity does not belong to your session.')
    if (input.type === 'session_completed' && session.status !== 'completed') throw new HttpError(409, 'The session is not completed.')
    if (input.type === 'answer_submitted' && !session.answers?.[input.questionId!]) throw new HttpError(409, 'Save the answer first.')
  }
  const category = input.categoryId ? (await base.child(`categories/${input.categoryId}`).get()).val() : null
  if (input.categoryId && !category) throw new HttpError(404, 'Reviewer not found.')
  if (input.questionId) {
    const questionPath = session?.contentVersion
      ? `questionBankVersions/${input.categoryId}/${session.contentVersion}/questions/${input.questionId}`
      : `questions/${input.categoryId}/${input.questionId}`
    if (!(await base.child(questionPath).get()).exists()) throw new HttpError(404, 'Question not found.')
  }
  if (['auth_login','auth_register'].includes(input.type) && now / 1000 - token.auth_time > 300)
    throw new HttpError(400, 'Only a recent interactive sign-in can be logged.')
  const key = input.type === 'session_completed' || input.type === 'session_started'
    ? `${token.uid}_${input.type}_${input.sessionId}`
    : input.type === 'auth_register' ? `${token.uid}_auth_register`
    : input.type === 'auth_login' ? `${token.uid}_auth_login_${token.auth_time}`
    : `${token.uid}_${input.eventId}`
  const event: ActivityEvent = { ...input, uid: token.uid, occurredAt: now, source: 'web',
    ...(session ? { mode: session.mode } : {}),
    ...(input.type === 'auth_login' ? { authMethod: token.firebase.sign_in_provider } : {}) }
  const saved = await base.child(`activityEvents/${key}`).transaction((existing) => existing ?? event)
  const canonical = saved.snapshot.val() as ActivityEvent
  if (canonical.type !== input.type || canonical.categoryId !== input.categoryId || canonical.sessionId !== input.sessionId || canonical.questionId !== input.questionId)
    throw new HttpError(409, 'This event identifier was already used for different activity.')
  let validated: ValidatedScore | undefined
  if (input.type === 'session_completed' && session) {
    const path = session.contentVersion
      ? `questionBankVersions/${session.categoryId}/${session.contentVersion}/questions`
      : `questions/${session.categoryId}`
    const bank = (await base.child(path).get()).val()
    if (!bank) throw new HttpError(409, 'The question version is unavailable for scoring.')
    const questions = questionsForSession(parseQuestions(bank, session.categoryId), session)
    const score = recomputeScore(token.uid, session, Object.fromEntries(questions.map((q) => [q.id, q])), now)
    const result = await base.child(`analytics/scores/${token.uid}/${session.id}`).transaction((old) => old ?? score)
    validated = result.snapshot.val()
  }
  await base.child(`analytics/daily/${dayKey(canonical.occurredAt)}`).transaction((bucket) => applyEvent(bucket, key, canonical, validated))
  // Firebase Auth, rather than submitted profile fields, supplies the directory identity.
  if (input.type === 'auth_register' || input.type === 'auth_login') {
    const account = await auth.getUser(token.uid)
    await base.child(`admin/userDirectory/${token.uid}`).update({
      uid: token.uid, displayName: account.displayName ?? 'Student', email: account.email ?? '',
      createdAt: Date.parse(account.metadata.creationTime), lastLogin: now,
    })
  }
  return { accepted: true, eventId: canonical.eventId }
}
