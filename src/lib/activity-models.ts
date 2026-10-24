export const eventTypes = ['auth_login', 'auth_register', 'auth_logout', 'category_opened',
  'question_viewed', 'reading_summary', 'session_started', 'session_resumed', 'answer_submitted',
  'flashcard_reviewed', 'session_completed', 'bookmark_changed'] as const
export type EventType = typeof eventTypes[number]
export interface EventInput {
  eventId: string
  type: EventType
  categoryId?: string
  questionId?: string
  sessionId?: string
  durationMs?: number
  action?: 'added' | 'removed' | 'known' | 'again'
}
export interface ActivityEvent extends EventInput {
  uid: string
  occurredAt: number
  source: 'web'
  mode?: string
  authMethod?: string
}
export function validateEvent(value: unknown): EventInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an event object.')
  const input = value as Record<string, unknown>
  const allowed = ['eventId', 'type', 'categoryId', 'questionId', 'sessionId', 'durationMs', 'action']
  if (Object.keys(input).some((k) => !allowed.includes(k))) throw new Error('Unexpected event field.')
  if (typeof input.eventId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(input.eventId) ||
    !eventTypes.includes(input.type as EventType)) throw new Error('Invalid event identifier or type.')
  for (const field of ['categoryId', 'questionId', 'sessionId'])
    if (input[field] !== undefined && (typeof input[field] !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(input[field] as string)))
      throw new Error(`Invalid ${field}.`)
  if (!String(input.type).startsWith('auth_') && !input.categoryId) throw new Error('Reviewer is required.')
  if (['question_viewed','reading_summary','answer_submitted','flashcard_reviewed','bookmark_changed'].includes(String(input.type)) && !input.questionId)
    throw new Error('Question is required.')
  if (['session_started','session_resumed','session_completed','answer_submitted','flashcard_reviewed','question_viewed','reading_summary'].includes(String(input.type)) && !input.sessionId)
    throw new Error('Session is required.')
  if (input.type === 'reading_summary' && (typeof input.durationMs !== 'number' || !Number.isFinite(input.durationMs) || input.durationMs < 0 || input.durationMs > 300000))
    throw new Error('Reading duration must be between zero and five minutes.')
  if (input.durationMs !== undefined && input.type !== 'reading_summary') throw new Error('Unexpected duration.')
  if (input.action !== undefined && !['added','removed','known','again'].includes(String(input.action))) throw new Error('Invalid action.')
  return input as unknown as EventInput
}
