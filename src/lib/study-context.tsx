'use client'

import { createContext, ReactNode, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, onIdTokenChanged, signOut, User } from 'firebase/auth'
import { onValue, ref } from 'firebase/database'
import { sourceCategoryTitles } from './study-categories'
import { firebaseServices, friendlyError } from './firebase'
import {
  initializeProfile,
  listenToPath,
  listenToRecentSessions,
  olderSessions,
  normalizeUserData,
  saveSession,
  updateUserPaths,
  writeUserPath,
} from './firebase-study-service'
import {
  Category,
  emptyUserData,
  Preferences,
  Question,
  StudySession,
  UserData,
} from './study-models'
import { parseQuestions } from './question-schema'
import { clearActivityQueue, keepActivityFor, flushActivity, trackEvent } from './activity-tracker'

type SyncState = 'idle' | 'saving' | 'saved' | 'error'
interface StudyContextValue {
  user: User | null
  isAdmin: boolean
  claimsLoading: boolean
  authLoading: boolean
  categories: Category[]
  categoriesLoading: boolean
  dataLoading: boolean
  data: UserData
  error: string
  sync: SyncState
  connected: boolean | null
  activeSessionId: string | null
  setActiveSessionId: (id: string | null) => void
  loadQuestions: (categoryId: string, contentVersion?: string) => Promise<Question[]>
  loadOlderSessions: () => Promise<boolean>
  commitSession: (session: StudySession) => Promise<StudySession>
  toggleBookmark: (categoryId: string, questionId: string) => Promise<void>
  markCard: (categoryId: string, questionId: string, status: 'known' | 'again') => Promise<void>
  savePreferences: (preferences: Preferences) => Promise<void>
  editName: (name: string) => Promise<void>
  logout: () => Promise<void>
  retry: () => void
  clearError: () => void
}

const StudyContext = createContext<StudyContextValue | null>(null)
const activeSessionKey = (uid: string) => `cfms-active-session:${uid}`

export function StudyProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [claimsLoading, setClaimsLoading] = useState(true)
  const [authLoading, setAuthLoading] = useState(true)
  const [data, setData] = useState<UserData>(emptyUserData)
  const [categories, setCategories] = useState<Category[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(false)
  const [dataLoading, setDataLoading] = useState(false)
  const [error, setError] = useState('')
  const [sync, setSync] = useState<SyncState>('idle')
  const [connected, setConnected] = useState<boolean | null>(null)
  const [activeSessionId, setSessionId] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => onIdTokenChanged(firebaseServices().auth, async (current) => {
    setIsAdmin(false)
    setClaimsLoading(true)
    try {
      const result = await current?.getIdTokenResult()
      if (firebaseServices().auth.currentUser?.uid === current?.uid) setIsAdmin(result?.claims.cfmsAdmin === true)
    } catch { setIsAdmin(false) } finally { setClaimsLoading(false) }
  }), [])

  useEffect(() => {
    // Remove retired browser-only records; never read or migrate them into an account.
    try {
      localStorage.removeItem('cfms-demo-workspace-v1')
      localStorage.removeItem('cfms-workspace-mode-v1')
      localStorage.removeItem('cfms-active-session-v1')
    } catch {
      // Browser storage is optional. Firebase remains the only study-data source.
    }
    return onAuthStateChanged(
      firebaseServices().auth,
      (current) => {
        keepActivityFor(current?.uid)
        setUser(current)
        setData(emptyUserData())
        setCategories([])
        setDataLoading(!!current)
        setCategoriesLoading(!!current)
        setError('')
        setSync('idle')
        try {
          setSessionId(current ? localStorage.getItem(activeSessionKey(current.uid)) : null)
        } catch {
          setSessionId(null)
        }
        setAuthLoading(false)
      },
      (err) => {
        setUser(null)
        setData(emptyUserData())
        setCategories([])
        setError(friendlyError(err))
        setAuthLoading(false)
      },
    )
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', data.preferences.theme === 'dark')
  }, [data.preferences.theme])

  useEffect(() => {
    if (!user) {
      setConnected(null)
      return
    }
    return onValue(ref(firebaseServices().database, '.info/connected'), (snapshot) =>
      setConnected(snapshot.val() === true),
    )
  }, [user])

  useEffect(() => {
    if (!user) {
      setCategoriesLoading(false)
      setDataLoading(false)
      return
    }
    let active = true
    setCategoriesLoading(true)
    setDataLoading(true)
    setError('')
    let categoriesReceived = false
    let userReceived = false
    const failure = (err: Error) => {
      if (!active) return
      setError(friendlyError(err))
      setCategoriesLoading(false)
      setDataLoading(false)
    }
    const stopCategories = listenToPath<Record<string, Category>>(
      'categories',
      (value) => {
        if (!active) return
        categoriesReceived = true
        setCategories(
          Object.entries(value ?? {})
            .map(([id, category]) => ({ ...category, id }))
            .filter((category) => sourceCategoryTitles[category.id] === category.title),
        )
        setCategoriesLoading(false)
      },
      failure,
    )
    const received = new Set<string>()
    const stops = (['profile', 'preferences', 'bookmarks', 'flashcardProgress'] as const).map((part) =>
      listenToPath(`users/${user.uid}/${part}`, (value: unknown) => {
        if (!active) return
        received.add(part)
        setData((previous) => normalizeUserData({ ...previous, [part]: value ?? undefined }))
        if (received.size === 5) { userReceived = true; setDataLoading(false) }
      }, failure))
    stops.push(listenToRecentSessions(user.uid, (sessions) => {
      if (!active) return
      received.add('sessions')
      setData((previous) => ({ ...previous, sessions: { ...previous.sessions, ...sessions } }))
      if (received.size === 5) { userReceived = true; setDataLoading(false) }
    }, failure))
    // Keep a selected older session available without listening to the whole history.
    try {
      const selected = localStorage.getItem(activeSessionKey(user.uid))
      if (selected && /^[a-zA-Z0-9_-]+$/.test(selected)) stops.push(listenToPath<StudySession>(`users/${user.uid}/sessions/${selected}`, (value) => {
        if (active && value) setData((previous) => ({ ...previous, sessions: { ...previous.sessions, [selected]: value } }))
      }, failure))
    } catch { /* local selection is optional */ }
    const timeout = window.setTimeout(() => {
      if (!categoriesReceived || !userReceived)
        setError(
          'Firebase has not confirmed a data connection. You may be offline. No cloud save or empty question bank has been confirmed; retry when your connection is available.',
        )
      setCategoriesLoading(false)
      setDataLoading(false)
    }, 12000)
    initializeProfile(user.uid, user.displayName || 'Student', user.email || '').catch(failure)
    return () => {
      active = false
      stopCategories()
      stops.forEach((stop) => stop())
      clearTimeout(timeout)
    }
  }, [user, retryCount])

  function setActiveSessionId(id: string | null) {
    if (!user) return
    setSessionId(id)
    try {
      if (id) localStorage.setItem(activeSessionKey(user.uid), id)
      else localStorage.removeItem(activeSessionKey(user.uid))
    } catch {
      // Only the selected session ID is cached; session contents stay in Firebase.
    }
  }

  async function loadQuestions(categoryId: string, contentVersion?: string): Promise<Question[]> {
    if (!user) throw new Error('Please sign in to access your question banks.')
    const { get, ref } = await import('firebase/database')
    if (!/^[a-zA-Z0-9_-]+$/.test(categoryId) || (contentVersion && !/^[a-zA-Z0-9_-]+$/.test(contentVersion))) throw new Error('Invalid question version.')
    const path = contentVersion ? `questionBankVersions/${categoryId}/${contentVersion}/questions` : `questions/${categoryId}`
    const snapshot = await get(ref(firebaseServices().database, `cfms/${path}`))
    if (contentVersion && !snapshot.exists()) throw new Error('This session’s question version is unavailable. Please contact your administrator.')
    return parseQuestions(snapshot.val(), categoryId)
  }

  async function loadOlderSessions() {
    if (!user) return false
    const earliest = Object.values(data.sessions).sort((a,b) => a.updatedAt - b.updatedAt || a.id.localeCompare(b.id))[0]
    if (!earliest) return false
    const older = await olderSessions(user.uid, earliest.updatedAt, earliest.id)
    setData((previous) => ({ ...previous, sessions: { ...older, ...previous.sessions } }))
    return Object.keys(older ?? {}).length === 100
  }

  async function commitSession(session: StudySession): Promise<StudySession> {
    setSync('saving')
    setError('')
    const expectedRevision = session.revision
    let next = { ...session, revision: expectedRevision + 1, updatedAt: Date.now() }
    try {
      if (!user) throw new Error('You must sign in before saving a session.')
      next = await saveSession(user.uid, next, expectedRevision)
      setData((previous) => ({
        ...previous,
        sessions: { ...previous.sessions, [next.id]: next },
      }))
      setSync('saved')
      if (expectedRevision === 0) trackEvent('session_started', { sessionId: next.id, categoryId: next.categoryId }, `start_${next.id}`)
      if (next.status === 'completed') trackEvent('session_completed', { sessionId: next.id, categoryId: next.categoryId }, `complete_${next.id}`)
      else {
        const previous = data.sessions[next.id]
        for (const [questionId, answer] of Object.entries(next.answers ?? {})) {
          if (answer.status !== 'skipped' && JSON.stringify(answer) !== JSON.stringify(previous?.answers?.[questionId]))
            trackEvent(next.mode === 'flashcard' ? 'flashcard_reviewed' : 'answer_submitted', { sessionId: next.id, categoryId: next.categoryId, questionId }, `answer_${next.id}_${next.revision}_${questionId}`)
        }
      }
      return next
    } catch (err) {
      setSync('error')
      setError(friendlyError(err))
      throw err
    }
  }

  async function mutate(path: string, value: unknown) {
    setSync('saving')
    setError('')
    try {
      if (!user) throw new Error('Please sign in before saving changes.')
      await writeUserPath(user.uid, path, value)
      setSync('saved')
    } catch (err) {
      setSync('error')
      setError(friendlyError(err))
      throw err
    }
  }

  async function toggleBookmark(categoryId: string, questionId: string) {
    const marked = !data.bookmarks[categoryId]?.[questionId]
    await mutate(`bookmarks/${categoryId}/${questionId}`, marked ? true : null)
    trackEvent('bookmark_changed', { categoryId, questionId, action: marked ? 'added' : 'removed' })
  }

  async function markCard(categoryId: string, questionId: string, status: 'known' | 'again') {
    await mutate(`flashcardProgress/${categoryId}/${questionId}`, {
      status,
      lastReviewedAt: Date.now(),
    })
  }

  async function savePreferences(preferences: Preferences) {
    await mutate('preferences', preferences)
  }

  async function editName(name: string) {
    const trimmed = name.trim()
    if (!trimmed || trimmed.length > 100)
      throw new Error('Use a name between 1 and 100 characters.')
    if (!user) throw new Error('Please sign in first.')
    const { updateProfile } = await import('firebase/auth')
    await updateProfile(user, { displayName: trimmed })
    await updateUserPaths(user.uid, {
      'profile/displayName': trimmed,
      'profile/updatedAt': Date.now(),
    })
  }

  async function logout() {
    const uid = user?.uid
    trackEvent('auth_logout')
    await Promise.race([flushActivity(), new Promise((resolve) => setTimeout(resolve, 1000))])
    await signOut(firebaseServices().auth)
    clearActivityQueue()
    setData(emptyUserData())
    setCategories([])
    setSessionId(null)
    if (uid) {
      try {
        localStorage.removeItem(activeSessionKey(uid))
      } catch {
        /* Firebase sign-out is still confirmed. */
      }
    }
  }

  return (
    <StudyContext.Provider
      value={{
        user,
        isAdmin,
        claimsLoading,
        authLoading,
        categories,
        categoriesLoading,
        dataLoading,
        data,
        error,
        sync,
        connected,
        activeSessionId,
        setActiveSessionId,
        loadQuestions,
        loadOlderSessions,
        commitSession,
        toggleBookmark,
        markCard,
        savePreferences,
        editName,
        logout,
        retry: () => setRetryCount((c) => c + 1),
        clearError: () => setError(''),
      }}
    >
      {children}
    </StudyContext.Provider>
  )
}

export function useStudy() {
  const context = useContext(StudyContext)
  if (!context) throw new Error('StudyProvider is missing.')
  return context
}
