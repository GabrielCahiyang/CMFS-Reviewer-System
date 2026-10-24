import { onValue, ref, runTransaction, set, update, query, orderByChild, limitToLast, endBefore, get } from 'firebase/database'
import { firebaseServices } from './firebase'
import { StudySession, UserData } from './study-models'

export function listenToPath<T>(
  path: string,
  onData: (data: T | null) => void,
  onError: (error: Error) => void,
) {
  return onValue(
    ref(firebaseServices().database, `cfms/${path}`),
    (snapshot) => onData(snapshot.val() as T | null),
    onError,
  )
}

export function listenToRecentSessions(uid: string, onData: (sessions: Record<string, StudySession>) => void, onError: (error: Error) => void) {
  return onValue(query(ref(firebaseServices().database, `cfms/users/${uid}/sessions`), orderByChild('updatedAt'), limitToLast(100)),
    (snapshot) => onData(snapshot.val() ?? {}), onError)
}
export async function olderSessions(uid: string, before: number, beforeKey?: string) {
  const snapshot = await get(query(ref(firebaseServices().database, `cfms/users/${uid}/sessions`),
    orderByChild('updatedAt'), endBefore(before, beforeKey), limitToLast(100)))
  return snapshot.val() as Record<string, StudySession> | null
}

export async function initializeProfile(uid: string, displayName: string, email: string) {
  const now = Date.now()
  await runTransaction(
    ref(firebaseServices().database, `cfms/users/${uid}/profile`),
    (current) => current || { displayName, email, createdAt: now, updatedAt: now },
  )
}

export async function writeUserPath(uid: string, path: string, value: unknown) {
  await set(ref(firebaseServices().database, `cfms/users/${uid}/${path}`), value)
}

export async function updateUserPaths(uid: string, updates: Record<string, unknown>) {
  await update(ref(firebaseServices().database, `cfms/users/${uid}`), updates)
}

export async function saveSession(uid: string, session: StudySession, expectedRevision: number) {
  const user = firebaseServices().auth.currentUser
  if (!user || user.uid !== uid || session.revision !== expectedRevision+1) throw new Error('Invalid save request.')
  const response = await fetch('/api/study/sessions', { method:'POST',headers:{ Authorization:`Bearer ${await user.getIdToken()}`,'Content-Type':'application/json' },body:JSON.stringify(session),signal:AbortSignal.timeout(20000) })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Your session could not be saved.')
  return { ...result.session, answers: result.session.answers ?? {} } as StudySession
}

export function normalizeUserData(value: Partial<UserData> | null): UserData {
  return {
    profile: value?.profile,
    sessions: value?.sessions ?? {},
    bookmarks: value?.bookmarks ?? {},
    flashcardProgress: value?.flashcardProgress ?? {},
    preferences: {
      theme: 'light',
      defaultStudyMode: 'practice',
      instantFeedback: true,
      showExplanations: true,
      ...value?.preferences,
    },
  }
}
