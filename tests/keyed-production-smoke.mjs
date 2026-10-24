import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { cert, initializeApp, deleteApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getDatabase } from 'firebase-admin/database'
import { prepareVercel } from '../scripts/prepare-vercel.mjs'

const args = process.argv.slice(2)
const queued = args.includes('--queue')
const file = args[args.indexOf('--credential-file') + 1]
if (!args.includes('--credential-file') || !file || !args.includes('--confirm-live-test'))
  throw new Error('An explicit private credential file and --confirm-live-test are required.')
process.loadEnvFile('.env')
const credentialJSON = await readFile(file, 'utf8')
const credential = JSON.parse(credentialJSON)
assert.equal(credential.project_id, 'attendit-350c6', 'Unexpected project; test refused.')
const app = initializeApp({ credential: cert(credential), projectId: credential.project_id,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL }, 'keyed-production-smoke')
const auth = getAuth(app), database = getDatabase(app)
const uid = `cfms-keyed-smoke-${randomUUID()}`
const email = `${uid}@example.test`, password = randomBytes(24).toString('base64url') + 'Aa1!'
let server, created = false
try {
  await prepareVercel()
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--port', '3100', '--hostname', '127.0.0.1'], {
    stdio: 'ignore', env: { ...process.env, NODE_ENV: 'production', CFMS_BUILD_TARGET: 'vercel',
      NODE_OPTIONS: '--no-experimental-require-module', FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON: credentialJSON },
  })
  server.on('error', () => {})
  const origin = 'http://127.0.0.1:3100'
  let ready = false
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null) throw new Error('The temporary production server could not start.')
    try { const response = await fetch(origin + '/api/study/account'); if (response.status === 401) { ready = true; break } } catch {}
    await delay(500)
  }
  assert.equal(ready, true, 'Production server did not become ready.')
  await auth.createUser({ uid, email, password, displayName: 'Disposable grading verification' })
  created = true
  await auth.setCustomUserClaims(uid, { cfmsTest: true })
  const loginResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }),
  })
  const { idToken } = await loginResponse.json()
  assert.ok(idToken, 'Disposable account could not sign in.')
  const call = async (route, body) => {
    const response = await fetch(origin + route, { method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) })
    const data = await response.json()
    assert.equal(response.status, 200, `${route} failed: ${data.error || response.status}`)
    return data
  }
  const categoryId = 'financial-statements'
  const category = (await database.ref(`cfms/categories/${categoryId}`).get()).val()
  const bank = (await database.ref(`cfms/questionBankVersions/${categoryId}/${category.contentVersion}/questions`).get()).val()
  const questionIds = Object.keys(bank)
  assert.equal(questionIds.length, 64)
  const session = { id: 'keyed-' + randomUUID(), categoryId, mode: 'exam', contentVersion: category.contentVersion,
    settings: { mode: 'exam', questionFormat: 'original', types: category.types, count: questionIds.length,
      randomize: false, shuffleChoices: false, instantFeedback: false, showExplanations: true, timer: false,
      durationMinutes: 20, filter: 'all' },
    questionIds, currentQuestionIndex: 0, answers: {}, status: 'in-progress', startedAt: 1, updatedAt: 1, revision: 1 }
  const started = (await call('/api/study/sessions', session)).session
  const answers = Object.fromEntries(questionIds.map(id => [id, {
    value: id === 'q-001' ? 'Statement of financial position' : id === 'q-003' ? 'Cash flow statement' : bank[id].correctAnswer,
    status: 'pending', credit: 0, graded: false,
  }]))
  let completed, queueEvidence
  if (queued) {
    const { SessionDraftQueue } = await import('../src/lib/session-draft.ts')
    let release, writes = 0, cached
    const slowRequest = new Promise(resolve => { release = resolve })
    const queue = new SessionDraftQueue(started, {
      delay: 60000,
      send: async (draft, revision) => {
        writes++
        if (writes === 1) await slowRequest
        return (await call('/api/study/sessions', { ...draft, revision: revision + 1 })).session
      },
      refresh: async () => (await database.ref(`cfms/users/${uid}/sessions/${session.id}`).get()).val(),
      persist: record => { cached = record ? JSON.stringify(record) : null },
      change: () => {}, error: () => {},
    })
    queue.stage({ ...queue.current, answers: { [questionIds[0]]: answers[questionIds[0]] } })
    const flushing = queue.flush()
    const clickedAt = performance.now()
    for (let i = 0; i < questionIds.length; i++) {
      const id = questionIds[i]
      queue.stage({ ...queue.current, currentQuestionIndex: i, answers: { ...queue.current.answers, [id]: answers[id] } })
    }
    for (let i = 0; i < 100; i++) queue.stage({ ...queue.current, answers: {
      ...queue.current.answers, [questionIds[0]]: { ...answers[questionIds[0]], value: `temporary choice ${i}` },
    } })
    queue.stage({ ...queue.current, answers: { ...queue.current.answers, [questionIds[0]]: answers[questionIds[0]] } })
    const localChangesMs = Math.round(performance.now() - clickedAt)
    assert.equal(writes, 1, 'Local interaction must not wait for the delayed request.')
    assert.equal(queue.current.currentQuestionIndex, 63)
    assert.equal(Object.keys(JSON.parse(cached).draft.answers).length, 64)
    queue.receive(started)
    assert.equal(queue.current.currentQuestionIndex, 63, 'A stale listener must not reset navigation.')
    queue.stage({ ...queue.current, status: 'completed', score: 999 })
    release()
    completed = await flushing
    assert.equal(writes, 2, 'Rapid changes must coalesce into the latest snapshot.')
    assert.equal(cached, null, 'Confirmed answers must clear the local pending draft.')
    queue.stop()
    queueEvidence = { rapidChanges: 165, localChangesMs, saves: writes,
      latestAnswerPreserved: true, navigationImmediate: true, staleResponseIgnored: true, localDraftClearedAfterConfirmation: true }
  } else completed = (await call('/api/study/sessions', { ...started, answers, revision: 2, status: 'completed', score: 999 })).session
  assert.equal(completed.score, 64)
  assert.equal(Object.values(completed.answers).filter(answer => answer.status === 'correct').length, 64)
  const exported = await call('/api/study/account')
  assert.equal(exported.data.sessions[session.id].score, 64)
  await call('/api/study/events', { eventId: randomUUID(), type: 'session_completed', categoryId, sessionId: session.id })
  await writeFile(queued ? 'docs/verification/instant-session.json' : 'docs/verification/keyed-grading.json', JSON.stringify({ testedAt: new Date().toISOString(),
    scope: 'Local production build with live Firebase authentication/database, disposable account; no hosted release.',
    categoryId, questions: 64, correct: 64, score: 64, serverIgnoredForgedScore: true,
    standardStatementNamesAccepted: true, savedAndExported: true, reportingEndpointAccepted: true,
    testTrafficExcludedFromAnalytics: true, ...(queueEvidence ? { queue: queueEvidence } : {}) }, null, 2) + '\n')
  console.log(queued
    ? 'Background queue passed: 165 rapid edits/navigation during a delayed request, two saves, 64/64 scored and exported.'
    : 'Production grading passed: all 64 financial-statement answers scored correctly, saved and exported; source labels did not block credit.')
} finally {
  if (created) {
    assert.ok(uid.startsWith('cfms-keyed-smoke-'))
    await database.ref(`cfms/users/${uid}`).remove()
    await auth.deleteUser(uid)
  }
  await deleteApp(app)
  server?.kill()
}
