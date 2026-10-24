import { getApp, getApps, initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectDatabaseEmulator, getDatabase } from 'firebase/database'

// Firebase web configuration is intentionally public, not an administrator credential.
// Next.js inlines these public identifiers at build time. Private Admin credentials stay server-side.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
}

export function firebaseServices() {
  if (!firebaseConfig.apiKey || !firebaseConfig.databaseURL || !firebaseConfig.projectId)
    throw new Error('Firebase configuration is missing. Configure the public Firebase environment variables and rebuild.')
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig)
  const auth = getAuth(app), database = getDatabase(app)
  if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_CFMS_EMULATORS === 'true' && !auth.emulatorConfig) {
    connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true})
    connectDatabaseEmulator(database,'127.0.0.1',9000)
  }
  return { auth, database }
}

export function friendlyError(error: unknown): string {
  const code = (error as { code?: string })?.code ?? ''
  const messages: Record<string, string> = {
    'auth/invalid-credential': 'That email and password combination isn’t right. Please try again.',
    'auth/user-not-found': 'That email and password combination isn’t right. Please try again.',
    'auth/wrong-password': 'That email and password combination isn’t right. Please try again.',
    'auth/email-already-in-use': 'An account already uses this email. Try signing in instead.',
    'auth/weak-password': 'Please choose a stronger password with at least 8 characters.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/too-many-requests': 'Too many attempts. Please wait a little before trying again.',
    'auth/network-request-failed':
      'We couldn’t reach Firebase. Check your connection and try again.',
    'auth/operation-not-allowed':
      'Email/password sign-in is not enabled for this Firebase project.',
    'auth/unauthorized-domain': 'This preview domain is not authorized in Firebase Authentication.',
    'auth/requires-recent-login':
      'For your security, please sign out and sign in again before changing your password.',
    PERMISSION_DENIED:
      'Firebase denied access. Check the Realtime Database rules for your account.',
    'permission-denied':
      'Firebase denied access. Check the Realtime Database rules for your account.',
  }
  if (messages[code]) return messages[code]
  if (error instanceof Error && /permission_denied/i.test(error.message))
    return messages.PERMISSION_DENIED
  return error instanceof Error
    ? error.message
    : 'Something went wrong. Your changes were not confirmed. Please try again.'
}
