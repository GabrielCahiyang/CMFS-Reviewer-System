import assert from 'node:assert/strict'
import {test} from 'node:test'
import {readFile} from 'node:fs/promises'
import {validatedFiles} from '../scripts/lib/seed-files.mjs'
import {parseQuestions} from '../src/lib/question-schema.ts'
import {canAutoGrade,gradeAnswer} from '../src/lib/study-models.ts'
const files=await validatedFiles()
const expected={'new-reviewer':84,'cfms-questionnaire':145,'huhuhuhu-reviewer':136,'pre-finals':101,'working-capital':63,'financial-statements':64}
test('all six banks contain all 593 keyed records and every question format',()=>{
  let total=0
  for(const [id,count] of Object.entries(expected)) {
    const questions=parseQuestions(files.banks[id],id)
    assert.equal(questions.length,count);total+=count
    assert.deepEqual([...new Set(questions.map(q=>q.type))].sort(),['enumeration','identification','multiple-choice','true-false'])
    for(const q of questions) {
      assert.ok(q.correctAnswer.length);assert.ok(!q.question.includes('Emulator test:'))
      assert.ok(!q.question.includes('Downloaded by'));assert.ok(!q.choices?.some((c)=>/Downloaded by|Rationalization:|CORRECT ANSWER:/.test(c)))
      if(canAutoGrade(q))assert.equal(gradeAnswer(q,q.type==='enumeration'?q.correctAnswer:Array.isArray(q.correctAnswer)?q.correctAnswer[0]:q.correctAnswer).status,'correct')
    }
  }
  assert.equal(total,593)
})
test('source numbering defects and multiple highlighted keys remain explicit',()=>{
  const cfms=Object.values(files.banks['cfms-questionnaire'])
  assert.ok(cfms.some(q=>q.originalNumber==='10-102'));assert.ok(cfms.some(q=>q.originalNumber==='1117'))
  const working=Object.values(files.banks['working-capital'])
  assert.ok(!working.some(q=>q.originalNumber==='10'));assert.ok(working.some(q=>q.originalNumber==='13'))
  for(const number of ['7','9']) {
    const q=working.find(q=>q.originalNumber===number);assert.equal(q.correctAnswer.length,2);assert.equal(q.verificationStatus,'review-required')
  }
})
test('generated answers are labeled and source keys are never silently overwritten',()=>{
  const derived=Object.values(files.banks['financial-statements'])
  for(const q of derived){assert.equal(q.derived,true);assert.equal(q.answerOrigin,'generated');assert.equal(q.verificationStatus,'review-required');assert.ok(q.sourcePage)}
  const missing=Object.values(files.banks['pre-finals']).find(q=>q.originalNumber==='46')
  assert.equal(missing.answerOrigin,'generated');assert.ok(missing.sourceAnswer.includes('No correct option'))
  assert.ok(missing.correctAnswer.includes('depreciation'))
})
