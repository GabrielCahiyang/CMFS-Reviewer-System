'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { sendPasswordResetEmail } from 'firebase/auth'
import {
  BookOpen,
  CheckCircle2,
  KeyRound,
  LogOut,
  Mail,
  Moon,
  Save,
  ShieldCheck,
  Sun,
  UserRound,
} from 'lucide-react'
import { useStudy } from '@/lib/study-context'
import { firebaseServices, friendlyError } from '@/lib/firebase'
import { Preferences, reviewedQuestionCount, sessionStats } from '@/lib/study-models'
import { CategoryIcon } from './category-card'
import { Button, Input, Progress, Select, Toggle } from './ui'

export function Account({ settings = false }: { settings?: boolean }) {
  const { user, data, categories, editName, savePreferences, logout } = useStudy()
  const router = useRouter()
  const [name, setName] = useState(data.profile?.displayName || user?.displayName || '')
  const [preferences, setPreferences] = useState<Preferences>(data.preferences)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    setPreferences(data.preferences)
  }, [data.preferences])
  useEffect(() => {
    setName(data.profile?.displayName || user?.displayName || '')
  }, [data.profile?.displayName, user?.displayName])
  const sessions = Object.values(data.sessions).filter((s) => s.status === 'completed')
  const total = sessions.reduce((n, s) => n + s.questionIds.length - sessionStats(s).skipped, 0)
  const graded = sessions.filter((session) => session.mode !== 'flashcard')
  const gradedTotal = graded.reduce((n, s) => n + s.questionIds.length, 0)
  const credit = graded.reduce((n, s) => n + sessionStats(s).score, 0)
  async function run(action: () => Promise<void>, success: string) {
    setBusy(true)
    setMessage('')
    setError('')
    try {
      await action()
      setMessage(success)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }
  function saveName(event: FormEvent) {
    event.preventDefault()
    run(() => editName(name), 'Your display name has been updated.')
  }
  return (
    <div className="page-enter mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-[27px] font-extrabold tracking-tight text-ink">
          {settings ? 'Make yourself at home.' : 'The person behind the progress.'}
        </h1>
        <p className="mt-2 text-xs text-subtle">
          {settings
            ? 'A study space that works the way you do.'
            : 'Manage your profile and study preferences.'}
        </p>
      </div>
      {message && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-xl bg-success-soft p-4 text-xs text-success"
        >
          <CheckCircle2 size={16} />
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-danger-soft p-4 text-xs leading-6 text-danger">
          {error}
        </p>
      )}
      {!settings && (
        <>
          <section className="rounded-2xl border border-line bg-surface p-6">
            <div className="flex flex-wrap items-center gap-5">
              <span className="flex size-18 items-center justify-center rounded-2xl border-4 border-primary/10 bg-primary-soft font-display text-2xl font-bold text-primary">
                {(name || 'Student')
                  .split(' ')
                  .slice(0, 2)
                  .map((n) => n[0])
                  .join('')}
              </span>
              <div>
                <h2 className="font-display text-xl font-extrabold text-ink">
                  {data.profile?.displayName || user?.displayName || 'Student'}
                </h2>
                <p className="mt-2 flex items-center gap-2 text-xs text-subtle">
                  <Mail size={13} />
                  {user?.email}
                </p>
                <p className="mt-2 text-[10px] text-subtle">
                  Member since{' '}
                  {new Date(
                    data.profile?.createdAt || user?.metadata.creationTime || Date.now(),
                  ).toLocaleDateString(undefined, {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-3 divide-x divide-line border-t border-line pt-6">
              {[
                [sessions.length, 'Sessions complete'],
                [total, 'Questions practiced'],
                [`${Math.round((credit / Math.max(gradedTotal, 1)) * 100)}%`, 'Quiz accuracy'],
              ].map(([value, label]) => (
                <div key={label} className="text-center">
                  <p className="font-display text-2xl font-extrabold text-ink">{value}</p>
                  <p className="mt-2 text-[10px] text-subtle">{label}</p>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-xl border border-line bg-surface p-6">
            <h2 className="mb-5 flex items-center gap-2 text-sm font-bold text-ink">
              <UserRound size={17} className="text-primary" />
              Personal information
            </h2>
            <form
              onSubmit={saveName}
              className="flex flex-col items-start gap-4 sm:flex-row sm:items-end"
            >
              <label className="flex-1 text-xs font-semibold text-ink">
                Display name
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                  required
                  className="mt-2"
                />
              </label>
              <Button type="submit" busy={busy}>
                <Save size={14} />
                Save name
              </Button>
            </form>
            <p className="mt-3 text-[10px] text-subtle">
              Only non-sensitive information is stored in your Realtime Database profile.
            </p>
          </section>
          <section className="rounded-xl border border-line bg-surface p-6">
            <h2 className="mb-6 flex items-center gap-2 text-sm font-bold text-ink">
              <BookOpen size={17} className="text-primary" />
              Your progress by reviewer
            </h2>
            <div className="space-y-5">
              {categories.map((category) => {
                const count = reviewedQuestionCount(data.sessions, category.id)
                const percent = Math.min(
                  100,
                  Math.round((count / Math.max(category.questionCount, 1)) * 100),
                )
                return (
                  <div key={category.id} className="flex items-center gap-3">
                    <CategoryIcon category={category} size={16} className="size-9 rounded-lg" />
                    <div className="flex-1">
                      <div className="mb-2 flex justify-between gap-3 text-[11px]">
                        <span className="font-medium text-ink">{category.title}</span>
                        <span className="text-subtle">{percent}%</span>
                      </div>
                      <Progress value={percent} />
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        </>
      )}
      {settings && (
        <section className="rounded-xl border border-line bg-surface p-6">
          <h2 className="mb-2 text-sm font-bold text-ink">Appearance & study preferences</h2>
          <p className="mb-5 text-xs leading-6 text-subtle">
            Changes apply after you save. Existing sessions keep their original settings.
          </p>
          <label className="mb-6 block text-xs font-semibold text-ink">
            Theme
            <div className="mt-3 flex gap-3">
              {(
                [
                  { id: 'light', icon: Sun, label: 'Light & focused' },
                  { id: 'dark', icon: Moon, label: 'After-hours dark' },
                ] as const
              ).map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => setPreferences((p) => ({ ...p, theme: theme.id }))}
                  aria-pressed={preferences.theme === theme.id}
                  className={`flex flex-1 items-center gap-3 rounded-xl border p-4 text-xs ${preferences.theme === theme.id ? 'border-primary bg-primary-soft text-primary' : 'border-line text-subtle'}`}
                >
                  <theme.icon size={18} />
                  {theme.label}
                </button>
              ))}
            </div>
          </label>
          <label className="block text-xs font-semibold text-ink">
            Default study mode
            <Select
              className="mt-3 w-full"
              value={preferences.defaultStudyMode}
              onChange={(e) =>
                setPreferences((p) => ({
                  ...p,
                  defaultStudyMode: e.target.value as Preferences['defaultStudyMode'],
                }))
              }
            >
              <option value="practice">Practice</option>
              <option value="exam">Exam</option>
              <option value="flashcard">Flashcards</option>
              <option value="mixed">Mixed study</option>
            </Select>
          </label>
          <div className="mt-5 divide-y divide-line">
            <Toggle
              label="Instant feedback by default"
              description="Learn from your answers as you go (except in exam mode)"
              checked={preferences.instantFeedback}
              onChange={(v) => setPreferences((p) => ({ ...p, instantFeedback: v }))}
            />
            <Toggle
              label="Show source explanations"
              description="Make space for the why, not just the answer"
              checked={preferences.showExplanations}
              onChange={(v) => setPreferences((p) => ({ ...p, showExplanations: v }))}
            />
          </div>
          <div className="mt-5 border-t border-line pt-5">
            <Button
              busy={busy}
              onClick={() =>
                run(() => savePreferences(preferences), 'Your preferences were saved.')
              }
            >
              <Save size={14} />
              Save preferences
            </Button>
          </div>
        </section>
      )}
      <section className="rounded-xl border border-line bg-surface p-6">
        <h2 className="text-sm font-bold">Study data and privacy</h2>
        <p className="mt-2 text-xs leading-6 text-subtle">Your administrator can see sign-ins, reviewers and questions opened, approximate visible study time, and results. Raw activity is retained for 90 days; saved study records and summaries remain until account deletion. To request deletion of your account or activity records, contact your study administrator.</p>
        <Button variant="secondary" className="mt-4" busy={busy} onClick={() => run(async () => {
          const token = await user!.getIdToken()
          const response = await fetch('/api/study/account', { headers: { Authorization: `Bearer ${token}` } })
          if (!response.ok) throw new Error('Your data export is unavailable. Please try again later.')
          const url = URL.createObjectURL(await response.blob())
          const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'cfms-study-data.json'; anchor.click()
          setTimeout(() => URL.revokeObjectURL(url),1000)
        }, 'Your study data export is ready.')}>Export my study data</Button>
      </section>
      <section className="rounded-xl border border-line bg-surface p-6">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-ink">
          <ShieldCheck size={17} className="text-primary" />
          Account security
        </h2>
        <p className="text-xs leading-6 text-subtle">
          Passwords are managed by Firebase Authentication. They are never stored in the study
          database.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button
            variant="secondary"
            busy={busy}
            disabled={!user?.email}
            onClick={() =>
              run(
                () => sendPasswordResetEmail(firebaseServices().auth, user!.email!),
                `Your password reset request was accepted. Check ${user?.email} for a reset link.`,
              )
            }
          >
            <KeyRound size={14} />
            Send password reset email
          </Button>
          <Button
            variant="danger"
            busy={busy}
            onClick={() =>
              run(async () => {
                await logout()
                router.replace('/login')
              }, 'Signed out.')
            }
          >
            <LogOut size={14} />
            Sign out
          </Button>
        </div>
      </section>
    </div>
  )
}
