import type { ActivityEvent } from '../activity-models'
import { canAutoGrade, gradeAnswer, type Question, type StudySession } from '../study-models'

export interface ValidatedScore {
  sessionId: string; uid: string; categoryId: string; mode: string; contentVersion: string
  score: number; maxScore: number; percent: number; correct: number; incorrect: number
  partial: number; skipped: number; review: number; provisional: boolean; validatedAt: number
  completedAt: number; questionResults: Record<string, { status: string; credit: number }>
}
export function recomputeScore(uid: string, session: StudySession, questions: Record<string, Question>, now: number): ValidatedScore {
  let score = 0, maxScore = 0, correct = 0, incorrect = 0, partial = 0, skipped = 0, review = 0
  const questionResults: ValidatedScore['questionResults'] = {}
  for (const id of session.questionIds) {
    const q = questions[id]
    const answer = session.answers?.[id]
    if (!q || !canAutoGrade(q)) { review++; questionResults[id] = { status: 'review-required', credit: 0 }; continue }
    if (session.mode === 'flashcard') { questionResults[id] = { status: 'self-assessed', credit: 0 }; continue }
    if (!answer || answer.status === 'skipped' || (typeof answer.value === 'string' ? !answer.value.trim() : !answer.value?.some(Boolean))) {
      maxScore++; skipped++; questionResults[id] = { status: 'skipped', credit: 0 }; continue
    }
    // Student-supplied credit, status and score are deliberately ignored.
    const result = gradeAnswer(q, answer.value)
    if (result.status === 'review-required') review++
    else { maxScore++; score += result.credit }
    if (result.status === 'correct') correct++
    if (result.status === 'incorrect') incorrect++
    if (result.status === 'partial') partial++
    questionResults[id] = { status: result.status, credit: result.credit }
  }
  return { sessionId: session.id, uid, categoryId: session.categoryId, mode: session.mode,
    contentVersion: session.contentVersion ?? 'legacy', score, maxScore,
    percent: maxScore ? Math.round(score / maxScore * 100) : 0,
    correct, incorrect, partial, skipped, review, provisional: review > 0 || !session.contentVersion,
    validatedAt: now, completedAt: session.completedAt ?? session.updatedAt, questionResults }
}

export interface Totals { logins: number; starts: number; completions: number; categoryOpens: number; views: number; durationMs: number; scoreSum: number; gradedSessions: number; flashcards: number }
export const emptyTotals = (): Totals => ({ logins: 0, starts: 0, completions: 0, categoryOpens: 0, views: 0, durationMs: 0, scoreSum: 0, gradedSessions: 0, flashcards: 0 })
export interface DailyBucket {
  processed: Record<string, true>; totals: Totals
  users: Record<string, Totals & { lastActive: number; lastLogin?: number }>
  categories: Record<string, Totals>
  questions: Record<string, Record<string, { correct: number; incorrect: number; skipped: number; review: number }>>
  updatedAt: number
}
export function applyEvent(bucket: DailyBucket | null, key: string, event: ActivityEvent, score?: ValidatedScore): DailyBucket {
  const b = bucket ?? { processed: {}, totals: emptyTotals(), users: {}, categories: {}, questions: {}, updatedAt: 0 }
  b.processed ??= {}; b.users ??= {}; b.categories ??= {}; b.questions ??= {}
  if (b.processed[key]) return b
  b.processed[key] = true
  const user = b.users[event.uid] ??= { ...emptyTotals(), lastActive: 0 }
  user.lastActive = Math.max(user.lastActive, event.occurredAt)
  if (event.type === 'auth_login') user.lastLogin = Math.max(user.lastLogin ?? 0, event.occurredAt)
  const groups = [b.totals, user]
  if (event.categoryId) groups.push(b.categories[event.categoryId] ??= emptyTotals())
  for (const group of groups) {
    if (event.type === 'auth_login') group.logins++
    if (event.type === 'session_started') group.starts++
    if (event.type === 'category_opened') group.categoryOpens++
    if (event.type === 'question_viewed') group.views++
    if (event.type === 'reading_summary') group.durationMs += event.durationMs ?? 0
    if (event.type === 'flashcard_reviewed') group.flashcards++
    if (event.type === 'session_completed') {
      group.completions++
      if (score && score.mode !== 'flashcard' && score.maxScore > 0) { group.scoreSum += score.percent; group.gradedSessions++ }
    }
  }
  if (score && event.type === 'session_completed') {
    const category = b.questions[score.categoryId] ??= {}
    for (const [id, result] of Object.entries(score.questionResults)) {
      const counts = category[id] ??= { correct: 0, incorrect: 0, skipped: 0, review: 0 }
      if (result.status === 'correct') counts.correct++
      if (['incorrect', 'partial'].includes(result.status)) counts.incorrect++
      if (result.status === 'skipped') counts.skipped++
      if (result.status === 'review-required') counts.review++
    }
  }
  b.updatedAt = Math.max(b.updatedAt, event.occurredAt)
  return b
}
export const dayKey = (timestamp: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(timestamp))
