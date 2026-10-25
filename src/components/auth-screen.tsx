'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { firebaseServices, friendlyError } from '@/lib/firebase'
import { trackEvent } from '@/lib/activity-tracker'
import { initializeProfile, updateUserPaths } from '@/lib/firebase-study-service'
import { useStudy } from '@/lib/study-context'
import { defaultPreferences } from '@/lib/study-models'
import { FinanceArt } from './finance-art'
import { Button, Input } from './ui'

export function AuthScreen({ screen }: { screen: 'login' | 'register' | 'forgot-password' }) {
  const router = useRouter()
  const { user, authLoading, error: authError } = useStudy()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [visible, setVisible] = useState(false)
  const [remember, setRemember] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [profilePending, setProfilePending] = useState(false)
  const isRegister = screen === 'register'
  const isReset = screen === 'forgot-password'
  const strength = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^a-zA-Z0-9]/.test(password),
  ].filter(Boolean).length
  useEffect(() => {
    if (!authLoading && user && !busy && !profilePending) router.replace('/dashboard')
  }, [user, authLoading, busy, profilePending, router])

  async function finishProfile() {
    const current = firebaseServices().auth.currentUser
    if (!current) throw new Error('Your authentication session ended. Please sign in again.')
    await updateProfile(current, { displayName: name.trim() })
    await initializeProfile(current.uid, name.trim(), current.email || email.trim())
    await updateUserPaths(current.uid, {
      preferences: defaultPreferences,
      'profile/displayName': name.trim(),
      'profile/updatedAt': Date.now(),
    })
    router.replace('/dashboard')
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (
      isRegister &&
      !profilePending &&
      (password.length < 8 || password !== confirm || !name.trim())
    ) {
      setError(
        password.length < 8
          ? 'Use a password with at least 8 characters.'
          : password !== confirm
            ? 'Your passwords don’t match.'
            : 'Please enter your full name.',
      )
      return
    }
    setBusy(true)
    try {
      const { auth } = firebaseServices()
      if (profilePending) {
        await finishProfile()
        return
      }
      if (isReset) {
        await sendPasswordResetEmail(auth, email.trim())
        setSuccess(true)
      } else if (isRegister) {
        await setPersistence(auth, browserLocalPersistence)
        await createUserWithEmailAndPassword(auth, email.trim(), password)
        trackEvent('auth_register')
        setProfilePending(true)
        await finishProfile()
      } else {
        await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence)
        await signInWithEmailAndPassword(auth, email.trim(), password)
        trackEvent('auth_login')
        router.replace('/dashboard')
      }
    } catch (err) {
      setError(
        `${profilePending || (firebaseServices().auth.currentUser && isRegister) ? 'Your account exists, but profile setup is not confirmed. Retry to finish setup. ' : ''}${friendlyError(err)}`,
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="grid min-h-dvh bg-surface lg:grid-cols-2">
      <section className="relative hidden flex-col items-center justify-between gap-8 overflow-hidden bg-primary-soft p-12 text-center lg:flex xl:p-16">
        <button
          className="relative z-10 flex items-center justify-center gap-3"
          onClick={() => router.push('/login')}
        >
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-on-primary">
            <BookOpen size={25} />
          </span>
          <span className="font-display text-xl font-extrabold tracking-tight text-ink">
            CFMS<span className="ml-1.5 font-medium text-primary">Study Hub</span>
          </span>
        </button>
        <div className="relative z-10 w-full max-w-lg">
          <h1 className="font-display text-4xl leading-tight font-extrabold tracking-tight text-ink xl:text-5xl">
            Financial management
            <br />
            study hub.
          </h1>
          <p className="mx-auto mt-6 max-w-sm text-sm leading-7 text-subtle">
            Review source questions, practice at your pace, and save your progress.
          </p>
          <div className="mx-auto my-8 h-58 w-96 max-w-full">
            <FinanceArt />
          </div>
          <div className="space-y-3">
            {[
              'Focused financial management reviewers',
              'Practice your way, at your own pace',
              'Your progress, wherever you study',
            ].map((text) => (
              <p key={text} className="flex items-center justify-center gap-3 text-xs text-subtle">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Check size={12} />
                </span>
                {text}
              </p>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-subtle">
          Built for focused minds. Designed for your future.
        </p>
        <div className="hero-pattern absolute -right-24 top-24 size-96 rounded-full opacity-10" />
      </section>
      <section className="flex min-h-dvh flex-col items-center justify-center px-6 py-12">
        <div className="page-enter w-full max-w-sm">
          <button
            className="mb-12 flex items-center gap-2 font-display font-extrabold text-primary lg:hidden"
            onClick={() => router.push('/login')}
          >
            <BookOpen size={24} />
            CFMS Study Hub
          </button>
          {isReset && (
            <Button
              variant="ghost"
              className="mb-6 px-0 text-xs"
              onClick={() => router.push('/login')}
            >
              <ArrowLeft size={14} />
              Back to sign in
            </Button>
          )}
          <span className="mb-6 flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            {isReset ? <LockKeyhole size={23} /> : <BookOpen size={23} />}
          </span>
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-ink">
            {isReset
              ? 'Forgot your password?'
              : isRegister
                ? 'Create your account'
                : 'Welcome back'}
          </h2>
          <p className="mt-3 text-sm leading-6 text-subtle">
            {isReset
              ? 'Request a link to reset your password.'
              : isRegister
                ? 'Create your study account.'
                : 'Sign in to continue studying.'}
          </p>
          {success ? (
            <div className="mt-8 rounded-xl border border-success/20 bg-success-soft p-6">
              <CheckCircle2 className="mb-3 text-success" size={26} />
              <h3 className="font-semibold text-ink">Check your inbox</h3>
              <p className="mt-2 text-sm leading-6 text-subtle">
                If an account exists for {email}, a password reset link will be requested. Check
                your spam folder too.
              </p>
              <Button variant="secondary" className="mt-5" onClick={() => router.push('/login')}>
                Back to sign in
                <ArrowRight size={14} />
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-8 space-y-5">
              {isRegister && (
                <label className="block text-xs font-semibold text-ink">
                  Full name
                  <Input
                    required
                    maxLength={100}
                    autoComplete="name"
                    placeholder="Your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-2"
                    disabled={profilePending}
                  />
                </label>
              )}
              <label className="block text-xs font-semibold text-ink">
                Email address
                <Input
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-2"
                  disabled={profilePending}
                />
              </label>
              {!isReset && (
                <label className="block text-xs font-semibold text-ink">
                  Password
                  <div className="relative mt-2">
                    <Input
                      required
                      type={visible ? 'text' : 'password'}
                      autoComplete={isRegister ? 'new-password' : 'current-password'}
                      placeholder={isRegister ? 'Create a strong password' : 'Enter your password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-11"
                      disabled={profilePending}
                    />
                    <button
                      type="button"
                      aria-label={visible ? 'Hide password' : 'Show password'}
                      onClick={() => setVisible((v) => !v)}
                      className="absolute right-3 top-3 text-subtle"
                    >
                      {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </label>
              )}
              {isRegister && (
                <>
                  <div>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((n) => (
                        <span
                          key={n}
                          className={`h-1 flex-1 rounded-full ${n <= strength ? (strength > 2 ? 'bg-success' : 'bg-warning') : 'bg-muted'}`}
                        />
                      ))}
                    </div>
                    <p className="mt-2 text-[10px] text-subtle">
                      At least 8 characters. Mix uppercase, numbers, and symbols.
                    </p>
                  </div>
                  <label className="block text-xs font-semibold text-ink">
                    Confirm password
                    <Input
                      type={visible ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      placeholder="Re-enter your password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className="mt-2"
                      disabled={profilePending}
                    />
                  </label>
                </>
              )}
              {!isRegister && !isReset && (
                <div className="flex items-center justify-between text-xs">
                  <label className="flex items-center gap-2 text-subtle">
                    <input
                      type="checkbox"
                      className="accent-primary"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                    />
                    Remember me
                  </label>
                  <button
                    type="button"
                    onClick={() => router.push('/forgot-password')}
                    className="font-semibold text-primary"
                  >
                    Forgot password?
                  </button>
                </div>
              )}
              {(error || authError) && (
                <p
                  role="alert"
                  className="rounded-lg bg-danger-soft p-3 text-xs leading-5 text-danger"
                >
                  {error || authError}
                </p>
              )}
              <Button type="submit" busy={busy} className="w-full">
                {profilePending
                  ? 'Retry profile setup'
                  : isReset
                    ? 'Send reset link'
                    : isRegister
                      ? 'Create account'
                      : 'Sign in'}
                {!busy && <ArrowRight size={16} />}
              </Button>
            </form>
          )}
          {!isReset && (
            <p className="mt-6 text-center text-xs text-subtle">
              {isRegister ? 'Already part of the hub?' : 'New to the study hub?'}{' '}
              <button
                onClick={() => router.push(isRegister ? '/login' : '/register')}
                className="font-semibold text-primary"
              >
                {isRegister ? 'Sign in' : 'Create an account'}
              </button>
            </p>
          )}
          <p className="mt-6 text-center text-[10px] leading-5 text-subtle">Study activity, visible question time, and results are available to your study administrator. Raw activity is retained for 90 days.</p>
        </div>
      </section>
    </main>
  )
}
