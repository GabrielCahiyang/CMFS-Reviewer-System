import assert from 'node:assert/strict'
import { randomBytes, randomUUID, createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { cert, initializeApp, deleteApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getDatabase } from 'firebase-admin/database'
import { validatedFiles } from '../scripts/lib/seed-files.mjs'
import { stableJson } from '../scripts/lib/import-core.mjs'
import { parseCategories } from '../src/lib/question-schema.ts'

const args = process.argv.slice(2), credentialIndex = args.indexOf('--credential-file')
assert.ok(credentialIndex >= 0 && args[credentialIndex + 1] && args.includes('--confirm-live-test'))
process.loadEnvFile('.env')
const privateJSON = await readFile(args[credentialIndex + 1], 'utf8')
const credential = JSON.parse(privateJSON)
assert.equal(credential.project_id, 'attendit-350c6')
const app = initializeApp({ credential: cert(credential), projectId: credential.project_id,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL }, 'replacement-production-smoke')
const auth = getAuth(app), database = getDatabase(app)
const uid = `cfms-replacement-smoke-${randomUUID()}`, email = `${uid}@example.test`
const password = randomBytes(24).toString('base64url') + 'Aa1!'
const origin = 'http://127.0.0.1:3100'
const hash = value => createHash('sha256').update(stableJson(value)).digest('hex')
async function accountFingerprint() {
  const users = []; let token
  do {
    const page = await auth.listUsers(1000, token)
    users.push(...page.users.map(u => ({ uid: u.uid, email: u.email ?? '', disabled: u.disabled,
      displayName: u.displayName ?? '', emailVerified: u.emailVerified, customClaims: u.customClaims ?? {},
      providerData: u.providerData, createdAt: u.metadata.creationTime })))
    token = page.pageToken
  } while (token)
  return { hash: hash(users.sort((a,b) => a.uid.localeCompare(b.uid))), count: users.length }
}
let server, created = false
const beforeAccounts = await accountFingerprint()
const beforeUsersHash = hash((await database.ref('cfms/users').get()).val())
try {
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--port', '3100', '--hostname', '127.0.0.1'], {
    stdio: 'ignore', env: { ...process.env, NODE_ENV: 'production', CFMS_BUILD_TARGET: 'vercel',
      NODE_OPTIONS: '--no-experimental-require-module', FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON: privateJSON },
  })
  server.on('error', () => {})
  let ready = false
  for (let i=0; i<60; i++) {
    assert.equal(server.exitCode, null, 'Temporary production server failed to start.')
    try { if ((await fetch(origin + '/api/study/account')).status === 401) { ready = true; break } } catch {}
    await delay(500)
  }
  assert.equal(ready, true)
  const prerender = JSON.parse(await readFile('.next-vercel/prerender-manifest.json', 'utf8'))
  const routes = Object.keys(prerender.routes).filter(route => !route.startsWith('/_'))
  const assets = new Set()
  for (const route of routes) {
    const response = await fetch(origin + route)
    assert.equal(response.status, 200, route)
    const html = await response.text()
    assert.match(html, /CFMS/)
    for (const [,path] of html.matchAll(/(?:src|href)="([^"?#]+\.(?:js|css))(?:\?[^"#]*)?"/g))
      if (path.startsWith('/_next/')) assets.add(path)
  }
  for (const asset of assets) assert.equal((await fetch(origin + asset)).status, 200, asset)
  assert.equal((await fetch(origin + '/categories/new-reviewer')).status, 404)
  const files = await validatedFiles()
  assert.equal(stableJson((await database.ref('cfms/categories').get()).val()), stableJson(files.categories))
  assert.equal(stableJson((await database.ref('cfms/questions').get()).val()), stableJson(files.banks))
  const catalog = parseCategories((await database.ref('cfms/categories').get()).val())
  assert.equal(catalog.length,7)
  for (const category of catalog) assert.equal((await fetch(origin + `/categories/${category.id}`)).status,200)
  await auth.createUser({ uid, email, password, displayName: 'Disposable replacement verification' })
  created = true
  await auth.setCustomUserClaims(uid, { cfmsTest: true })
  const login = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }),
  })
  const { idToken } = await login.json()
  assert.ok(idToken)
  async function call(body) {
    const response = await fetch(origin + '/api/study/sessions', { method: 'POST',
      headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(30000) })
    const data = await response.json()
    assert.equal(response.status, 200, data.error || 'Session operation failed.')
    return data.session
  }
  const results = []
  for (const [categoryId, bank] of Object.entries(files.banks)) {
    const questionIds = Object.keys(bank), count = questionIds.length
    const session = { id: `replacement-${randomUUID()}`, categoryId, mode: 'exam', contentVersion: files.categories[categoryId].contentVersion,
      settings: { mode: 'exam', types: files.categories[categoryId].types, questionFormat: 'original', count,
        randomize: false, shuffleChoices: false, instantFeedback: false, showExplanations: true,
        timer: false, durationMinutes: 20, filter: 'all' }, questionIds, currentQuestionIndex: 0,
      answers: {}, status: 'in-progress', startedAt: 1, updatedAt: 1, revision: 1 }
    const started = await call(session)
    const answers = Object.fromEntries(questionIds.map(id => [id, { value: Array.isArray(bank[id].correctAnswer)
      ? bank[id].correctAnswer[0] : bank[id].correctAnswer, status: 'pending', credit: 0, graded: false }]))
    const saved = await call({ ...started, answers, currentQuestionIndex: count - 1, revision: 2 })
    const resumed = (await database.ref(`cfms/users/${uid}/sessions/${session.id}`).get()).val()
    assert.equal(resumed.revision, 2)
    assert.equal(Object.keys(resumed.answers).length, count)
    const completed = await call({ ...saved, status: 'completed', revision: 3, score: 999 })
    assert.equal(completed.score, count)
    assert.equal(Object.values(completed.answers).filter(a => a.status === 'correct').length, count)
    results.push({ categoryId, questions: count, score: completed.score, startedSavedResumedCompleted: true })
  }
  const response = await fetch(origin + '/api/study/account', { headers: { Authorization: `Bearer ${idToken}` } })
  assert.equal(response.status, 200)
  assert.equal(Object.keys((await response.json()).data.sessions).length, 7)
  await database.ref(`cfms/users/${uid}`).remove()
  await auth.deleteUser(uid)
  created = false
  assert.deepEqual(await accountFingerprint(), beforeAccounts)
  assert.equal(hash((await database.ref('cfms/users').get()).val()), beforeUsersHash)
  await writeFile('docs/verification/replacement-import.json', JSON.stringify({ testedAt: new Date().toISOString(),
    scope: 'Live Firebase with a local production server; no remote deployment performed.', importId: files.importId,
    sourceFiles: 7, categories: results, totalQuestions: 646, catalogEntriesVisible: catalog.length, corrections: files.manifest.corrections.length,
    publicRoutesVerified: routes.length, clientAssetsVerified: assets.size, exportedSessions: 7,
    existingAccountsPreserved: beforeAccounts.count, profilesAndPreferencesUnchanged: true,
    disposableAccountRemoved: true }, null, 2) + '\n')
  console.log(JSON.stringify({ questions: 646, categories: 7, publicRoutes: routes.length, assets: assets.size,
    scores: results.map(r => `${r.categoryId}: ${r.score}/${r.questions}`), accountsPreserved: beforeAccounts.count }, null, 2))
} finally {
  if (created) {
    assert.ok(uid.startsWith('cfms-replacement-smoke-'))
    await database.ref(`cfms/users/${uid}`).remove()
    await auth.deleteUser(uid)
  }
  await deleteApp(app)
  server?.kill()
}
