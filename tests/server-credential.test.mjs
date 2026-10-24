import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import { deleteApp, getApps } from 'firebase-admin/app'
import { adminServices } from '../src/lib/server/firebase-admin.ts'

test('hosting credentials initialize the matching Firebase project without exposing private input', async () => {
  const names = ['NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'NEXT_PUBLIC_FIREBASE_DATABASE_URL', 'FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON']
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]))
  try {
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'demo-cfms-credentials'
    process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL = 'https://demo-cfms-credentials-default-rtdb.firebaseio.com'
    const message = 'Invalid Firebase server credential. Check the private hosting environment variable.'
    for (const input of ['invalid-private-input', JSON.stringify({ project_id: 'wrong-project', private_key: 'private-input' })]) {
      process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON = input
      assert.throws(() => adminServices(), error => error.message === message && !error.message.includes(input))
    }
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
    process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON = JSON.stringify({
      project_id: 'demo-cfms-credentials',
      client_email: 'test@demo-cfms-credentials.iam.gserviceaccount.com',
      private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    })
    const { auth, database } = adminServices()
    assert.equal(auth.app.options.projectId, 'demo-cfms-credentials')
    assert.equal(database.app.options.projectId, 'demo-cfms-credentials')
  } finally {
    await Promise.all(getApps().filter(app => app.name === 'cfms-server').map(deleteApp))
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name]
      else process.env[name] = previous[name]
    }
  }
})
