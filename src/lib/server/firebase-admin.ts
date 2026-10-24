import 'server-only'
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getDatabase } from 'firebase-admin/database'
import { createRequire } from 'node:module'

function serverCredential() {
  // Local development can reuse an explicitly enabled, already signed-in Firebase CLI.
  // Production always uses its attached Application Default Credential identity.
  if (process.env.NODE_ENV === 'development' && process.env.CFMS_USE_FIREBASE_CLI === 'true') {
    const externalRequire = createRequire(import.meta.url)
    const cliAuth = externalRequire('firebase-tools/lib/auth.js')
    return { getAccessToken: async () => {
      const account = cliAuth.getGlobalDefaultAccount()
      if (!account) throw new Error('Sign in with the Firebase CLI to run the local study server.')
      await externalRequire('firebase-tools/lib/requireAuth.js').requireAuth({project:process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,user:account.user,tokens:account.tokens,nonInteractive:true})
      const token = await cliAuth.getAccessToken(account.tokens.refresh_token,externalRequire('firebase-tools/lib/api.js').getScopes())
      return {access_token:token.access_token,expires_in:token.expires_in || 3600}
    } }
  }
  return applicationDefault()
}

export function adminServices() {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
  if (!projectId || !databaseURL) throw new Error('Firebase server configuration unavailable.')
  // Application Default Credentials, supplied by the hosting runtime. Never sent to the browser.
  const app = getApps().find((a) => a.name === 'cfms-server') ?? initializeApp({
    credential: serverCredential(), projectId, databaseURL,
  }, 'cfms-server')
  return { auth: getAuth(app), database: getDatabase(app) }
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message) }
}
export async function authenticate(request: Request, admin = false) {
  const header = request.headers.get('authorization') ?? ''
  if (!header.startsWith('Bearer ')) throw new HttpError(401, 'Please sign in.')
  let token
  try { token = await adminServices().auth.verifyIdToken(header.slice(7), true) }
  catch (error) {
    const code = (error as { code?: string }).code ?? ''
    if (process.env.NODE_ENV === 'development') console.warn('Study authentication check:', code || 'server-unavailable',
      (error instanceof Error ? error.message.split('Raw server response:')[0] : '').replace(/eyJ[A-Za-z0-9_.-]+/g, '[redacted]').slice(0,300))
    if (['auth/id-token-expired','auth/id-token-revoked','auth/argument-error','auth/invalid-id-token','auth/user-not-found','auth/user-disabled'].includes(code))
      throw new HttpError(401, 'Your sign-in expired. Please sign in again.')
    throw new HttpError(503, 'Study services are unavailable. Please try again later.')
  }
  if (admin && token.cfmsAdmin !== true) throw new HttpError(403, 'Administrator access required.')
  return token
}
export function apiError(error: unknown) {
  const status = error instanceof HttpError ? error.status : 503
  const message = error instanceof HttpError ? error.message : 'Study services are unavailable. Please try again later.'
  return Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } })
}
