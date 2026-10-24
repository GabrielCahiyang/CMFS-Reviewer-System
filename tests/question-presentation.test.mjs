import assert from 'node:assert/strict'
import {test} from 'node:test'
import {presentQuestion,questionsForSession,selectedQuestions} from '../src/lib/question-presentation.ts'
import {gradeAnswer} from '../src/lib/study-models.ts'
import {prepareSession,validateSessionInput} from '../src/lib/session-validation.ts'
const bank=[
 {id:'q-001',categoryId:'reviewer',originalNumber:'1',question:'Which market handles new securities?',type:'multiple-choice',choices:['Primary market','Secondary market','Money market','Futures market'],correctAnswer:'Primary market',verificationStatus:'verified',topic:'Markets',sourceDocument:'Source.docx'},
 {id:'q-002',categoryId:'reviewer',originalNumber:'2',question:'Name the short-term liquidity ratio.',type:'identification',correctAnswer:'Current ratio',verificationStatus:'verified',topic:'Liquidity',sourceDocument:'Source.docx'},
 {id:'q-003',categoryId:'reviewer',originalNumber:'3',question:'Name the two financing components.',type:'enumeration',correctAnswer:['Debt','Equity'],verificationStatus:'verified',topic:'Capital',sourceDocument:'Source.docx'},
 {id:'q-004',categoryId:'reviewer',originalNumber:'4',question:'Cash is a current asset.',type:'true-false',choices:['True','False'],correctAnswer:'True',verificationStatus:'verified',topic:'Assets',sourceDocument:'Source.docx'},
]
test('the same source ID can be answered in all four formats without modifying the bank',()=>{
 const before=JSON.stringify(bank)
 for(const q of bank)for(const type of ['multiple-choice','true-false','identification','enumeration']){
  const view=presentQuestion(q,type,bank,'session-1')
  assert.equal(view.id,q.id);assert.equal(view.question,q.question);assert.equal(view.type,type)
  if(type==='multiple-choice'||type==='true-false')assert.equal(view.choices.filter(v=>v===view.correctAnswer).length,1)
  assert.equal(gradeAnswer(view,view.correctAnswer).status,'correct')
 }
 assert.equal(JSON.stringify(bank),before)
})
test('variant and distractors remain stable on refresh, resume and bank object key reordering',()=>{
 for(const q of bank)for(const format of ['multiple-choice','true-false','mixed'])
  assert.deepEqual(presentQuestion(q,format,bank,'saved-session'),presentQuestion(q,format,[...bank].reverse(),'saved-session'))
 const outcomes=new Set(Array.from({length:30},(_,i)=>presentQuestion(bank[0],'true-false',bank,`s-${i}`).correctAnswer))
 assert.deepEqual([...outcomes].sort(),['False','True'])
})
test('custom selection retains exactly the selected source questions, including across filters/pages',()=>{
 const selected=new Set(['q-001','q-003','retired-question'])
 assert.deepEqual(selectedQuestions(bank,selected).map(q=>q.id),['q-001','q-003'])
 assert.deepEqual(selectedQuestions(bank.slice(1),selected).map(q=>q.id),['q-003'])
})
test('server validation and grading use the exact same adapted presentation as the learner',()=>{
 for(const format of ['multiple-choice','true-false','identification','enumeration','mixed']){
  const settings={questionFormat:format,mode:'exam',types:['multiple-choice','true-false','identification','enumeration'],count:2,randomize:false,shuffleChoices:false,instantFeedback:false,showExplanations:true,timer:false,durationMinutes:20,filter:'all'}
  const initial={id:`session-${format}`,categoryId:'reviewer',mode:'exam',settings,questionIds:['q-001','q-003'],currentQuestionIndex:0,answers:{},revision:1,status:'in-progress',startedAt:0,updatedAt:0}
  const views=questionsForSession(bank,initial)
  const first=prepareSession(validateSessionInput(initial),null,Object.fromEntries(bank.map(q=>[q.id,q])),100)
  const answers=Object.fromEntries(views.filter(q=>initial.questionIds.includes(q.id)).map(q=>[q.id,{value:q.correctAnswer,status:'pending',credit:0,graded:false}]))
  const completed=prepareSession({...first,answers,revision:2,status:'completed'},first,Object.fromEntries(bank.map(q=>[q.id,q])),200)
  assert.equal(completed.score,2)
  assert.throws(()=>prepareSession({...first,revision:2,settings:{...settings,questionFormat:'original'}},first,Object.fromEntries(bank.map(q=>[q.id,q])),200))
 }
})
