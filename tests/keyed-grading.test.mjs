import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { canAutoGrade, gradeAnswer, studyExplanation } from '../src/lib/study-models.ts'
import { presentQuestion } from '../src/lib/question-presentation.ts'
import { prepareSession } from '../src/lib/session-validation.ts'
import { recomputeScore } from '../src/lib/server/analytics.ts'

const question = {
  id: 'q-003', categoryId: 'financial-statements', originalNumber: 'Derived 3',
  question: 'Which statement shows cash from operations, investing and financing?',
  type: 'identification', correctAnswer: 'Statement of cash flows',
  verificationStatus: 'review-required', answerOrigin: 'generated', derived: true,
  sourceDocument: 'Teaching reference.pdf', sourcePage: '4', topic: 'Cash flows',
  explanation: 'Generated study question based on page 4 of the supplied reference. The answer is grounded in that page and awaits instructor review.',
}

test('the reported financial statement answer and its standard synonym earn full automatic credit', () => {
  for (const response of ['Statement of cash flows', 'cash flow statement', ' STATEMENT OF CASH FLOWS! ']) {
    assert.equal(gradeAnswer(question, response).status, 'correct')
    assert.equal(gradeAnswer(question, response).credit, 1)
  }
  assert.equal(gradeAnswer(question, 'Income statement').status, 'incorrect')
  assert.equal(studyExplanation(question), 'Based on the supplied reviewer, page 4.')
  assert.equal(question.verificationStatus, 'review-required')
})

test('keyed questions grade consistently in all dynamic formats and trusted session/report scoring', () => {
  const bank = [question, { ...question, id: 'q-004', correctAnswer: 'Balance sheet' }]
  for (const format of ['identification', 'enumeration', 'multiple-choice', 'true-false']) {
    const view = presentQuestion(question, format, bank, 'keyed-session')
    assert.equal(canAutoGrade(view), true)
    assert.equal(gradeAnswer(view, view.correctAnswer).status, 'correct')
  }
  const session = { id: 'keyed-session', categoryId: question.categoryId, mode: 'exam', contentVersion: 'v1',
    settings: { mode: 'exam', count: 1, types: ['identification'], randomize: false, shuffleChoices: false,
      instantFeedback: false, showExplanations: true, timer: false, durationMinutes: 20, filter: 'all' },
    questionIds: [question.id], currentQuestionIndex: 0, answers: {}, status: 'in-progress',
    startedAt: 1, updatedAt: 1, revision: 1 }
  const completed = prepareSession({ ...session, revision: 2, status: 'completed', answers: {
    [question.id]: { value: 'cash flow statement', status: 'pending', credit: 0, graded: false },
  } }, session, { [question.id]: question }, 100)
  assert.equal(completed.score, 1)
  const report = recomputeScore('test-user', completed, { [question.id]: question }, 100)
  assert.equal(report.score, 1)
  assert.equal(report.maxScore, 1)
  assert.equal(report.review, 0)
})

test('empty keys and keys absent from the choices are excluded instead of producing fabricated scores', () => {
  assert.equal(canAutoGrade({ ...question, correctAnswer: '' }), false)
  assert.equal(canAutoGrade({ ...question, type: 'multiple-choice', choices: ['A', 'B'] }), false)
})

test('learner screens contain no blanket verification warning or pending-generated-answer message', async () => {
  const source = await readFile('src/components/quiz-player.tsx', 'utf8')
  assert.doesNotMatch(source, /This source answer key is flagged|Generated answer \(review pending\)|This response needs manual review|Questionable key · verification required/)
})
