'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CloudCheck,
  CloudOff,
  Flag,
  Grid2X2,
  Layers,
  Loader2,
  Plus,
  RotateCcw,
  RotateCw,
  ShieldAlert,
  Shuffle,
  SkipForward,
  X,
  XCircle,
} from 'lucide-react'
import { useStudy } from '@/lib/study-context'
import { friendlyError } from '@/lib/firebase'
import { questionsForSession } from '@/lib/question-presentation'
import { trackEvent, trackVisibleQuestion } from '@/lib/activity-tracker'
import {
  Answer,
  enumerationMatches,
  gradeAnswer,
  modeLabels,
  Question,
  shuffled,
  StudySession,
  typeLabels,
} from '@/lib/study-models'
import { Badge, Button, EmptyState, Input, Modal, Progress } from './ui'

const statusColors: Record<string, string> = {
  pending: 'border-line bg-surface text-subtle',
  answered: 'border-primary/20 bg-primary-soft text-primary',
  correct: 'border-success/20 bg-success-soft text-success',
  incorrect: 'border-danger/20 bg-danger-soft text-danger',
  partial: 'border-warning/20 bg-warning-soft text-warning',
  skipped: 'border-warning/20 bg-warning-soft text-warning',
  'review-required': 'border-warning/20 bg-warning-soft text-warning',
}

export function QuizPlayer() {
  const {
    data,
    user,
    connected,
    activeSessionId,
    loadQuestions,
    commitSession,
    toggleBookmark,
    markCard,
    setActiveSessionId,
  } = useStudy()
  const router = useRouter()
  const initial = activeSessionId ? data.sessions[activeSessionId] : undefined
  const [session, setSession] = useState<StudySession | undefined>(initial)
  const [questions, setQuestions] = useState<Record<string, Question>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [navigator, setNavigator] = useState(false)
  const [mobile, setMobile] = useState(false)
  const [finish, setFinish] = useState(false)
  const [flipped, setFlipped] = useState(false)
  const [text, setText] = useState('')
  const [entries, setEntries] = useState<string[]>(['', '', ''])
  const [now, setNow] = useState(Date.now())
  const [reload, setReload] = useState(0)
  const busyRef = useRef(false)
  const timerSubmitted = useRef(false)
  const { categories } = useStudy()
  const category = categories.find((c) => c.id === session?.categoryId)
  const questionId = session?.questionIds[session.currentQuestionIndex]
  const question = questionId ? questions[questionId] : undefined
  const answer = questionId ? session?.answers?.[questionId] : undefined
  const flashcard = session?.mode === 'flashcard'
  const deadline = session?.settings.timer
    ? session.startedAt + session.settings.durationMinutes * 60000
    : undefined
  const remaining = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : 0
  const expired = !!deadline && remaining === 0
  const reveal = !flashcard && !!answer?.graded && !!session?.settings.instantFeedback
  const locked = !!answer?.graded || busy || dirty || expired

  useEffect(() => {
    if (!question || !session || session.status !== 'in-progress') return
    return trackVisibleQuestion({ categoryId: session.categoryId, questionId: question.id, sessionId: session.id })
  }, [question?.id, session?.id, session?.status])
  useEffect(() => {
    if (initial && initial.revision > 1 && initial.status === 'in-progress')
      trackEvent('session_resumed', { categoryId: initial.categoryId, sessionId: initial.id })
  }, [initial?.id])

  useEffect(() => {
    const media = window.matchMedia('(max-width: 639px)')
    const change = () => setMobile(media.matches)
    change()
    media.addEventListener('change', change)
    return () => media.removeEventListener('change', change)
  }, [])

  useEffect(() => {
    if (initial && !dirty && !busyRef.current) setSession(initial)
  }, [initial?.id, initial?.revision])

  useEffect(() => {
    if (!session) {
      setLoading(false)
      return
    }
    let alive = true
    setLoading(true)
    loadQuestions(session.categoryId, session.contentVersion)
      .then((value) => {
        if (!alive) return
        setQuestions(Object.fromEntries(questionsForSession(value, session).map((q) => [q.id, q])))
        setLoading(false)
      })
      .catch((err) => {
        if (alive) {
          setError(friendlyError(err))
          setLoading(false)
        }
      })
    return () => {
      alive = false
    }
  }, [session?.categoryId, user?.uid, reload])

  useEffect(() => {
    setFlipped(false)
    setText(typeof answer?.value === 'string' ? answer.value : '')
    setEntries(
      Array.isArray(answer?.value)
        ? answer.value
        : Array.from(
            {
              length:
                question?.type === 'enumeration' && Array.isArray(question.correctAnswer)
                  ? question.correctAnswer.length
                  : 3,
            },
            () => '',
          ),
    )
  }, [questionId, question?.id, answer?.value])

  useEffect(() => {
    if (!deadline) return
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [deadline])

  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  async function save(next: StudySession) {
    if (busyRef.current) return
    busyRef.current = true
    setSession(next)
    setDirty(true)
    setBusy(true)
    setError('')
    try {
      const saved = await commitSession(next)
      setSession(saved)
      setDirty(false)
      return saved
    } catch (err) {
      setError(friendlyError(err))
      return undefined
    } finally {
      setBusy(false)
      busyRef.current = false
    }
  }

  async function submitSession() {
    if (!session || busyRef.current || session.status === 'completed') return
    const answers = Object.fromEntries(
      session.questionIds.map((id) => {
        const previous = session.answers?.[id]
        if (!previous || previous.status === 'skipped')
          return [id, { value: '', status: 'skipped', credit: 0, graded: true }]
        if (!previous.graded && questions[id])
          return [id, gradeAnswer(questions[id], previous.value)]
        return [id, previous]
      }),
    ) as Record<string, Answer>
    const score = Object.values(answers).reduce((total, answer) => total + answer.credit, 0)
    const saved = await save({
      ...session,
      answers,
      score,
      status: 'completed',
      completedAt: Date.now(),
    })
    if (saved) {
      setActiveSessionId(saved.id)
      router.replace('/results')
    }
    setFinish(false)
  }

  useEffect(() => {
    if (
      expired &&
      !loading &&
      session &&
      session.status === 'in-progress' &&
      !busy &&
      !dirty &&
      !timerSubmitted.current
    ) {
      timerSubmitted.current = true
      submitSession()
    }
  }, [expired, loading, busy, dirty, session?.status])

  async function respond(value: string | string[]) {
    if (!session || !question || locked || busyRef.current) return
    const checked = session.settings.instantFeedback && session.mode !== 'exam'
    const nextAnswer: Answer = checked
      ? gradeAnswer(question, value)
      : { value, status: 'pending', credit: 0, graded: false }
    await save({ ...session, answers: { ...session.answers, [question.id]: nextAnswer } })
  }

  async function navigate(index: number, skipped = false) {
    if (!session || busyRef.current || dirty || index < 0 || index >= session.questionIds.length)
      return
    const next = { ...session, currentQuestionIndex: index }
    if (skipped && question)
      next.answers = {
        ...session.answers,
        [question.id]: { value: '', status: 'skipped', credit: 0, graded: false },
      }
    await save(next)
  }

  async function recall(known: boolean) {
    if (!session || !question || busyRef.current || dirty || !flipped) return
    setError('')
    busyRef.current = true
    setBusy(true)
    try {
      await markCard(session.categoryId, question.id, known ? 'known' : 'again')
      busyRef.current = false
      setBusy(false)
      const result = await save({
        ...session,
        currentQuestionIndex: Math.min(
          session.currentQuestionIndex + 1,
          session.questionIds.length - 1,
        ),
        answers: {
          ...session.answers,
          [question.id]: {
            value: question.correctAnswer,
            status: known ? 'correct' : 'incorrect',
            credit: known ? 1 : 0,
            graded: true,
          },
        },
      })
      if (result) setFlipped(false)
    } catch (err) {
      setError(friendlyError(err))
      busyRef.current = false
      setBusy(false)
    }
  }

  if (loading)
    return (
      <div className="flex min-h-96 flex-col items-center justify-center gap-3 text-subtle">
        <Loader2 className="animate-spin text-primary" size={26} />
        <p className="text-sm">Loading questions…</p>
      </div>
    )
  if (!session)
    return (
      <EmptyState
        icon={<BookIcon />}
        title="Your next session is waiting"
        description="Choose a reviewer and configure a session. Your unfinished sessions are always in Session History."
        action={
          <Button onClick={() => router.push('/categories')}>
            Find a reviewer
            <ArrowRight size={15} />
          </Button>
        }
      />
    )
  if (session.status === 'completed')
    return (
      <EmptyState
        icon={<CheckCircle2 />}
        title="This session is complete"
        description="Your answers are already submitted. Open the results to reflect on what you learned."
        action={
          <Button onClick={() => router.push('/results')}>
            View results
            <ArrowRight size={15} />
          </Button>
        }
      />
    )
  if (!question || session.questionIds.some((id) => !questions[id]))
    return (
      <EmptyState
        icon={<ShieldAlert />}
        title="Some questions aren’t available"
        description={
          error ||
          'The question bank may have changed since this session started. Your saved answers are preserved. Restore the original question IDs before resuming.'
        }
        action={
          <Button variant="secondary" onClick={() => setReload((r) => r + 1)}>
            Retry loading
          </Button>
        }
      />
    )

  const answeredCount = Object.values(session.answers ?? {}).filter(
    (a) => a.status !== 'skipped',
  ).length
  const marked = !!data.bookmarks[session.categoryId]?.[question.id]
  const savingLabel = busy
    ? connected === false
      ? 'Waiting for connection…'
      : 'Saving…'
    : dirty
      ? 'Not saved · retry below'
      : 'Saved'
  const currentIndex = session.currentQuestionIndex
  const isLast = currentIndex === session.questionIds.length - 1

  return (
    <div className="page-enter mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          className="flex items-center gap-2 text-xs text-subtle hover:text-primary"
          onClick={() => {
            if (!dirty && !busy) router.push('/history')
          }}
          disabled={dirty || busy}
        >
          <ArrowLeft size={14} />
          Save & exit
        </button>
        <span
          className={`flex items-center gap-1.5 text-[10px] ${dirty ? 'text-warning' : 'text-subtle'}`}
          aria-live="polite"
        >
          {busy ? (
            <Loader2 size={12} className="animate-spin" />
          ) : dirty ? (
            <CloudOff size={12} />
          ) : (
            <CloudCheck size={12} />
          )}
          {savingLabel}
        </span>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex flex-wrap gap-2">
            <Badge className="bg-primary-soft text-primary">{modeLabels[session.mode]} mode</Badge>
          </div>
          <h1 className="font-display text-xl font-extrabold tracking-tight text-ink">
            {category?.title || 'Study session'}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {deadline && (
            <span
              className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-semibold tabular-nums ${remaining < 60 ? 'border-danger/20 bg-danger-soft text-danger' : 'border-line bg-surface text-subtle'}`}
            >
              <Clock3 size={15} />
              {Math.floor(remaining / 60)
                .toString()
                .padStart(2, '0')}
              :{(remaining % 60).toString().padStart(2, '0')}
            </span>
          )}
          <Button
            variant="secondary"
            className="text-xs"
            disabled={busy || dirty}
            onClick={() => setFinish(true)}
          >
            <Flag size={14} />
            Finish session
          </Button>
        </div>
      </div>
      {session.mode === 'exam' && (
        <p className="flex items-start gap-2 rounded-lg border border-warning/15 bg-warning-soft px-4 py-3 text-[11px] leading-5 text-warning">
          <ShieldAlert size={15} className="mt-0.5 shrink-0" />
          Self-assessment only—not a secure, proctored exam. Answers stay hidden in this interface
          until submission; database-readable keys are not tamper-proof.
        </p>
      )}
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-semibold text-ink">
          Question {currentIndex + 1}
          <span className="font-normal text-subtle"> / {session.questionIds.length}</span>
        </span>
        <span className="text-subtle">
          {answeredCount} {flashcard ? 'reviewed' : 'answered'} ·{' '}
          {session.questionIds.length - answeredCount} remaining
        </span>
      </div>
      <Progress value={(answeredCount / session.questionIds.length) * 100} className="h-2" />
      {(error || dirty) && (
        <div role="alert" className="rounded-xl border border-danger/20 bg-danger-soft p-4">
          <p className="text-xs leading-6 text-danger">
            {error || 'This change has not been saved yet.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button busy={busy} className="min-h-8 text-[11px]" onClick={() => save(session)}>
              Retry save
            </Button>
            <Button
              variant="secondary"
              className="min-h-8 text-[11px]"
              disabled={busy}
              onClick={() => {
                if (initial) {
                  setSession(initial)
                  setDirty(false)
                  setError('')
                  timerSubmitted.current = false
                }
              }}
            >
              Reload last confirmed state
            </Button>
          </div>
        </div>
      )}
      {flashcard ? (
        <section>
          <p className="mb-3 text-center text-[10px] text-subtle">
            Derived flashcard · {question.topic} · Click the card to flip
          </p>
          <button
            key={`${questionId}-${flipped}`}
            onClick={() => setFlipped((v) => !v)}
            disabled={busy || dirty}
            className={`flip-enter flex min-h-86 w-full flex-col items-center justify-center rounded-2xl border px-6 py-10 text-center shadow-sm sm:px-14 ${flipped ? 'border-primary/25 bg-primary-soft' : 'border-line bg-surface'}`}
            aria-label={flipped ? 'Show question side' : 'Flip to reveal answer'}
          >
            <span className="mb-5 text-[10px] font-semibold uppercase tracking-widest text-primary">
              {flipped ? 'THE ANSWER' : 'QUICK RECALL'}
            </span>
            <h2 className="max-w-2xl font-display text-xl leading-relaxed font-bold text-ink sm:text-2xl">
              {flipped
                ? Array.isArray(question.correctAnswer)
                  ? question.correctAnswer.join(' · ')
                  : question.correctAnswer
                : question.question}
            </h2>
            {!flipped && question.proposedAnswer && <p className="mt-4 max-w-2xl rounded-xl border border-primary/20 bg-surface px-4 py-3 text-sm leading-6"><strong>Proposed answer:</strong> {question.proposedAnswer}<br />Is this the correct answer to the question?</p>}
            {flipped && (
              <>
                <p className="mt-5 max-w-xl text-sm leading-7 text-subtle">
                  {question.explanation || 'No source explanation supplied.'}
                </p>
                {question.verificationStatus === 'review-required' && (
                  <Badge className="mt-4 bg-warning-soft text-warning">
                    Questionable key · verification required
                  </Badge>
                )}
              </>
            )}
            <span className="mt-8 flex items-center gap-2 text-[11px] text-subtle">
              <RotateCw size={14} />
              {flipped ? 'Click to see the question' : 'Click to reveal the answer'}
            </span>
          </button>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <Button
              variant="secondary"
              disabled={!flipped || busy || dirty}
              onClick={() => recall(false)}
            >
              <RotateCcw size={16} />
              Study again
            </Button>
            <Button
              disabled={!flipped || busy || dirty}
              onClick={() => recall(true)}
              className="border-success bg-success hover:bg-success/90"
            >
              <Check size={16} />
              Know it
            </Button>
          </div>
          <p className="mt-3 text-center text-[10px] text-subtle">
            Self-assessed recall, not a graded examination score.
          </p>
        </section>
      ) : (
        <section
          key={question.id}
          className="page-enter overflow-hidden rounded-2xl border border-line bg-surface shadow-xs"
        >
          <div className="p-5 sm:p-8">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-muted text-subtle">{typeLabels[question.type]}</Badge>
                <Badge className="bg-primary-soft text-primary">{question.topic}</Badge>
                {question.derived && (
                  <Badge className="border border-line text-subtle">Derived content</Badge>
                )}
              </div>
              <button
                aria-label={marked ? 'Remove bookmark' : 'Bookmark this question'}
                onClick={() => toggleBookmark(session.categoryId, question.id).catch(() => {})}
                className={`rounded-lg p-2 ${marked ? 'bg-primary-soft text-primary' : 'text-faint hover:bg-muted hover:text-primary'}`}
              >
                <Bookmark size={19} fill={marked ? 'currentColor' : 'none'} />
              </button>
            </div>
            <h2 className="font-display text-lg leading-8 font-bold text-ink sm:text-[21px]">
              {question.question}
            </h2>
            {question.proposedAnswer && <div className="mt-4 rounded-xl border border-primary/20 bg-primary-soft p-4"><p className="text-[11px] font-semibold text-primary">Proposed answer</p><p className="mt-1 text-sm leading-6 text-ink">{question.proposedAnswer}</p><p className="mt-2 text-xs text-subtle">Is this the correct answer to the question?</p></div>}
            <p className="mt-3 text-[10px] leading-5 text-subtle">
              Original no. {question.originalNumber} · {question.sourceDocument}
              {question.sourcePage && question.sourcePage !== 'Not applicable'
                ? ` · p. ${question.sourcePage}`
                : ''}
            </p>
            {question.verificationStatus === 'review-required' && (
              <p className="mt-3 flex items-center gap-2 rounded-lg bg-warning-soft p-3 text-xs text-warning">
                <ShieldAlert size={15} />
                This source answer key is flagged for verification. It will not be automatically
                marked wrong.
              </p>
            )}
            {question.type === 'multiple-choice' || question.type === 'true-false' ? (
              <div className="mt-7 grid gap-3">
                {(session.choiceOrder?.[question.id] || question.choices || []).map(
                  (choice, index) => {
                    const selected = answer?.value === choice
                    const correct =
                      reveal &&
                      question.correctAnswer === choice &&
                      question.verificationStatus !== 'review-required'
                    const wrong = reveal && selected && answer?.status === 'incorrect'
                    return (
                      <button
                        key={`${choice}-${index}`}
                        disabled={locked}
                        onClick={() => respond(choice)}
                        className={`flex min-h-15 items-center gap-4 rounded-xl border px-4 py-3.5 text-left text-sm transition-all disabled:cursor-default ${correct ? 'border-success bg-success-soft text-success' : wrong ? 'border-danger bg-danger-soft text-danger' : selected ? 'border-primary bg-primary-soft text-primary' : 'border-line text-ink hover:border-primary/40 hover:bg-primary-soft/30'}`}
                      >
                        <span
                          className={`flex size-8 shrink-0 items-center justify-center rounded-lg border text-xs font-semibold ${correct ? 'border-success/25 bg-success/10' : wrong ? 'border-danger/25 bg-danger/10' : selected ? 'border-primary/30 bg-primary/10' : 'border-line bg-canvas text-subtle'}`}
                        >
                          {String.fromCharCode(65 + index)}
                        </span>
                        <span className="flex-1 leading-6">{choice}</span>
                        {correct ? (
                          <CheckCircle2 size={19} />
                        ) : wrong ? (
                          <XCircle size={19} />
                        ) : selected ? (
                          <span className="size-4 rounded-full border-4 border-primary" />
                        ) : (
                          <span className="size-4 rounded-full border border-line" />
                        )}
                      </button>
                    )
                  },
                )}
              </div>
            ) : (
              <form
                className="mt-7 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault()
                  respond(question.type === 'enumeration' ? entries : text)
                }}
              >
                {question.type === 'identification' ? (
                  <label className="block text-xs font-medium text-subtle">
                    Your answer
                    <Input
                      autoComplete="off"
                      placeholder="Type the term or concept…"
                      className="mt-2"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      disabled={locked}
                      required
                    />
                  </label>
                ) : (
                  <>
                    <p className="text-xs text-subtle">
                      Enter each answer separately.{' '}
                      {question.orderMatters
                        ? 'The order matters for this question.'
                        : 'Order does not matter. Duplicate answers do not earn extra credit.'}
                    </p>
                    {entries.map((entry, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <span className="w-4 text-xs text-subtle">{index + 1}.</span>
                        <Input
                          aria-label={`Answer ${index + 1}`}
                          value={entry}
                          onChange={(e) =>
                            setEntries((previous) =>
                              previous.map((v, i) => (i === index ? e.target.value : v)),
                            )
                          }
                          disabled={locked}
                          required
                          placeholder={`Answer ${index + 1}`}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          aria-label={`Remove answer ${index + 1}`}
                          disabled={locked || entries.length <= 1}
                          onClick={() =>
                            setEntries((previous) => previous.filter((_, i) => i !== index))
                          }
                          className="px-2"
                        >
                          <X size={15} />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="ghost"
                      type="button"
                      disabled={locked || entries.length >= 20}
                      onClick={() => setEntries((previous) => [...previous, ''])}
                      className="px-0 text-xs"
                    >
                      <Plus size={14} />
                      Add answer
                    </Button>
                  </>
                )}
                {!answer?.graded && (
                  <Button
                    type="submit"
                    disabled={
                      locked ||
                      (question.type === 'enumeration'
                        ? entries.some((v) => !v.trim())
                        : !text.trim())
                    }
                  >
                    {session.settings.instantFeedback ? 'Check answer' : 'Save answer'}
                    <ArrowRight size={14} />
                  </Button>
                )}
              </form>
            )}
          </div>
          {reveal && (
            <Feedback
              question={question}
              answer={answer!}
              showExplanation={session.settings.showExplanations}
            />
          )}
          {!session.settings.instantFeedback && answer?.status === 'pending' && (
            <p className="border-t border-line bg-canvas px-6 py-4 text-xs text-subtle">
              Response recorded. Correctness will be revealed when you submit the session. You can
              change this answer before submitting.
            </p>
          )}
        </section>
      )}
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="secondary"
          className="text-xs"
          disabled={currentIndex === 0 || busy || dirty}
          onClick={() => navigate(currentIndex - 1)}
        >
          <ChevronLeft size={15} />
          <span className="hidden sm:inline">Previous</span>
        </Button>
        <div className="flex gap-2">
          {flashcard && (
            <Button
              variant="ghost"
              className="text-xs"
              disabled={busy || dirty}
              onClick={() =>
                save({
                  ...session,
                  questionIds: shuffled(session.questionIds),
                  currentQuestionIndex: 0,
                })
              }
            >
              <Shuffle size={14} />
              <span className="hidden sm:inline">Shuffle</span>
            </Button>
          )}
          {(!answer || answer.status === 'skipped') && !flashcard && (
            <Button
              variant="ghost"
              className="text-xs"
              disabled={busy || dirty || expired}
              onClick={() => (isLast ? setFinish(true) : navigate(currentIndex + 1, true))}
            >
              Skip
              <SkipForward size={14} />
            </Button>
          )}
          <Button
            className="text-xs"
            disabled={busy || dirty || (!answer && !flashcard && !isLast)}
            onClick={() => (isLast ? setFinish(true) : navigate(currentIndex + 1))}
          >
            {isLast ? 'Finish session' : 'Next question'}
            <ChevronRight size={15} />
          </Button>
        </div>
      </div>
      <section className="rounded-xl border border-line bg-surface">
        <button
          onClick={() => setNavigator((v) => !v)}
          aria-expanded={navigator}
          className="flex w-full items-center justify-between p-4 text-xs font-semibold text-subtle"
        >
          <span className="flex items-center gap-2">
            <Grid2X2 size={15} />
            Question navigator
            <span className="font-normal text-faint">· {session.questionIds.length} questions</span>
          </span>
          <ChevronDown
            size={16}
            className={navigator ? 'rotate-180 transition-transform' : 'transition-transform'}
          />
        </button>
        {navigator && !mobile && (
          <div className="border-t border-line p-5">
            <div className="flex flex-wrap gap-2">
              {session.questionIds.map((id, i) => {
                const status = session.answers?.[id]?.status || 'pending'
                const safeStatus =
                  session.mode === 'exam' || !session.settings.instantFeedback
                    ? status === 'skipped'
                      ? 'skipped'
                      : session.answers?.[id]
                        ? 'answered'
                        : 'pending'
                    : status
                return (
                  <button
                    key={id}
                    disabled={busy || dirty}
                    aria-label={`Question ${i + 1}, ${safeStatus}`}
                    aria-current={i === currentIndex ? 'step' : undefined}
                    onClick={() => navigate(i)}
                    className={`flex size-9 items-center justify-center rounded-lg border text-xs font-semibold ${i === currentIndex ? 'border-primary bg-primary text-on-primary ring-3 ring-primary/10' : statusColors[safeStatus]}`}
                  >
                    {i + 1}
                  </button>
                )
              })}
            </div>
            <div className="mt-4 flex flex-wrap gap-4 text-[10px] text-subtle">
              {(session.mode === 'exam' || !session.settings.instantFeedback
                ? [
                    ['Current', 'bg-primary'],
                    ['Answered', 'bg-primary/40'],
                    ['Unanswered', 'bg-line'],
                    ['Skipped', 'bg-warning'],
                  ]
                : [
                    ['Current', 'bg-primary'],
                    ['Unanswered', 'bg-line'],
                    ['Correct', 'bg-success'],
                    ['Incorrect', 'bg-danger'],
                    ['Skipped', 'bg-warning'],
                  ]
              ).map(([label, color]) => (
                <span key={label} className="flex items-center gap-1.5">
                  <span className={`size-2 rounded-full ${color}`} />
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>
      {navigator && mobile && (
        <Modal drawer title="Question navigator" onClose={() => setNavigator(false)}>
          <div className="p-5">
            <p className="mb-4 text-xs text-subtle">
              Jump to any question. Your current response is preserved.
            </p>
            <div className="grid grid-cols-6 gap-2">
              {session.questionIds.map((id, index) => {
                const status = session.answers?.[id]?.status || 'pending'
                const safeStatus =
                  session.mode === 'exam' || !session.settings.instantFeedback
                    ? status === 'skipped'
                      ? 'skipped'
                      : session.answers?.[id]
                        ? 'answered'
                        : 'pending'
                    : status
                return (
                  <button
                    key={id}
                    aria-label={`Question ${index + 1}, ${safeStatus}`}
                    disabled={busy || dirty}
                    onClick={async () => {
                      await navigate(index)
                      setNavigator(false)
                    }}
                    className={`flex aspect-square items-center justify-center rounded-xl border text-xs font-semibold ${index === currentIndex ? 'border-primary bg-primary text-on-primary' : statusColors[safeStatus]}`}
                  >
                    {index + 1}
                  </button>
                )
              })}
            </div>
            <p className="mt-5 text-[10px] leading-5 text-subtle">
              {session.mode === 'exam' || !session.settings.instantFeedback
                ? 'Purple: current / answered · Amber: skipped · Unfilled: unanswered. Correctness is hidden until submission.'
                : 'Purple: current · Green: correct · Red: incorrect · Amber: skipped or needs review · Unfilled: unanswered.'}
            </p>
          </div>
        </Modal>
      )}
      {finish && (
        <Modal
          title={flashcard ? 'Wrap up your cards?' : 'Ready to finish?'}
          onClose={() => {
            if (!busy) setFinish(false)
          }}
        >
          <div className="space-y-4 p-6">
            <p className="text-sm leading-7 text-subtle">
              You’ve {flashcard ? 'reviewed' : 'answered'}{' '}
              <strong className="text-ink">
                {answeredCount} of {session.questionIds.length}
              </strong>{' '}
              questions.{' '}
              {session.questionIds.length - answeredCount > 0
                ? 'Unanswered questions will be counted as skipped.'
                : 'Nice focus. Let’s see how you did.'}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" disabled={busy} onClick={() => setFinish(false)}>
                Keep studying
              </Button>
              <Button busy={busy} onClick={submitSession}>
                Submit session
                <Check size={15} />
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function BookIcon() {
  return <Layers size={24} />
}

export function Feedback({
  question,
  answer,
  showExplanation = true,
}: {
  question: Question
  answer: Answer
  showExplanation?: boolean
}) {
  const correct = answer.status === 'correct'
  const review = answer.status === 'review-required'
  const partial = answer.status === 'partial'
  const skipped = answer.status === 'skipped'
  const bg = correct
    ? 'border-success/15 bg-success-soft text-success'
    : review || partial || skipped
      ? 'border-warning/15 bg-warning-soft text-warning'
      : 'border-danger/15 bg-danger-soft text-danger'
  const Icon = correct
    ? CheckCircle2
    : skipped
      ? SkipForward
      : review || partial
        ? ShieldAlert
        : XCircle
  const value = Array.isArray(question.correctAnswer)
    ? question.correctAnswer.join(' · ')
    : question.correctAnswer
  return (
    <div className={`border-t px-5 py-5 sm:px-8 ${bg}`} aria-live="polite">
      <div className="flex items-start gap-3">
        <Icon size={21} className="mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-bold">
            {correct
              ? 'That’s right. Nicely done!'
              : review
                ? 'Let’s give this one a closer look.'
                : skipped
                  ? 'Skipped, and still worth a closer look.'
                  : partial
                    ? `You’re on the right track. ${Math.round(answer.credit * 100)}% credit.`
                    : 'Not quite. This is a chance to learn.'}
          </p>
          {review && (
            <p className="mt-2 text-xs leading-6">
              This response needs manual review. It has not been confidently marked incorrect.
              Review-required responses currently earn no automatic credit.
            </p>
          )}
          {!correct && (
            <p className="mt-2 text-xs leading-6">
              <strong>
                {question.answerOrigin === 'generated'
                  ? 'Generated answer (review pending): '
                  : question.verificationStatus === 'review-required'
                  ? 'Supplied key (unverified): '
                  : 'Answer key: '}
              </strong>
              {value}
            </p>
          )}
          {question.reviewNote && <p className="mt-2 text-xs leading-6">{question.reviewNote}</p>}
          {question.type === 'enumeration' && Array.isArray(answer.value) && (
            <div className="mt-3 space-y-1.5">
              {(Array.isArray(question.correctAnswer)
                ? question.correctAnswer
                : [question.correctAnswer]
              ).map((expected) => {
                const matched = enumerationMatches(question, answer.value).matches.find(
                  (match) => match.expected === expected,
                )?.matched
                return (
                  <p
                    key={expected}
                    className={`flex items-center gap-2 text-xs ${matched ? 'text-success' : 'text-warning'}`}
                  >
                    {matched ? <Check size={13} /> : <X size={13} />}
                    {expected} · {matched ? 'matched' : 'missing / review wording'}
                  </p>
                )
              })}
              {enumerationMatches(question, answer.value).extra.map((response, i) => (
                <p
                  key={`${response}-${i}`}
                  className="flex items-center gap-2 text-xs text-warning"
                >
                  <ShieldAlert size={13} />“{response}” · unmatched / review wording
                </p>
              ))}
            </div>
          )}
          {showExplanation && (
            <p className="mt-3 text-xs leading-6 opacity-90">
              {question.explanation || 'No source explanation has been supplied for this question.'}
            </p>
          )}
          {showExplanation && question.formula && (
            <p className="mt-3 rounded-lg bg-surface/65 p-3 font-mono text-xs leading-6">
              {question.formula}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
