import type { StudySession, Question, Answer, SessionSettings } from './study-models'
import { gradeAnswer } from './study-models'
import { safeId } from './question-schema'
import { answerFormats, questionsForSession } from './question-presentation'

const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => [k,canonical(v)]))
  return value
}
const equal = (a: unknown, b: unknown) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))
const modes = ['practice','exam','flashcard','mixed']
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value) }
function allowKeys(value: object, keys: string[]) { if (Object.keys(value).some((k) => !keys.includes(k))) throw new Error('Unexpected session field.') }

export function validateSessionInput(value: unknown): StudySession {
  if (!object(value)) throw new Error('Expected a session.')
  allowKeys(value,['id','categoryId','mode','settings','questionIds','currentQuestionIndex','answers','choiceOrder','status','startedAt','updatedAt','completedAt','revision','score','contentVersion'])
  if (!safeId(value.id) || !safeId(value.categoryId) || (value.contentVersion !== undefined && !safeId(value.contentVersion))) throw new Error('Invalid session identifier.')
  if (!modes.includes(String(value.mode)) || !['in-progress','completed'].includes(String(value.status))) throw new Error('Invalid study mode or status.')
  if (!Array.isArray(value.questionIds) || value.questionIds.length < 1 || value.questionIds.length > 1000 || !value.questionIds.every(safeId) || new Set(value.questionIds).size !== value.questionIds.length) throw new Error('Choose between 1 and 1000 unique questions.')
  if (!Number.isInteger(value.currentQuestionIndex) || Number(value.currentQuestionIndex) < 0 || Number(value.currentQuestionIndex) >= value.questionIds.length || !Number.isInteger(value.revision) || Number(value.revision) < 1) throw new Error('Invalid session position or revision.')
  if (!object(value.settings)) throw new Error('Session settings are required.')
  allowKeys(value.settings,['mode','types','count','randomize','shuffleChoices','instantFeedback','showExplanations','timer','durationMinutes','filter','questionFormat'])
  const settings = value.settings as unknown as SessionSettings
  if (settings.questionFormat !== undefined && !answerFormats.some(f => f.id === settings.questionFormat)) throw new Error('Invalid question format.')
  if (settings.mode !== value.mode || settings.count !== value.questionIds.length || !Array.isArray(settings.types) || !settings.types.length || !settings.types.every((t) => ['multiple-choice','true-false','identification','enumeration'].includes(t)) ||
    !['all','unanswered','bookmarked','incorrect'].includes(settings.filter) || !Number.isInteger(settings.durationMinutes) || settings.durationMinutes < 1 || settings.durationMinutes > 180 ||
    ['randomize','shuffleChoices','instantFeedback','showExplanations','timer'].some((k) => typeof (settings as unknown as Record<string,unknown>)[k] !== 'boolean') || (value.mode === 'exam' && settings.instantFeedback)) throw new Error('Invalid session settings.')
  if (!object(value.answers)) throw new Error('Invalid answers.')
  for (const [id,answer] of Object.entries(value.answers)) {
    if (!value.questionIds.includes(id) || !object(answer)) throw new Error('Answer does not belong to the session.')
    allowKeys(answer,['value','status','credit','graded'])
    if (!(typeof answer.value === 'string' && answer.value.length <= 4000) && !(Array.isArray(answer.value) && answer.value.length <= 100 && answer.value.every((v) => typeof v === 'string' && v.length <= 2000))) throw new Error('Invalid answer text.')
    if (!['pending','correct','incorrect','partial','skipped','review-required'].includes(String(answer.status)) || typeof answer.graded !== 'boolean' || typeof answer.credit !== 'number' || !Number.isFinite(answer.credit)) throw new Error('Invalid answer fields.')
  }
  if (value.choiceOrder !== undefined) {
    if (!object(value.choiceOrder)) throw new Error('Invalid choice order.')
    for (const [id,choices] of Object.entries(value.choiceOrder)) if (!value.questionIds.includes(id) || !Array.isArray(choices) || !choices.every((v) => typeof v === 'string' && v.length <= 30000)) throw new Error('Invalid choice order.')
  }
  for (const k of ['startedAt','updatedAt','completedAt','score']) if (value[k] !== undefined && (typeof value[k] !== 'number' || !Number.isFinite(value[k]))) throw new Error('Invalid timestamp or score.')
  return value as unknown as StudySession
}

export function prepareSession(input: StudySession, current: StudySession | null, questions: Record<string,Question>, now: number): StudySession {
  questions = Object.fromEntries(questionsForSession(Object.values(questions), input).map(q => [q.id, q]))
  if (current) {
    if (current.status === 'completed') throw new Error('Completed sessions cannot be changed.')
    if (input.revision !== current.revision + 1) throw new Error('This session changed on another device. Reload before continuing.')
    for (const key of ['id','categoryId','mode','settings','questionIds','contentVersion','choiceOrder'] as const)
      if (!equal(key === 'choiceOrder' ? input[key] ?? {} : input[key],key === 'choiceOrder' ? current[key] ?? {} : current[key])) throw new Error('Session questions, mode, version and settings cannot change after starting.')
  } else if (input.revision !== 1 || input.status !== 'in-progress' || Object.keys(input.answers).length) throw new Error('Start a new session before submitting answers.')
  for (const id of input.questionIds) {
    const q = questions[id]
    if (!q || !input.settings.types.includes(q.type)) throw new Error('A selected question is not available for this session.')
    const order = input.choiceOrder?.[id]
    if (order && !equal([...order].sort(),[...q.choices ?? []].sort())) throw new Error('Choice order does not match the original question.')
  }
  const answers: Record<string,Answer> = {}
  for (const [id,answer] of Object.entries(input.answers)) {
    if (current?.answers?.[id]?.graded && input.mode !== 'exam' && !equal(answer,current.answers[id])) throw new Error('A graded response cannot be revised.')
    if (input.mode === 'flashcard') {
      const known = answer.status === 'correct'
      answers[id] = { value: answer.value, status: known ? 'correct' : 'incorrect', credit: known ? 1 : 0, graded: true }
    } else if (answer.status === 'skipped') answers[id] = { value:'',status:'skipped',credit:0,graded:input.status === 'completed' }
    else if (input.status === 'completed' || (input.settings.instantFeedback && input.mode !== 'exam')) answers[id] = gradeAnswer(questions[id],answer.value)
    else answers[id] = { value: answer.value,status:'pending',credit:0,graded:false }
  }
  if (input.status === 'completed') for (const id of input.questionIds) if (!answers[id]) answers[id] = { value:'',status:'skipped',credit:0,graded:true }
  return { ...input, answers, startedAt: current?.startedAt ?? now, updatedAt: now,
    ...(input.status === 'completed' ? { completedAt: now,score:Object.values(answers).reduce((n,a) => n+a.credit,0) } : {}) }
}
