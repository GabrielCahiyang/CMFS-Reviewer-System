'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Flag,
  RotateCcw,
  ShieldAlert,
  SkipForward,
  Target,
  Trophy,
  XCircle,
} from 'lucide-react'
import { useStudy } from '@/lib/study-context'
import { Category, modeLabels, Question, sessionStats, StudyMode } from '@/lib/study-models'
import { friendlyError } from '@/lib/firebase'
import { questionsForSession } from '@/lib/question-presentation'
import { Badge, Button, EmptyState, Select } from './ui'
import { Feedback } from './quiz-player'

export function SessionResults({
  onStart,
}: {
  onStart: (category: Category, ids?: string[], mode?: StudyMode) => void
}) {
  const { user, data, categories, activeSessionId, loadQuestions, toggleBookmark } = useStudy()
  const router = useRouter()
  const session = activeSessionId ? data.sessions[activeSessionId] : undefined
  const [questions, setQuestions] = useState<Record<string, Question>>({})
  const [index, setIndex] = useState(0)
  const [filter, setFilter] = useState('all')
  const [error, setError] = useState('')
  useEffect(() => {
    if (!session) return
    let alive = true
    loadQuestions(session.categoryId, session.contentVersion)
      .then((value) => {
        if (alive) setQuestions(Object.fromEntries(questionsForSession(value, session).map((q) => [q.id, q])))
      })
      .catch((err) => {
        if (alive) setError(friendlyError(err))
      })
    return () => {
      alive = false
    }
  }, [session?.id, user?.uid])
  if (!session || session.status !== 'completed')
    return (
      <EmptyState
        icon={<Flag />}
        title="Your results will be here"
        description="Complete a study session, or choose a completed session from your history to see its results."
        action={
          <Button onClick={() => router.push('/history')}>
            Open session history
            <ArrowRight size={14} />
          </Button>
        }
      />
    )
  const stats = sessionStats(session)
  const category = categories.find((c) => c.id === session.categoryId)
  const incorrectIds = session.questionIds.filter((id) =>
    ['incorrect', 'partial', 'review-required'].includes(session.answers?.[id]?.status),
  )
  const ids = session.questionIds.filter(
    (id) =>
      filter === 'all' ||
      (filter === 'incorrect'
        ? incorrectIds.includes(id)
        : session.answers?.[id]?.status === filter),
  )
  const question = questions[ids[index]]
  const answer = session.answers?.[ids[index]]
  const duration = Math.max(
    1,
    Math.round(((session.completedAt || session.updatedAt) - session.startedAt) / 60000),
  )
  const flashcard = session.mode === 'flashcard'
  const pendingReview = stats.review > 0

  return (
    <div className="page-enter mx-auto max-w-5xl space-y-6">
      <Button variant="ghost" className="px-0 text-xs" onClick={() => router.push('/history')}>
        <ArrowLeft size={14} />
        Session history
      </Button>
      <section className="relative overflow-hidden rounded-2xl border border-primary/15 bg-surface p-6 text-center sm:p-9">
        <span className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <Trophy size={31} strokeWidth={1.5} />
        </span>
        <Badge className="mb-3 bg-success-soft text-success">
          <CheckCircle2 size={11} />
          SESSION COMPLETE
        </Badge>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">
          {stats.percent >= 80
            ? 'Look at you making progress.'
            : 'Every question is a step forward.'}
        </h1>
        <p className="mt-3 text-sm text-subtle">
          {category?.title || 'Study session'} · {modeLabels[session.mode]}
        </p>
        <div className="my-7">
          <strong className="font-display text-6xl font-extrabold tracking-tighter text-primary">
            {stats.percent}
            <span className="text-3xl">%</span>
          </strong>
          <p className="mt-2 text-xs text-subtle">
            {flashcard
              ? 'Self-assessed recall'
              : pendingReview
                ? 'Provisional score · review-required answers earn no automatic credit'
                : `${Number(stats.score.toFixed(2))} of ${session.questionIds.length} points earned`}
          </p>
        </div>
        <div className="mx-auto flex max-w-lg flex-wrap justify-center gap-x-6 gap-y-3 border-t border-line pt-5 text-[11px] text-subtle">
          <span className="flex items-center gap-1.5">
            <Clock3 size={13} />
            {duration} min
          </span>
          <span>{session.questionIds.length} questions</span>
          <span>
            {new Date(session.completedAt || session.updatedAt).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </span>
          <span className="text-success">Saved to Firebase</span>
        </div>
      </section>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: flashcard ? 'Know it' : 'Correct',
            value: stats.correct,
            icon: CheckCircle2,
            classes: 'bg-success-soft text-success',
          },
          {
            label: flashcard ? 'Study again' : 'Incorrect',
            value: stats.incorrect,
            icon: XCircle,
            classes: 'bg-danger-soft text-danger',
          },
          {
            label: 'Skipped',
            value: stats.skipped,
            icon: SkipForward,
            classes: 'bg-warning-soft text-warning',
          },
          {
            label: 'Partial / needs review',
            value: stats.partial + stats.review,
            icon: ShieldAlert,
            classes: 'bg-primary-soft text-primary',
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4"
          >
            <span className={`flex size-10 items-center justify-center rounded-xl ${stat.classes}`}>
              <stat.icon size={20} />
            </span>
            <div>
              <p className="font-display text-xl font-bold text-ink">{stat.value}</p>
              <p className="mt-1 text-[10px] text-subtle">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        {category && (
          <>
            <Button
              disabled={!incorrectIds.length}
              onClick={() => onStart(category, incorrectIds, session.mode)}
            >
              <RotateCcw size={14} />
              {flashcard ? 'Review difficult cards' : 'Retry incorrect / review'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => onStart(category, session.questionIds, session.mode)}
            >
              Retake session
            </Button>
          </>
        )}
        <Button variant="secondary" onClick={() => router.push('/categories')}>
          Another reviewer
          <ArrowRight size={14} />
        </Button>
        <Button variant="ghost" onClick={() => router.push('/dashboard')}>
          Dashboard
        </Button>
      </div>
      <section className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-5">
          <div>
            <h2 className="font-display text-base font-bold text-ink">A moment to reflect</h2>
            <p className="mt-1 text-xs text-subtle">Review your answers, one question at a time.</p>
          </div>
          <Select
            aria-label="Filter answer review"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value)
              setIndex(0)
            }}
          >
            <option value="all">All questions</option>
            <option value="correct">Correct</option>
            <option value="incorrect">Incorrect / needs review</option>
            <option value="skipped">Skipped</option>
          </Select>
        </div>
        {error ? (
          <p className="p-6 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : !ids.length ? (
          <p className="p-10 text-center text-sm text-subtle">No answers match this filter.</p>
        ) : question ? (
          <>
            <div className="p-5 sm:p-7">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex gap-2">
                  <Badge className="bg-muted text-subtle">
                    Review {index + 1} / {ids.length}
                  </Badge>
                  <Badge className="bg-primary-soft text-primary">{question.topic}</Badge>
                </div>
                <button
                  aria-label="Toggle bookmark"
                  onClick={() => toggleBookmark(session.categoryId, question.id).catch(() => {})}
                  className="p-2 text-primary"
                >
                  <Bookmark
                    size={18}
                    fill={
                      data.bookmarks[session.categoryId]?.[question.id] ? 'currentColor' : 'none'
                    }
                  />
                </button>
              </div>
              <h3 className="font-display text-lg leading-8 font-bold text-ink">
                {question.question}
              </h3>
              {question.proposedAnswer && <p className="mt-3 rounded-lg border border-primary/20 bg-primary-soft p-3 text-sm leading-6"><strong>Proposed answer:</strong> {question.proposedAnswer}</p>}
              <p className="mt-2 text-[10px] text-subtle">
                Original no. {question.originalNumber} · {question.sourceDocument}
                {question.sourcePage && question.sourcePage !== 'Not applicable'
                  ? ` · p. ${question.sourcePage}`
                  : ''}
              </p>
              <div className="mt-5 rounded-lg border border-line bg-canvas p-4">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-subtle">
                  {flashcard ? 'Your recall assessment' : 'Your answer'}
                </p>
                <p className="text-sm leading-6 text-ink">
                  {answer?.status === 'skipped'
                    ? 'Skipped'
                    : flashcard
                      ? answer?.status === 'correct'
                        ? 'Know it'
                        : 'Study again'
                      : Array.isArray(answer?.value)
                        ? answer.value.join(' · ')
                        : answer?.value || 'No answer'}
                </p>
              </div>
            </div>
            {answer && !flashcard && <Feedback question={question} answer={answer} />}
            {flashcard && (
              <p className="border-t border-line bg-primary-soft p-5 text-xs leading-6 text-primary">
                Source key:{' '}
                {Array.isArray(question.correctAnswer)
                  ? question.correctAnswer.join(' · ')
                  : question.correctAnswer}
                <br />
                {question.explanation}
              </p>
            )}
          </>
        ) : (
          <p className="p-8 text-center text-xs text-subtle">
            Loading the original question… If it has been removed, your response is still preserved
            in the session record.
          </p>
        )}
        {ids.length > 0 && (
          <div className="flex items-center justify-between border-t border-line p-4">
            <Button
              variant="secondary"
              className="min-h-8 text-xs"
              disabled={index === 0}
              onClick={() => setIndex((i) => i - 1)}
            >
              <ChevronLeft size={14} />
              Previous
            </Button>
            <span className="text-xs text-subtle">
              {index + 1} of {ids.length}
            </span>
            <Button
              variant="secondary"
              className="min-h-8 text-xs"
              disabled={index === ids.length - 1}
              onClick={() => setIndex((i) => i + 1)}
            >
              Next
              <ChevronRight size={14} />
            </Button>
          </div>
        )}
      </section>
    </div>
  )
}
