import { normalize, type Question, type QuestionFormat, type QuestionType, type StudySession } from './study-models'

export const answerFormats: Array<{ id: QuestionFormat; label: string }> = [
  { id: 'original', label: 'Original format' },
  { id: 'multiple-choice', label: 'Multiple choice' },
  { id: 'true-false', label: 'True or false' },
  { id: 'identification', label: 'Identification' },
  { id: 'enumeration', label: 'Enumeration' },
  { id: 'mixed', label: 'Mix all formats' },
]
export const presentationTypes: QuestionType[] = ['multiple-choice', 'true-false', 'identification', 'enumeration']
const seedNumber = (value: string) => {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619)
  return hash >>> 0
}
const answerText = (q: Question) => Array.isArray(q.correctAnswer) ? q.correctAnswer.join(' · ') : q.correctAnswer
function ordered<T>(items: T[], seed: string): T[] {
  return items.map((value, index) => ({ value, order: seedNumber(`${seed}:${index}`) }))
    .sort((a, b) => a.order - b.order).map(({ value }) => value)
}

/** The same pure adapter runs in the browser, session validation and trusted scoring. */
export function presentQuestion(source: Question, format: QuestionFormat, bank: Question[], sessionId: string): Question {
  if (format === 'original') return source
  const seed = `${sessionId}:${source.id}:presentation-v1`
  const type = format === 'mixed' ? presentationTypes[seedNumber(seed) % presentationTypes.length] : format
  if (type === source.type) return source
  const answer = answerText(source)
  const accepted = new Set([answer, ...(Array.isArray(source.correctAnswer) ? source.correctAnswer : []), ...(source.acceptedAnswers ?? [])].map(normalize))
  // Keep the official key and uncertainty status; adapters never manufacture a new official key.
  const sortedBank = bank.filter(q => q.id !== source.id).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  const candidates = [...(source.choices ?? []), ...ordered(sortedBank, seed).map(answerText)]
    .filter(value => value.trim() && !accepted.has(normalize(value)))
  const distractors = [...new Map(candidates.map(value => [normalize(value), value])).values()].slice(0, 3)
  const base: Question = { ...source, adaptedFromType: source.type, type, choices: undefined, proposedAnswer: undefined,
    correctAnswer: answer, alternatives: undefined, orderMatters: false }
  if (type === 'multiple-choice') {
    // A two-choice source still yields a valid MCQ; a real bank supplies additional alternatives.
    return { ...base, choices: ordered([answer, ...distractors], seed + ':choices') }
  }
  if (type === 'true-false') {
    const useCorrect = !distractors.length || seedNumber(seed + ':truth') % 2 === 0
    return { ...base, choices: ['True', 'False'], proposedAnswer: useCorrect ? answer : distractors[0],
      correctAnswer: useCorrect ? 'True' : 'False', acceptedAnswers: [] }
  }
  if (type === 'enumeration') {
    return { ...base, correctAnswer: Array.isArray(source.correctAnswer) ? source.correctAnswer : [source.correctAnswer],
      alternatives: source.type === 'enumeration' ? source.alternatives : undefined }
  }
  return base
}

export function questionsForSession(bank: Question[], session: Pick<StudySession, 'id' | 'settings'>): Question[] {
  const format = session.settings.questionFormat ?? 'original'
  return bank.map(q => presentQuestion(q, format, bank, session.id))
}

export function selectedQuestions(eligible: Question[], selectedIds: ReadonlySet<string>) {
  return eligible.filter(q => selectedIds.has(q.id))
}
