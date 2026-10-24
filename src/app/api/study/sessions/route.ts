import { adminServices, apiError, authenticate, HttpError } from '@/lib/server/firebase-admin'
import { validateSessionInput, prepareSession } from '@/lib/session-validation'
import { parseQuestions } from '@/lib/question-schema'
import type { StudySession } from '@/lib/study-models'
export const runtime = 'nodejs'
export async function POST(request: Request) {
  try {
    const token = await authenticate(request)
    const text = await request.text()
    if (text.length > 2000000) throw new HttpError(413,'Session is too large.')
    let input
    try { input = validateSessionInput(JSON.parse(text)) } catch (error) { throw new HttpError(400,(error as Error).message) }
    const { database } = adminServices()
    const path = input.contentVersion ? `questionBankVersions/${input.categoryId}/${input.contentVersion}/questions` : `questions/${input.categoryId}`
    const bank = parseQuestions((await database.ref(`cfms/${path}`).get()).val(),input.categoryId)
    const questions = Object.fromEntries(bank.map((q) => [q.id,q]))
    const sessionRef = database.ref(`cfms/users/${token.uid}/sessions/${input.id}`)
    let failure = ''
    const now = Date.now()
    // Keep a value listener until the transaction finishes. Without an active listener,
    // RTDB can discard its cache and initially call the updater with null on a resume.
    const keepCache = () => {}
    sessionRef.on('value',keepCache)
    let saved
    try {
      await sessionRef.once('value')
      saved = await sessionRef.transaction((current: StudySession | null) => {
        try { return prepareSession(input,current,questions,now) }
        catch (error) { failure = (error as Error).message; return }
      }, undefined, false)
    } finally { sessionRef.off('value',keepCache) }
    if (!saved.committed) throw new HttpError(409,failure || 'The session could not be saved. Reload and retry.')
    return Response.json({ session:saved.snapshot.val() },{ headers:{ 'Cache-Control':'no-store' } })
  } catch (error) { return apiError(error) }
}
