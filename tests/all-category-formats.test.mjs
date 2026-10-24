import assert from 'node:assert/strict'
import {test} from 'node:test'
import {allQuestionTypes,missingFormatQuestions} from '../scripts/lib/all-category-formats.mjs'
import {validateBank} from '../scripts/lib/import-core.mjs'
test('missing formats have actual question records, preserve originals and do not duplicate on rerun',()=>{
 for(const id of ['new-reviewer','cfms-questionnaire','huhuhuhu-reviewer','pre-finals','working-capital']){
  const types=id==='pre-finals'?['multiple-choice','true-false']:['multiple-choice']
  const bank=Object.fromEntries(types.map((type,i)=>[`source-${i}`,{originalNumber:String(i+1),question:'Working capital and capital structure',type,choices:type==='true-false'?['True','False']:['Debt','Equity'],correctAnswer:type==='true-false'?'True':'Debt',sourceDocument:'source.docx',topic:'Finance',verificationStatus:'verified'}]))
  const before=JSON.stringify(bank),added=missingFormatQuestions(id,bank)
  assert.equal(JSON.stringify(bank),before)
  const combined={...bank,...added}
  assert.deepEqual([...new Set(Object.values(combined).map(q=>q.type))].sort(),[...allQuestionTypes].sort())
  assert.deepEqual(validateBank(combined).errors,[])
  assert.deepEqual(missingFormatQuestions(id,combined),{})
 }
})
