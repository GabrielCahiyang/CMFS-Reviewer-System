import assert from 'node:assert/strict'
import { test } from 'node:test'
import { hash, htmlToLines, parseQuestionLines, validateBank, fieldDiff } from '../scripts/lib/import-core.mjs'
const source = { categoryId: 'new-reviewer', title: 'Reviewer', filename: 'NEW REVIEWER.docx' }
const lines = (text) => text.split('\n').map((text) => ({ text, page: '2' }))
test('extracts original choices, numbered keys and explanations without shuffled letters', () => {
  const result = parseQuestionLines(lines('1. Exact question?\nA. Alpha\nB. Beta\nAnswer Key\n1. B — original explanation'),source)
  const q = result.questions['q-001']
  assert.equal(q.correctAnswer,'Beta'); assert.equal(q.originalAnswerLetter,'B'); assert.equal(q.sourcePage,'2')
  assert.equal(q.explanation,'original explanation'); assert.equal(q.verificationStatus,'verified')
  assert.deepEqual(validateBank(result.questions).errors,[])
})
test('preserves explicit answers and Bisaya-English rationales', () => {
  const q = parseQuestionLines(lines('1. Source wording\nA) Cash\nB) Loan\nCORRECT ANSWER: A. Cash\nWhy (Simple Bisaya-English): Mao ni ang tubag.\nExact second line.'),source).questions['q-001']
  assert.equal(q.correctAnswer,'Cash'); assert.equal(q.explanation,'Mao ni ang tubag. Exact second line.')
})
test('does not infer missing highlighted answers', () => {
  const q = parseQuestionLines(lines('1. Question?\nA. Alpha\nB. Beta'),{ ...source, highlightedAnswers: true }).questions['q-001']
  assert.equal(q.correctAnswer,''); assert.equal(q.verificationStatus,'review-required')
})
test('known questionable source item remains flagged even with a supplied key', () => {
  const q = parseQuestionLines(lines('39. Question?\nA. Alpha\nB. Beta\nAnswer Key\n39. A'),source).questions['q-039']
  assert.equal(q.correctAnswer,'Alpha'); assert.equal(q.verificationStatus,'review-required')
})
test('flags duplicate numbers, orphan keys and numbering gaps', () => {
  const result = parseQuestionLines(lines('1. First\nA. x\nB. y\n1. Duplicate\nA. x\nB. y\n3. Third\nA. x\nB. y\nAnswer Key\n4. B'),source)
  assert.ok(result.warnings.some((w) => w.includes('Duplicate')))
  assert.ok(result.warnings.some((w) => w.includes('Orphan')))
  assert.deepEqual(result.missingNumbers,[2])
})
test('rejects falsely verified keys, incomplete mandatory counts, and unreviewed derived content', () => {
  const q = { originalNumber:'1', question:'Q?', type:'multiple-choice', choices:['a','b'], correctAnswer:'c', topic:'T', sourceDocument:'source.pdf', verificationStatus:'verified', derived:true }
  const result = validateBank({ 'q-001':q },{ expectedCount:2 })
  assert.ok(result.errors.some((e) => e.includes('exactly one')))
  assert.ok(result.errors.some((e) => e.includes('named reviewer')))
  assert.ok(result.errors.some((e) => e.includes('Expected 2')))
})
test('rejects Firebase-unsafe answer alternative keys and unknown fields', () => {
  const result = validateBank({ 'q-001':{ originalNumber:'1',question:'Q',topic:'T',sourceDocument:'S', type:'enumeration', correctAnswer:['a'], alternatives:{ 'a.b':['c'] }, verificationStatus:'verified',role:'admin' } })
  assert.ok(result.errors.some((e) => e.includes('Firebase-unsafe')))
  assert.ok(result.errors.some((e) => e.includes('unexpected field role')))
})
test('checksums ignore object ordering and field-level diffs expose existing answer edits', () => {
  assert.equal(hash({a:1,b:2}),hash({b:2,a:1}))
  assert.deepEqual(fieldDiff({q:{correctAnswer:'old'}},{q:{correctAnswer:'new'}}),[{path:'/q/correctAnswer',before:'old',after:'new'}])
})
test('retains Word paragraphs and ordered list text in sequence', () => {
  assert.deepEqual(htmlToLines('<p>Title</p><ol><li>First</li><li><strong>Second</strong></li></ol>').map((l) => l.text),['Title','1. First','2. Second'])
})
