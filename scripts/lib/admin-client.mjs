import { existsSync } from 'node:fs'
import { applicationDefault, initializeApp } from 'firebase-admin/app'
import { getDatabase } from 'firebase-admin/database'
import { getAuth } from 'firebase-admin/auth'
import { createRequire } from 'node:module'
if (existsSync('.env')) process.loadEnvFile('.env')
export function trustedServices() {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
  if (projectId !== 'attendit-350c6' && !process.env.FIREBASE_DATABASE_EMULATOR_HOST) throw new Error('Unexpected Firebase project. Refusing operation.')
  if (!databaseURL) throw new Error('Missing database URL.')
  let credential = applicationDefault()
  if (process.env.CFMS_USE_FIREBASE_CLI === 'true') {
    const require = createRequire(import.meta.url)
    const cliAuth = require('firebase-tools/lib/auth.js')
    const account = cliAuth.getGlobalDefaultAccount()
    if (!account) throw new Error('Sign in with the Firebase CLI before using its trusted credential.')
    // Reuse the existing signed-in CLI identity in memory. Never print or persist its tokens.
    credential = { getAccessToken: async () => {
      await require('firebase-tools/lib/requireAuth.js').requireAuth({ project:projectId,user:account.user,tokens:account.tokens,nonInteractive:true })
      const token = await cliAuth.getAccessToken(account.tokens.refresh_token, require('firebase-tools/lib/api.js').getScopes())
      return { access_token: token.access_token, expires_in: token.expires_in || 3600 }
    } }
  }
  const app = initializeApp({ credential, projectId, databaseURL }, 'cfms-operations')
  return { database: getDatabase(app), auth: getAuth(app), app }
}
