import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ts from 'typescript'

const source = readFileSync(new URL('../src/lib/study-models.ts', import.meta.url), 'utf8')
const javascript = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText
const {
  gradeAnswer,
  normalize,
  sessionStats,
  latestAnswers,
  reviewedQuestionCount,
  hasResponse,
  shuffled,
} = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`)
const question = {
  id: 'q1',
  categoryId: 'new-reviewer',
  originalNumber: '1',
  question: 'Example',
  type: 'multiple-choice',
  choices: ['A', 'B'],
  correctAnswer: 'B',
  verificationStatus: 'verified',
}

test('normalization ignores capitalization, repeated whitespace, and punctuation', () => {
  assert.equal(normalize('  Net   Working Capital! '), 'net working capital')
})
test('choice grading is independent of choice letters and display order', () => {
  assert.equal(gradeAnswer(question, 'B').status, 'correct')
  assert.equal(gradeAnswer(question, 'A').status, 'incorrect')
})
test('content verification labels do not prevent grading a usable answer key', () => {
  assert.equal(
    gradeAnswer({ ...question, verificationStatus: 'review-required' }, 'B').status,
    'correct',
  )
})
test('identification grades approved alternatives and rejects unmatched answers', () => {
  const q = {
    ...question,
    type: 'identification',
    correctAnswer: 'Net working capital',
    acceptedAnswers: ['NWC'],
  }
  assert.equal(gradeAnswer(q, ' nwc ').credit, 1)
  assert.equal(gradeAnswer(q, 'Operating funds').status, 'incorrect')
})
test('enumeration accepts unordered approved alternatives', () => {
  const q = {
    ...question,
    type: 'enumeration',
    correctAnswer: ['Cash', 'Receivables', 'Inventory'],
    alternatives: { Receivables: ['Accounts receivable'] },
  }
  assert.equal(gradeAnswer(q, ['inventory', 'Cash', 'accounts receivable']).status, 'correct')
})
test('enumeration never rewards duplicate entries twice and supports partial credit', () => {
  const q = {
    ...question,
    type: 'enumeration',
    correctAnswer: ['Cash', 'Receivables', 'Inventory'],
  }
  const answer = gradeAnswer(q, ['Cash', 'Cash', 'Cash'])
  assert.equal(answer.credit, 1 / 3)
  assert.equal(answer.status, 'partial')
})
test('extra enumeration entries cannot earn a perfect score', () => {
  const q = { ...question, type: 'enumeration', correctAnswer: ['Cash', 'Inventory'] }
  assert.equal(gradeAnswer(q, ['Cash', 'Inventory', 'Other']).credit, 2 / 3)
  assert.equal(gradeAnswer(q, ['Cash', 'Inventory', 'Other']).status, 'partial')
})
test('explicit enumeration order is enforced', () => {
  const q = {
    ...question,
    type: 'enumeration',
    correctAnswer: ['Cash', 'Inventory'],
    orderMatters: true,
  }
  assert.notEqual(gradeAnswer(q, ['Inventory', 'Cash']).status, 'correct')
})
test('results include fractional credit and unanswered questions as skipped', () => {
  const result = sessionStats({
    questionIds: ['q1', 'q2', 'q3', 'q4'],
    answers: {
      q1: { value: 'B', status: 'correct', credit: 1, graded: true },
      q2: { value: ['a'], status: 'partial', credit: 0.5, graded: true },
      q3: { value: 'x', status: 'review-required', credit: 0, graded: true },
    },
  })
  assert.equal(result.percent, 38)
  assert.equal(result.skipped, 1)
  assert.equal(result.review, 1)
})
test('latest saved session answer wins without double-counting a resumed question', () => {
  const sessions = {
    first: { categoryId: 'a', updatedAt: 1, answers: { q1: { status: 'incorrect' } } },
    second: { categoryId: 'a', updatedAt: 2, answers: { q1: { status: 'correct' } } },
  }
  assert.equal(latestAnswers(sessions, 'a').q1.status, 'correct')
  assert.equal(Object.keys(latestAnswers(sessions)).length, 1)
})
test('shuffle preserves the source array and all items', () => {
  const source = [1, 2, 3, 4, 5]
  assert.deepEqual([...shuffled(source)].sort(), source)
  assert.deepEqual(source, [1, 2, 3, 4, 5])
})

test('skipped questions never count as practiced or erase earlier reviewed progress', () => {
  const sessions = {
    first: { categoryId: 'a', updatedAt: 1, answers: { q1: { status: 'correct', graded: true } } },
    retake: {
      categoryId: 'a',
      updatedAt: 2,
      answers: { q1: { status: 'skipped', graded: true }, q2: { status: 'skipped', graded: true } },
    },
  }
  assert.equal(reviewedQuestionCount(sessions, 'a'), 1)
  assert.equal(reviewedQuestionCount(sessions, 'other'), 0)
})

test('saved but ungraded exam selections are answered, while skipped entries are unanswered', () => {
  assert.equal(hasResponse({ status: 'pending', graded: false, value: 'B', credit: 0 }), true)
  assert.equal(hasResponse({ status: 'skipped', graded: false, value: '', credit: 0 }), false)
  assert.equal(hasResponse(undefined), false)
})
