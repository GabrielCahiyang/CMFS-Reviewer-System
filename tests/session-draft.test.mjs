import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { SessionDraftQueue, sessionDraftKey } from '../src/lib/session-draft.ts'

const initial = () => ({ id: 'draft-session', categoryId: 'financial-statements', mode: 'exam',
  settings: { mode: 'exam', types: ['identification'], count: 2, instantFeedback: false },
  questionIds: ['q1', 'q2'], currentQuestionIndex: 0, answers: {}, status: 'in-progress',
  revision: 1, startedAt: 1, updatedAt: 1 })
const answer = value => ({ value, status: 'pending', credit: 0, graded: false })
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
function setup(send, restored) {
  const state = { record: null, errors: [], changes: [], remote: initial() }
  const queue = new SessionDraftQueue(initial(), {
    send, refresh: async () => state.remote, delay: 60000,
    persist: record => { state.record = record && structuredClone(record) },
    change: draft => state.changes.push(draft), error: error => state.errors.push(error),
  }, restored)
  return { queue, state }
}

test('rapid changes and navigation stay immediate while a slow save is in flight; only the latest snapshot follows it', async () => {
  const request = deferred(), writes = []
  const { queue, state } = setup(async (draft, revision) => {
    writes.push(structuredClone({ draft, revision }))
    if (writes.length === 1) await request.promise
    return { ...draft, revision: revision + 1 }
  })
  queue.stage({ ...queue.current, answers: { q1: answer('first') } })
  const flush = queue.flush()
  for (let i = 0; i < 100; i++) queue.stage({ ...queue.current, answers: { q1: answer(`choice ${i}`) } })
  queue.stage({ ...queue.current, currentQuestionIndex: 1, answers: { ...queue.current.answers, q2: answer('Balance sheet') } })
  assert.equal(writes.length, 1)
  assert.equal(queue.current.currentQuestionIndex, 1)
  assert.equal(queue.current.answers.q1.value, 'choice 99')
  assert.equal(state.record.draft.answers.q2.value, 'Balance sheet')
  request.resolve()
  const result = await flush
  assert.deepEqual(writes.map(write => write.revision), [1, 2])
  assert.equal(writes[1].draft.answers.q1.value, 'choice 99')
  assert.equal(result.revision, 3)
  assert.equal(result.currentQuestionIndex, 1)
  assert.equal(state.record, null)
  assert.equal(queue.hasPending, false)
  queue.stop()
})

test('realtime acknowledgements never roll back newer local answers or navigation', async () => {
  const request = deferred(), writes = []
  const { queue } = setup(async (draft, revision) => {
    writes.push({ draft, revision })
    if (writes.length === 1) await request.promise
    return { ...draft, revision: revision + 1 }
  })
  queue.stage({ ...queue.current, answers: { q1: answer('A') } })
  const flush = queue.flush()
  queue.stage({ ...queue.current, answers: { q1: answer('B') }, currentQuestionIndex: 1 })
  queue.receive({ ...writes[0].draft, revision: 2 })
  queue.receive(initial())
  assert.equal(queue.current.answers.q1.value, 'B')
  assert.equal(queue.current.currentQuestionIndex, 1)
  request.resolve()
  await flush
  assert.deepEqual(writes.map(write => write.revision), [1, 2])
  assert.equal(queue.current.answers.q1.value, 'B')
  queue.stop()
})

test('a failed request retains local answers, accepts more changes, and retries without losing them', async () => {
  let fail = true
  const { queue, state } = setup(async (draft, revision) => {
    if (fail) throw new Error('Offline')
    return { ...draft, revision: revision + 1 }
  })
  queue.stage({ ...queue.current, answers: { q1: answer('A') } })
  await assert.rejects(queue.flush(), /Offline/)
  queue.stage({ ...queue.current, currentQuestionIndex: 1, answers: { ...queue.current.answers, q2: answer('B') } })
  assert.equal(queue.current.answers.q1.value, 'A')
  assert.equal(state.record.draft.answers.q2.value, 'B')
  fail = false
  await queue.flush()
  assert.equal(queue.current.revision, 2)
  assert.equal(queue.current.answers.q2.value, 'B')
  assert.equal(state.record, null)
  queue.stop()
})

test('a realtime-confirmed write with a dropped HTTP response continues newer work without a false error', async () => {
  const request = deferred(), writes = []
  const { queue, state } = setup(async (draft, revision) => {
    writes.push({ draft, revision })
    if (writes.length === 1) await request.promise
    return { ...draft, revision: revision + 1 }
  })
  queue.stage({ ...queue.current, answers: { q1: answer('A') } })
  const flush = queue.flush()
  queue.receive({ ...writes[0].draft, revision: 2 })
  queue.stage({ ...queue.current, answers: { q1: answer('B') } })
  request.reject(new Error('Response lost after confirmation'))
  await flush
  assert.deepEqual(writes.map(write => write.revision), [1, 2])
  assert.equal(queue.current.answers.q1.value, 'B')
  assert.equal(state.errors.length, 0)
  queue.stop()
})

test('reload recovers newer local work even when the last request was accepted before its response was lost', async () => {
  const a = { ...initial(), answers: { q1: answer('A') } }
  const b = { ...a, currentQuestionIndex: 1, answers: { ...a.answers, q2: answer('B') } }
  const writes = []
  const { queue, state } = setup(async (draft, revision) => {
    writes.push({ draft, revision })
    return { ...draft, revision: revision + 1 }
  }, { version: 1, draft: b, baseRevision: 1, sent: { draft: a, baseRevision: 1 } })
  state.remote = { ...a, revision: 2 }
  await queue.flush()
  assert.equal(writes.length, 1)
  assert.equal(writes[0].revision, 2)
  assert.equal(writes[0].draft.answers.q2.value, 'B')
  assert.equal(queue.current.revision, 3)
  queue.stop()
})

test('a confirmed request with a lost response is not submitted twice on retry', async () => {
  let writes = 0
  const { queue, state } = setup(async (draft, revision) => {
    writes++
    state.remote = { ...draft, revision: revision + 1 }
    throw new Error('Response lost')
  })
  queue.stage({ ...queue.current, answers: { q1: answer('A') } })
  await assert.rejects(queue.flush(), /Response lost/)
  await queue.flush()
  assert.equal(writes, 1)
  assert.equal(queue.current.revision, 2)
  assert.equal(queue.hasPending, false)
  queue.stop()
})

test('final submission drains the latest answers after the pending save before completing', async () => {
  const request = deferred(), writes = []
  const { queue } = setup(async (draft, revision) => {
    writes.push({ draft, revision })
    if (writes.length === 1) await request.promise
    return { ...draft, revision: revision + 1 }
  })
  queue.stage({ ...queue.current, answers: { q1: answer('A') } })
  const flush = queue.flush()
  queue.stage({ ...queue.current, answers: { ...queue.current.answers, q2: answer('B') }, status: 'completed' })
  const final = queue.flush()
  assert.equal(final, flush)
  request.resolve()
  const saved = await final
  assert.equal(saved.status, 'completed')
  assert.equal(saved.answers.q2.value, 'B')
  assert.equal(writes.length, 2)
  assert.equal(writes[1].draft.status, 'completed')
  queue.stop()
})

test('separate account draft keys and rejected revisions preserve server concurrency safeguards', async () => {
  assert.notEqual(sessionDraftKey('alice', 'session'), sessionDraftKey('bob', 'session'))
  const { queue, state } = setup(async (_draft, revision) => {
    assert.equal(revision, 1)
    throw new Error('This session changed on another device.')
  })
  queue.stage({ ...queue.current, answers: { q1: answer('local work') } })
  queue.receive({ ...initial(), revision: 4, answers: { q1: answer('other device') } })
  state.remote = { ...initial(), revision: 4 }
  await assert.rejects(queue.flush(), /another device/)
  assert.equal(queue.current.answers.q1.value, 'local work')
  assert.equal(state.record.baseRevision, 1)
  queue.stop()
})

test('the player has no save-status label or network wait in its answer and navigation handlers', async () => {
  const source = await readFile('src/components/quiz-player.tsx', 'utf8')
  assert.doesNotMatch(source, /Saving…|savingLabel|CloudCheck|\bdirty\b|await save\(/)
  assert.match(source, /function respond\(/)
  assert.match(source, /function navigate\(/)
  assert.match(source, /stageSession\(next\)/)
})
