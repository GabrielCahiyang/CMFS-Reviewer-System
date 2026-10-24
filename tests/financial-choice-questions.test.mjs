import assert from 'node:assert/strict'
import {test} from 'node:test'
import {financialChoiceQuestions} from '../scripts/lib/financial-choice-questions.mjs'
import {validateBank} from '../scripts/lib/import-core.mjs'
test('adds twelve resolvable multiple-choice and twelve true/false records without replacing original IDs',()=>{
 const bank=financialChoiceQuestions('reference.pdf'),records=Object.values(bank)
 assert.equal(records.filter(q=>q.type==='multiple-choice').length,12)
 assert.equal(records.filter(q=>q.type==='true-false').length,12)
 assert.ok(Object.keys(bank).every(id=>Number(id.slice(2))>40))
 assert.deepEqual(validateBank(bank).errors,[])
 for(const q of records){assert.equal(q.choices.filter(c=>c===q.correctAnswer).length,1);assert.equal(q.verificationStatus,'review-required');assert.ok(q.sourcePage)}
})
