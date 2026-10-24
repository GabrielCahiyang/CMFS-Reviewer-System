export type QuestionType = 'multiple-choice' | 'true-false' | 'identification' | 'enumeration'
export type StudyMode = 'practice' | 'exam' | 'flashcard' | 'mixed'
export type QuestionFormat = 'original' | 'mixed' | QuestionType
export type AnswerStatus =
  | 'pending'
  | 'correct'
  | 'incorrect'
  | 'partial'
  | 'skipped'
  | 'review-required'

export interface Category {
  id: string
  title: string
  description: string
  sourceDocument: string
  icon: string
  color: string
  questionCount: number
  expectedCount?: number
  types: QuestionType[]
  enabledModes: StudyMode[]
  contentVersion?: string
}

export interface Question {
  id: string
  categoryId: string
  originalNumber: string
  question: string
  type: QuestionType
  choices?: string[]
  correctAnswer: string | string[]
  acceptedAnswers?: string[]
  alternatives?: Record<string, string[]>
  orderMatters?: boolean
  explanation?: string
  topic: string
  formula?: string
  sourceDocument: string
  sourcePage?: string
  verificationStatus: 'verified' | 'review-required'
  derived?: boolean
  originalAnswerLetter?: string
  contentVersion?: string
  importId?: string
  reviewedBy?: string
  answerOrigin?: 'source-key' | 'source-highlight' | 'source-explanation' | 'generated'
  sourceAnswer?: string
  reviewNote?: string
  proposedAnswer?: string
  adaptedFromType?: QuestionType
}

export interface SessionSettings {
  questionFormat?: QuestionFormat
  mode: StudyMode
  types: QuestionType[]
  count: number
  randomize: boolean
  shuffleChoices: boolean
  instantFeedback: boolean
  showExplanations: boolean
  timer: boolean
  durationMinutes: number
  filter: 'all' | 'unanswered' | 'bookmarked' | 'incorrect'
}

export interface Answer {
  value: string | string[]
  status: AnswerStatus
  credit: number
  graded: boolean
}

export interface StudySession {
  id: string
  categoryId: string
  mode: StudyMode
  settings: SessionSettings
  questionIds: string[]
  currentQuestionIndex: number
  answers: Record<string, Answer>
  choiceOrder?: Record<string, string[]>
  status: 'in-progress' | 'completed'
  startedAt: number
  updatedAt: number
  completedAt?: number
  revision: number
  score?: number
  contentVersion?: string
}

export interface Preferences {
  theme: 'light' | 'dark'
  defaultStudyMode: StudyMode
  instantFeedback: boolean
  showExplanations: boolean
}

export interface UserData {
  profile?: { displayName: string; email: string; createdAt: number; updatedAt: number }
  sessions: Record<string, StudySession>
  bookmarks: Record<string, Record<string, boolean>>
  flashcardProgress: Record<
    string,
    Record<string, { status: 'known' | 'again'; lastReviewedAt: number }>
  >
  preferences: Preferences
}

export const defaultPreferences: Preferences = {
  theme: 'light',
  defaultStudyMode: 'practice',
  instantFeedback: true,
  showExplanations: true,
}

export const defaultSettings: SessionSettings = {
  mode: 'practice',
  types: ['multiple-choice', 'true-false', 'identification', 'enumeration'],
  count: 10,
  randomize: false,
  shuffleChoices: false,
  instantFeedback: true,
  showExplanations: true,
  timer: false,
  durationMinutes: 20,
  filter: 'all',
}

export const emptyUserData = (): UserData => ({
  sessions: {},
  bookmarks: {},
  flashcardProgress: {},
  preferences: { ...defaultPreferences },
})

export const typeLabels: Record<QuestionType, string> = {
  'multiple-choice': 'Multiple choice',
  'true-false': 'True or false',
  identification: 'Identification',
  enumeration: 'Enumeration',
}

export const modeLabels: Record<StudyMode, string> = {
  practice: 'Practice',
  exam: 'Exam',
  flashcard: 'Flashcards',
  mixed: 'Mixed study',
}

export const normalize = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase()
    .replace(/[.,;:!?]/g, '')
    .replace(/\s+/g, ' ')

const statementNames: Record<string, string> = {
  'statement of financial position': 'balance sheet',
  'cash flow statement': 'statement of cash flows',
  'cash flows statement': 'statement of cash flows',
  'statement of cash flow': 'statement of cash flows',
  'profit and loss statement': 'income statement',
  'statement of profit and loss': 'income statement',
  'statement of operations': 'income statement',
}
export function normalizeAnswer(value: string) {
  const normalized = normalize(value)
  return statementNames[normalized] ?? normalized
}

/** Content-review metadata does not disable an otherwise usable answer key. */
export function canAutoGrade(question: Question) {
  const answers = Array.isArray(question.correctAnswer) ? question.correctAnswer : [question.correctAnswer]
  if (!answers.length || answers.some(answer => typeof answer !== 'string' || !answer.trim())) return false
  if (question.type === 'multiple-choice' || question.type === 'true-false') {
    return !!question.choices?.length && answers.every(answer =>
      question.choices!.filter(choice => normalize(choice) === normalize(answer)).length === 1)
  }
  return question.type === 'identification' || question.type === 'enumeration'
}

export function studyExplanation(question: Question) {
  if (question.answerOrigin === 'generated' && question.derived &&
    /^(Generated study question based on|Additional study question based on)/.test(question.explanation ?? '')) {
    return question.sourcePage && question.sourcePage !== 'Not applicable'
      ? `Based on the supplied reviewer, page ${question.sourcePage}.`
      : 'Based on the supplied reviewer.'
  }
  return question.explanation
}

export function enumerationMatches(question: Question, value: string | string[]) {
  const expected = Array.isArray(question.correctAnswer)
    ? question.correctAnswer
    : [question.correctAnswer]
  const responses = (Array.isArray(value) ? value : [value]).map(normalizeAnswer).filter(Boolean)
  const used = new Set<number>()
  const matches = expected.map((answer, index) => {
    const accepted = [answer, ...(question.alternatives?.[answer] ?? [])].map(normalizeAnswer)
    const matchIndex = question.orderMatters
      ? accepted.includes(responses[index])
        ? index
        : -1
      : responses.findIndex((response, i) => !used.has(i) && accepted.includes(response))
    if (matchIndex >= 0) used.add(matchIndex)
    return { expected: answer, matched: matchIndex >= 0 }
  })
  return {
    matches,
    extra: responses.filter((_, i) => !used.has(i)),
    responseCount: responses.length,
  }
}

export function gradeAnswer(question: Question, value: string | string[]): Answer {
  if (!canAutoGrade(question)) {
    return { value, status: 'review-required', credit: 0, graded: true }
  }
  const expected = Array.isArray(question.correctAnswer)
    ? question.correctAnswer
    : [question.correctAnswer]
  if (question.type === 'enumeration') {
    const result = enumerationMatches(question, value)
    const credit =
      result.matches.filter((match) => match.matched).length /
      Math.max(expected.length, result.responseCount, 1)
    return {
      value,
      credit,
      status:
        credit === 1
          ? 'correct'
          : credit > 0
            ? 'partial'
            : 'incorrect',
      graded: true,
    }
  }
  const accepted = [...expected, ...(question.acceptedAnswers ?? [])].map(normalizeAnswer)
  const correct = accepted.includes(normalizeAnswer(Array.isArray(value) ? value.join(' ') : value))
  return {
    value,
    credit: correct ? 1 : 0,
    status: correct ? 'correct' : 'incorrect',
    graded: true,
  }
}

export function sessionStats(session: StudySession) {
  const answers = Object.values(session.answers ?? {})
  const correct = answers.filter((a) => a.status === 'correct').length
  const incorrect = answers.filter((a) => a.status === 'incorrect').length
  const partial = answers.filter((a) => a.status === 'partial').length
  const review = answers.filter((a) => a.status === 'review-required').length
  const skipped = session.questionIds.length - answers.filter((a) => a.status !== 'skipped').length
  const score = answers.reduce((total, answer) => total + answer.credit, 0)
  return {
    correct,
    incorrect,
    partial,
    review,
    skipped,
    score,
    percent: Math.round((score / Math.max(session.questionIds.length, 1)) * 100),
  }
}

export function latestAnswers(sessions: Record<string, StudySession>, categoryId?: string) {
  const result: Record<string, Answer> = {}
  Object.values(sessions)
    .filter((s) => !categoryId || s.categoryId === categoryId)
    .sort((a, b) => a.updatedAt - b.updatedAt)
    .forEach((session) => Object.assign(result, session.answers ?? {}))
  return result
}

export function hasResponse(answer?: Answer) {
  return !!answer && answer.status !== 'skipped'
}

export function reviewedQuestionCount(sessions: Record<string, StudySession>, categoryId: string) {
  const reviewed = new Set<string>()
  Object.values(sessions)
    .filter((session) => session.categoryId === categoryId)
    .forEach((session) => {
      Object.entries(session.answers ?? {}).forEach(([id, answer]) => {
        if (answer.graded && hasResponse(answer)) reviewed.add(id)
      })
    })
  return reviewed.size
}

export function shuffled<T>(items: T[]): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
