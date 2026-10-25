import type { Category, Question } from './study-models'

export const safeId = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value)

/** Validate the catalog's shape without tying visibility to compiled-in titles. */
export function parseCategories(value: unknown): Category[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []
  return Object.entries(value).flatMap(([id, raw]) => {
    if (!safeId(id) || !raw || typeof raw !== 'object' || Array.isArray(raw)) return []
    const category = raw as Category
    if (typeof category.title !== 'string' || !category.title.trim() ||
      typeof category.description !== 'string' || typeof category.sourceDocument !== 'string' ||
      typeof category.icon !== 'string' || typeof category.color !== 'string' ||
      !Number.isInteger(category.questionCount) || category.questionCount < 0 ||
      !Array.isArray(category.types) || !category.types.length ||
      !category.types.every(type => ['multiple-choice', 'true-false', 'identification', 'enumeration'].includes(type)) ||
      !Array.isArray(category.enabledModes) || !category.enabledModes.length ||
      !category.enabledModes.every(mode => ['practice', 'exam', 'flashcard', 'mixed'].includes(mode))) return []
    return [{ ...category, id }]
  })
}

export function stringList(value: unknown): string[] {
  const values = Array.isArray(value) ? value : value && typeof value === 'object' ? Object.values(value) : []
  return values.filter((item): item is string => typeof item === 'string')
}

export function parseQuestions(value: unknown, categoryId: string): Question[] {
  if (!safeId(categoryId)) throw new Error('Invalid reviewer identifier.')
  if (value == null) return []
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('This question bank has an invalid format.')
  return Object.entries(value).map(([id, raw]) => {
    const q = raw as Question
    if (!safeId(id) || !q || typeof q.question !== 'string' || !q.question.trim() ||
      typeof q.originalNumber !== 'string' || typeof q.sourceDocument !== 'string' ||
      !['multiple-choice', 'true-false', 'identification', 'enumeration'].includes(q.type) ||
      !['verified', 'review-required'].includes(q.verificationStatus))
      throw new Error(`Question ${id} needs a content review before this reviewer can load.`)
    const choices = stringList(q.choices)
    const correctAnswer = typeof q.correctAnswer === 'string' ? q.correctAnswer : stringList(q.correctAnswer)
    if (q.verificationStatus === 'verified' &&
      ((typeof correctAnswer === 'string' ? !correctAnswer.trim() : !correctAnswer.length) ||
      (['multiple-choice', 'true-false'].includes(q.type) &&
        (typeof correctAnswer !== 'string' || choices.filter((c) => c === correctAnswer).length !== 1))))
      throw new Error(`Question ${id} has an unresolved answer key.`)
    return { ...q, id, categoryId, correctAnswer, ...(choices.length ? { choices } : {}),
      acceptedAnswers: stringList(q.acceptedAnswers) }
  // IDs encode document sequence. Printed defects such as "10-102" and "1117"
  // remain visible without moving those questions to the wrong part of a session.
  }).sort((a,b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
}
