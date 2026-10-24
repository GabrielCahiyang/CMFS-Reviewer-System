import assert from 'node:assert/strict'
import { test } from 'node:test'
import { prepareSession,validateSessionInput } from '../src/lib/session-validation.ts'
const q = {id:'q1',type:'multiple-choice',choices:['yes','no'],correctAnswer:'yes',verificationStatus:'verified'}
const bank = {q1:q}
const session = () => ({id:'s1',categoryId:'new-reviewer',mode:'practice',settings:{mode:'practice',types:['multiple-choice'],count:1,randomize:false,shuffleChoices:false,instantFeedback:true,showExplanations:true,timer:false,durationMinutes:20,filter:'all'},questionIds:['q1'],currentQuestionIndex:0,answers:{},status:'in-progress',startedAt:1,updatedAt:1,revision:1,contentVersion:'v1'})
test('server starts sessions with server time and rejects unknown or cross-session fields',() => {
  const s=validateSessionInput(session())
  assert.equal(prepareSession(s,null,bank,100).startedAt,100)
  assert.throws(() => validateSessionInput({...s,uid:'someone-else'}))
  assert.throws(() => validateSessionInput({...s,answers:{q2:{value:'yes',credit:1,graded:true,status:'correct'}}}))
})
test('server rejects concurrent revisions, completed edits, switched versions and changed question lists',() => {
  const current=session()
  assert.throws(() => prepareSession(current,current,bank,2))
  for(const change of [{contentVersion:'v2'},{questionIds:['q2']},{settings:{...current.settings,timer:true}}])
    assert.throws(() => prepareSession({...current,revision:2,...change},current,bank,2))
  assert.throws(() => prepareSession({...current,revision:2},{...current,status:'completed'},bank,2))
})
test('session saves regrade responses and ignore the submitted score/credit',() => {
  const current=session()
  const next=prepareSession({...current,revision:2,answers:{q1:{value:'no',status:'correct',credit:1,graded:true}},status:'completed',score:100},current,bank,99)
  assert.equal(next.answers.q1.credit,0); assert.equal(next.answers.q1.status,'incorrect'); assert.equal(next.score,0); assert.equal(next.completedAt,99)
})
test('database key ordering and removed empty objects do not prevent resuming',() => {
  const current=session()
  current.settings=Object.fromEntries(Object.entries(current.settings).reverse())
  const next={...session(),choiceOrder:{},revision:2}
  assert.equal(prepareSession(next,current,bank,2).revision,2)
})
test('flashcard self-rating survives saving without masquerading as key grading',() => {
  const current={...session(),mode:'flashcard',settings:{...session().settings,mode:'flashcard'}}
  const next=prepareSession({...current,revision:2,answers:{q1:{value:'yes',status:'correct',credit:1,graded:true}}},current,bank,2)
  assert.equal(next.answers.q1.status,'correct')
})
