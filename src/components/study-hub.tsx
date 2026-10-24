'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  Bell,
  BookOpen,
  Bookmark,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  CloudCheck,
  Command,
  GraduationCap,
  History,
  LayoutDashboard,
  Layers,
  Loader2,
  LogIn,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  Target,
  UserRound,
  X,
} from 'lucide-react'
import { useStudy } from '@/lib/study-context'
import { Category, StudyMode } from '@/lib/study-models'
import { Button, EmptyState, Input, Modal } from './ui'
import { Dashboard } from './dashboard'
import { CategoryDetail } from './category-detail'
import { SessionSettingsModal } from './session-settings'
import { QuizPlayer } from './quiz-player'
import { SessionResults } from './results'
import { SessionHistory } from './history'
import { SavedQuestions } from './saved-questions'
import { Account } from './account'
import { AuthScreen } from './auth-screen'
import { AnalyticsDashboard } from './admin/analytics-dashboard'
import { ActivityNotice } from './activity-notice'

const navigation = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'categories', label: 'Study categories', icon: BookOpen },
  { id: 'flashcards', label: 'Flashcards', icon: Layers },
  { id: 'mistakes', label: 'Review mistakes', icon: Target },
  { id: 'bookmarks', label: 'Bookmarks', icon: Bookmark },
  { id: 'history', label: 'Session history', icon: History },
]
const accountNav = [
  { id: 'profile', label: 'My profile', icon: UserRound },
  { id: 'settings', label: 'Settings', icon: Settings },
]
const authPages = new Set(['login', 'register', 'forgot-password'])

export function StudyHub({ page = 'dashboard' }: { page?: string }) {
  const router = useRouter()
  const study = useStudy()
  const {
    user,
    isAdmin,
    authLoading,
    categories,
    data,
    error,
    dataLoading,
    categoriesLoading,
    sync,
    logout,
    savePreferences,
  } = study
  const [startCategory, setStartCategory] = useState<Category | null>(null)
  const [startIds, setStartIds] = useState<string[] | undefined>()
  const [startMode, setStartMode] = useState<StudyMode | undefined>()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState(false)
  const [help, setHelp] = useState(false)
  const [actionError, setActionError] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const isAuth = authPages.has(page)
  const categoryPage = page.startsWith('categories/')
  const selectedCategory = categoryPage
    ? categories.find((c) => c.id === page.split('/')[1])
    : undefined
  const current = categoryPage ? 'categories' : page
  const title =
    [...navigation, ...accountNav].find((n) => n.id === current)?.label ||
    (current.startsWith('study-admin') ? 'Administration' : current === 'study' ? 'Study session' : 'Session results')
  const displayName = data.profile?.displayName || user?.displayName || 'Student'
  const initials = displayName
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
  const bookmarkCount = Object.values(data.bookmarks).reduce(
    (sum, group) => sum + Object.values(group).filter(Boolean).length,
    0,
  )
  const unfinishedCount = Object.values(data.sessions).filter(
    (s) => s.status === 'in-progress',
  ).length

  useEffect(() => {
    if (!authLoading && !user && !isAuth) router.replace('/login')
  }, [user, authLoading, isAuth, router])
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])
  useEffect(() => {
    setMobileOpen(false)
    setSearch('')
  }, [page])

  function openStart(category: Category, ids?: string[], mode?: StudyMode) {
    setStartIds(ids)
    setStartMode(mode)
    setStartCategory(category)
  }
  async function signout() {
    try {
      await logout()
      router.replace('/login')
    } catch {
      setActionError('Sign out could not be confirmed. Please try again.')
    }
  }
  async function toggleTheme() {
    try {
      await savePreferences({
        ...data.preferences,
        theme: data.preferences.theme === 'dark' ? 'light' : 'dark',
      })
    } catch {
      setActionError('The theme preference wasn’t saved. Check your connection and retry.')
    }
  }

  if (isAuth)
    return <AuthScreen key={page} screen={page as 'login' | 'register' | 'forgot-password'} />
  if (authLoading || !user)
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas text-subtle">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-primary text-on-primary">
          <BookOpen size={28} />
        </span>
        <Loader2 size={18} className="animate-spin text-primary" />
        <p className="text-xs">Loading…</p>
      </main>
    )

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      {mobileOpen && (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        aria-label="Main navigation"
        className={`fixed inset-y-0 left-0 z-50 flex w-58 flex-col border-r border-line bg-surface transition-transform duration-200 lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <button
          className="flex h-21 shrink-0 items-center gap-2.5 border-b border-line px-6 text-left"
          onClick={() => router.push('/dashboard')}
        >
          <span className="relative flex size-9 items-center justify-center rounded-xl bg-primary text-on-primary shadow-sm shadow-primary/20">
            <BookOpen size={21} strokeWidth={1.7} />
            <span className="absolute -right-1 -top-1 size-2.5 rounded-full border-2 border-surface bg-primary" />
          </span>
          <span>
            <strong className="block font-display text-[15px] leading-5 font-extrabold tracking-tight">
              CFMS <span className="font-semibold text-primary">Study Hub</span>
            </strong>
            <span className="mt-0.5 block text-[8px] tracking-wide text-subtle">
              FINANCIAL MANAGEMENT
            </span>
          </span>
        </button>
        <div className="flex-1 overflow-y-auto px-4 pt-7">
          <p className="mb-3 px-3 text-[9px] font-semibold tracking-[.13em] text-faint">
            YOUR WORKSPACE
          </p>
          <nav className="space-y-1">
            {navigation.map((item) => (
              <button
                key={item.id}
                onClick={() => router.push(`/${item.id}`)}
                aria-current={current === item.id ? 'page' : undefined}
                className={`group flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-[12px] transition-colors ${current === item.id ? 'bg-primary-soft font-semibold text-primary' : 'text-subtle hover:bg-canvas hover:text-ink'}`}
              >
                <item.icon size={18} strokeWidth={1.65} />
                <span className="flex-1">{item.label}</span>
                {item.id === 'bookmarks' && bookmarkCount > 0 ? (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[9px]">{bookmarkCount}</span>
                ) : item.id === 'history' && unfinishedCount > 0 ? (
                  <span className="rounded bg-warning-soft px-1.5 py-0.5 text-[9px] text-warning">
                    {unfinishedCount}
                  </span>
                ) : current === item.id ? (
                  <span className="mr-1 size-1.5 rounded-full bg-primary" />
                ) : null}
              </button>
            ))}
          </nav>
          <p className="mb-3 mt-8 px-3 text-[9px] font-semibold tracking-[.13em] text-faint">
            PERSONAL
          </p>
          <nav className="space-y-1">
            {isAdmin && <button onClick={() => router.push('/study-admin')} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-[12px] text-primary"><ShieldCheck size={18} />Administration</button>}
            {accountNav.map((item) => (
              <button
                key={item.id}
                onClick={() => router.push(`/${item.id}`)}
                aria-current={current === item.id ? 'page' : undefined}
                className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-[12px] transition-colors ${current === item.id ? 'bg-primary-soft font-semibold text-primary' : 'text-subtle hover:bg-canvas hover:text-ink'}`}
              >
                <item.icon size={18} strokeWidth={1.65} />
                {item.label}
              </button>
            ))}
            <button
              onClick={signout}
              className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-[12px] text-subtle transition-colors hover:bg-danger-soft hover:text-danger"
            >
              <LogOut size={18} strokeWidth={1.65} />
              Log out
            </button>
          </nav>
        </div>
        <div className="mx-5 mb-5 mt-8 rounded-xl border border-primary/10 bg-primary-soft/55 p-4">
          <span className="mb-3 flex size-8 items-center justify-center rounded-lg bg-surface text-primary">
            <GraduationCap size={18} strokeWidth={1.5} />
          </span>
          <p className="font-display text-xs font-bold text-ink">Study tools</p>
          <p className="mt-2 text-[10px] leading-5 text-subtle">
            Practice and review.
            <br />
            Resume saved sessions.
          </p>
          <button
            onClick={() => setHelp(true)}
            className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold text-primary"
          >
            A smarter way to study
            <ArrowRight size={11} />
          </button>
        </div>
        <button
          className="flex items-center gap-3 border-t border-line p-5 text-left"
          onClick={() => router.push('/profile')}
        >
          <span className="flex size-9 items-center justify-center rounded-full border-3 border-primary-soft bg-primary/15 text-[11px] font-bold text-primary">
            {initials}
          </span>
          <span className="flex-1">
            <span className="block text-xs font-semibold">{displayName}</span>
            <span className="mt-1 block text-[9px] text-subtle">CFMS in the making</span>
          </span>
          <ChevronDown size={14} className="text-faint" />
        </button>
      </aside>
      <div className="lg:ml-58">
        <header className="sticky top-0 z-30 flex h-21 items-center justify-between gap-4 border-b border-line bg-surface/95 px-5 backdrop-blur-lg sm:px-8">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              className="min-h-8 p-1 lg:hidden"
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={22} />
            </Button>
            <span className="hidden items-center gap-2.5 text-[11px] text-faint sm:flex">
              <span>Workspace</span>
              <ChevronRight size={12} />
              <span className="font-medium text-ink">{title}</span>
            </span>
            <span className="font-display text-sm font-bold sm:hidden">CFMS Study Hub</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="relative hidden sm:block">
              <Search size={14} className="absolute left-3 top-3 text-faint" />
              <Input
                ref={searchRef}
                aria-label="Search reviewers"
                placeholder="Search your study space…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="min-h-9 w-60 bg-canvas py-2 pl-9 pr-12 text-[10px]"
              />
              <span className="absolute right-2.5 top-2.5 flex items-center gap-0.5 rounded border border-line px-1 text-[8px] text-faint">
                <Command size={9} />K
              </span>
              {search && (
                <div className="absolute right-0 top-12 w-80 rounded-xl border border-line bg-surface p-2 shadow-xl">
                  {categories
                    .filter((c) =>
                      `${c.title} ${c.description}`.toLowerCase().includes(search.toLowerCase()),
                    )
                    .map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          router.push(`/categories/${c.id}`)
                          setSearch('')
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-3 text-left text-xs hover:bg-primary-soft"
                      >
                        <BookOpen size={14} className="text-primary" />
                        {c.title}
                      </button>
                    ))}
                  {!categories.some((c) =>
                    `${c.title} ${c.description}`.toLowerCase().includes(search.toLowerCase()),
                  ) && (
                    <p className="px-3 py-5 text-xs text-subtle">
                      No reviewers found. Try “capital” or “statements”.
                    </p>
                  )}
                </div>
              )}
            </div>
            <button
              aria-label={
                data.preferences.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
              }
              onClick={toggleTheme}
              disabled={sync === 'saving'}
              className="rounded-lg p-1.5 text-subtle transition-colors hover:bg-muted hover:text-primary"
            >
              {data.preferences.theme === 'dark' ? (
                <Sun size={18} strokeWidth={1.6} />
              ) : (
                <Moon size={18} strokeWidth={1.6} />
              )}
            </button>
            <button
              aria-label="Study updates"
              onClick={() => setNotice(true)}
              className="relative rounded-lg p-1.5 text-subtle hover:bg-muted"
            >
              <Bell size={18} strokeWidth={1.6} />
            </button>
            <span className="hidden h-6 w-px bg-line sm:block" />
            <button
              aria-label="Open your profile"
              onClick={() => router.push('/profile')}
              className="flex items-center gap-2"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-primary-soft text-[10px] font-bold text-primary">
                {initials}
              </span>
              <ChevronDown size={12} className="hidden text-faint sm:block" />
            </button>
          </div>
        </header>
        <main id="main-content" className="mx-auto max-w-400 p-5 sm:p-8 xl:px-9 xl:py-7">
          {study.connected === false && (
            <div
              role="status"
              className="mb-5 rounded-lg border border-warning/20 bg-warning-soft p-3 text-xs leading-6 text-warning"
            >
              Firebase is not currently connected. Cloud writes may remain pending until
              reconnection. Keep this tab open while a save is in progress; no cloud save is
              confirmed yet.
            </div>
          )}
          {(error || actionError) && (
            <div
              role="alert"
              className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/20 bg-danger-soft p-4 text-xs leading-6 text-danger"
            >
              <span>{actionError || error}</span>
              <div className="flex gap-3">
                <button
                  className="font-semibold underline"
                  onClick={() => {
                    setActionError('')
                    study.retry()
                  }}
                >
                  Retry
                </button>
                <button
                  aria-label="Dismiss error"
                  onClick={() => {
                    setActionError('')
                    study.clearError()
                  }}
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          )}
          {dataLoading ? (
            <div className="flex min-h-96 flex-col items-center justify-center gap-3 text-subtle">
              <Loader2 className="animate-spin text-primary" />
              <p className="text-xs">Syncing your personal study space…</p>
            </div>
          ) : page.startsWith('study-admin') ? (
            <AnalyticsDashboard page={page} />
          ) : page === 'dashboard' ? (
            <><ActivityNotice /><Dashboard onStart={openStart} /></>
          ) : page === 'categories' ? (
            <Dashboard libraryOnly onStart={openStart} />
          ) : page === 'flashcards' ? (
            <Dashboard flashcardsOnly onStart={openStart} />
          ) : categoryPage ? (
            selectedCategory ? (
              <CategoryDetail category={selectedCategory} onStart={openStart} />
            ) : categoriesLoading ? (
              <p className="py-20 text-center text-sm text-subtle">Loading reviewer…</p>
            ) : (
              <EmptyState
                icon={<BookOpen />}
                title="This reviewer isn’t available yet"
                description="This reviewer is not available yet. Return to the library or contact your administrator."
                action={<Button onClick={() => router.push('/categories')}>Back to library</Button>}
              />
            )
          ) : page === 'study' ? (
            <QuizPlayer />
          ) : page === 'results' ? (
            <SessionResults onStart={openStart} />
          ) : page === 'history' ? (
            <SessionHistory />
          ) : page === 'bookmarks' ? (
            <SavedQuestions onStart={openStart} />
          ) : page === 'mistakes' ? (
            <SavedQuestions mistakes onStart={openStart} />
          ) : page === 'profile' ? (
            <Account />
          ) : page === 'settings' ? (
            <Account settings />
          ) : null}
        </main>
      </div>
      {startCategory && (
        <SessionSettingsModal
          category={startCategory}
          questionIds={startIds}
          initialMode={startMode || (page === 'flashcards' ? 'flashcard' : undefined)}
          onClose={() => setStartCategory(null)}
        />
      )}
      {notice && (
        <Modal title="Your study updates" onClose={() => setNotice(false)}>
          <div className="p-6">
            <EmptyState
              icon={<Bell />}
              title="You’re all caught up."
              description={
                unfinishedCount
                  ? `You have ${unfinishedCount} unfinished session${unfinishedCount > 1 ? 's' : ''} waiting in your history. Pick up exactly where you left off.`
                  : 'No new updates. Choose a reviewer to start studying.'
              }
              action={
                <Button
                  onClick={() => {
                    setNotice(false)
                    router.push(unfinishedCount ? '/history' : '/categories')
                  }}
                >
                  {unfinishedCount ? 'Resume studying' : 'Explore reviewers'}
                  <ArrowRight size={14} />
                </Button>
              }
            />
          </div>
        </Modal>
      )}
      {help && (
        <Modal title="How to use the reviewer" onClose={() => setHelp(false)}>
          <div className="space-y-5 p-6">
            {[
              [
                'Choose a reviewer',
                'Each of the six categories maps to an independent source document.',
              ],
              [
                'Make it your session',
                'Pick practice, exam, mixed formats, or self-assessed flashcards. Only supported formats are available.',
              ],
              [
                'Take it one question at a time',
                'Use feedback to understand the why. Bookmark concepts to revisit.',
              ],
              [
                'Come back to your progress',
                'Resume unfinished sessions from your history.',
              ],
            ].map(([label, description], i) => (
              <div key={label} className="flex gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-xs font-bold text-primary">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-sm font-semibold">{label}</h3>
                  <p className="mt-1 text-xs leading-6 text-subtle">{description}</p>
                </div>
              </div>
            ))}
            <Button className="w-full" onClick={() => setHelp(false)}>
              I’m ready to learn
              <ArrowRight size={14} />
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
