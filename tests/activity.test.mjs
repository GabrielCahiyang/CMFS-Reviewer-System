import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateEvent } from '../src/lib/activity-models.ts'
import { applyEvent, dayKey, recomputeScore } from '../src/lib/server/analytics.ts'
import { parseQuestions } from '../src/lib/question-schema.ts'
test('event boundary rejects supplied UID, timestamps, free text, unsafe paths and unsupported events', () => {
  const valid = {eventId:'event-1',type:'category_opened',categoryId:'new-reviewer'}
  for (const extra of [{uid:'someone'},{occurredAt:0},{answer:'private answer'}]) assert.throws(() => validateEvent({...valid,...extra}))
  assert.throws(() => validateEvent({...valid,categoryId:'../users'}))
  assert.throws(() => validateEvent({...valid,type:'admin_granted'}))
  assert.deepEqual(validateEvent(valid),valid)
})
test('question and reading events require a saved session and a bounded duration', () => {
  const e = {eventId:'event-2',type:'reading_summary',categoryId:'new-reviewer',questionId:'q-001'}
  assert.throws(() => validateEvent({...e,durationMs:1000}))
  assert.throws(() => validateEvent({...e,sessionId:'s1',durationMs:300001}))
  assert.throws(() => validateEvent({...e,sessionId:'s1',durationMs:NaN}))
  assert.equal(validateEvent({...e,sessionId:'s1',durationMs:500}).durationMs,500)
})
test('event retries do not increment daily, user or reviewer totals twice', () => {
  const event = {eventId:'e1',type:'session_started',uid:'u1',categoryId:'new-reviewer',occurredAt:100}
  let b = applyEvent(null,'stable-session-key',event)
  b = applyEvent(b,'stable-session-key',{...event,occurredAt:200})
  assert.equal(b.totals.starts,1); assert.equal(b.users.u1.starts,1); assert.equal(b.categories['new-reviewer'].starts,1)
})
test('trusted scoring ignores forged credit and excludes unresolved keys from its denominator', () => {
  const q = {originalNumber:'1',question:'Question',type:'multiple-choice',choices:['yes','no'],correctAnswer:'yes',verificationStatus:'verified'}
  const s = { id:'s1',categoryId:'new-reviewer',mode:'exam',contentVersion:'v1',questionIds:['q1','q2'],status:'completed',updatedAt:2,
    answers:{q1:{value:'no',credit:1,status:'correct'},q2:{value:'anything',credit:1,status:'correct'}} }
  const result = recomputeScore('u1',s,{q1:q,q2:{...q,verificationStatus:'review-required'}},10)
  assert.equal(result.score,0); assert.equal(result.maxScore,1); assert.equal(result.incorrect,1); assert.equal(result.review,1); assert.equal(result.provisional,true)
})
test('self-assessed flashcards never increase graded accuracy', () => {
  const s = {id:'s1',categoryId:'a',mode:'flashcard',contentVersion:'v1',questionIds:['q1'],updatedAt:1,answers:{q1:{value:'yes',credit:1}}}
  const result = recomputeScore('u',s,{q1:{verificationStatus:'verified'}},2)
  const bucket = applyEvent(null,'completion',{uid:'u',type:'session_completed',occurredAt:1,categoryId:'a'},result)
  assert.equal(result.maxScore,0); assert.equal(bucket.totals.gradedSessions,0); assert.equal(bucket.totals.completions,1)
})
test('Manila midnight determines the daily bucket', () => assert.equal(dayKey(Date.parse('2026-10-23T16:01:00Z')),'2026-10-24'))
test('question parser normalizes RTDB numeric-key objects and rejects ambiguous verified keys', () => {
  const q = { originalNumber:'1',question:'Q',topic:'T',sourceDocument:'S', type:'multiple-choice',choices:{0:'a',1:'b'},correctAnswer:'b',verificationStatus:'verified' }
  assert.deepEqual(parseQuestions({'q-001':q},'new-reviewer')[0].choices,['a','b'])
  assert.throws(() => parseQuestions({'q-001':{...q,correctAnswer:'c'}},'new-reviewer'))
})
