'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowDownWideNarrow,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Flame,
  Lightbulb,
  Play,
  Target,
  TrendingUp,
} from 'lucide-react'
import { useStudy } from '@/lib/study-context'
import { Category, reviewedQuestionCount, sessionStats } from '@/lib/study-models'
import { CategoryCard, relativeDate } from './category-card'
import { FinanceArt } from './finance-art'
import { Badge, Button, EmptyState, Select } from './ui'

export function Dashboard({
  onStart,
  libraryOnly = false,
  flashcardsOnly = false,
}: {
  onStart: (category: Category) => void
  libraryOnly?: boolean
  flashcardsOnly?: boolean
}) {
  const { user, categories, categoriesLoading, data, setActiveSessionId } = useStudy()
  const router = useRouter()
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('default')
  const sessions = Object.values(data.sessions)
  const finished = sessions.filter((s) => s.status === 'completed')
  const count = finished.reduce(
    (total, session) => total + session.questionIds.length - sessionStats(session).skipped,
    0,
  )
  const graded = finished.filter((session) => session.mode !== 'flashcard')
  const gradedCount = graded.reduce((total, session) => total + session.questionIds.length, 0)
  const correct = graded.reduce((total, session) => total + sessionStats(session).score, 0)
  const accuracy = Math.round((correct / Math.max(gradedCount, 1)) * 100)
  const minutes = Math.round(
    finished.reduce(
      (total, s) => total + ((s.completedAt || s.updatedAt) - s.startedAt) / 60000,
      0,
    ),
  )
  const unfinished = sessions
    .filter((s) => s.status === 'in-progress')
    .sort((a, b) => b.updatedAt - a.updatedAt)[0]
  const firstName = (data.profile?.displayName || user?.displayName || 'Student').split(' ')[0]
  const filtered = useMemo(() => {
    const list = categories.filter((category) => {
      const answered = reviewedQuestionCount(data.sessions, category.id)
      const started = Object.values(data.sessions).some(
        (session) => session.categoryId === category.id,
      )
      return (
        filter === 'all' ||
        (filter === 'progress' && started && answered < category.questionCount) ||
        (filter === 'new' && !started) ||
        (filter === 'completed' && answered >= category.questionCount)
      )
    })
    if (sort === 'name') list.sort((a, b) => a.title.localeCompare(b.title))
    if (sort === 'count') list.sort((a, b) => b.questionCount - a.questionCount)
    return list
  }, [categories, data.sessions, filter, sort])

  function start() {
    if (unfinished) {
      setActiveSessionId(unfinished.id)
      router.push('/study')
    } else if (categories[0]) onStart(categories[0])
  }

  const stats = [
    {
      label: 'Questions practiced',
      value: count,
      icon: BookOpen,
      color: 'bg-primary-soft text-primary',
      detail: 'Saved responses in loaded history',
      tag: 'Keep it going',
    },
    {
      label: 'Overall accuracy',
      value: `${accuracy}%`,
      icon: Target,
      color: 'bg-green-soft text-green-ink',
      detail: 'Completed quizzes · excludes flashcards',
      tag: 'Your performance',
    },
    {
      label: 'Sessions completed',
      value: finished.length,
      icon: CheckCheck,
      color: 'bg-blue-soft text-blue-ink',
      detail: 'Completed sessions in loaded history',
      tag: 'Building momentum',
    },
    {
      label: 'Total study time',
      value: minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`,
      icon: Clock3,
      color: 'bg-orange-soft text-orange-ink',
      detail: 'Elapsed session time',
      tag: 'Well spent',
    },
  ]

  return (
    <div className="page-enter space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[27px] font-extrabold tracking-tight text-ink">
            {flashcardsOnly
              ? 'Flashcards'
              : libraryOnly
                ? 'Study categories'
                : 'Dashboard'}
          </h1>
          <p className="mt-1.5 text-[12px] text-subtle">
            {flashcardsOnly
              ? 'Review questions as flashcards.'
              : libraryOnly
                ? 'Choose a reviewer to begin.'
                : `Welcome back, ${firstName}. Continue a session or choose a reviewer.`}
          </p>
        </div>
        <span className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-[11px] text-subtle">
          <CalendarDays size={14} />
          {new Date().toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </span>
      </div>
      {!libraryOnly && !flashcardsOnly && (
        <>
          <section className="relative flex min-h-51 overflow-hidden rounded-2xl border border-primary/10 bg-primary-soft">
            <div className="relative z-10 flex max-w-2xl flex-col items-start justify-center p-6 sm:p-7 lg:w-3/5 lg:p-8">
              <span className="mb-3 flex items-center gap-1.5 text-[10px] font-bold tracking-[.1em] text-primary">
                <span className="size-1.5 rounded-full bg-primary" />
                CONTINUE STUDYING
              </span>
              <h2 className="font-display text-[25px] leading-tight font-extrabold tracking-tight text-ink sm:text-[28px]">
                Ready for your next session?
              </h2>
              <p className="mt-3 max-w-md text-xs leading-6 text-subtle">
                Choose a reviewer to practice, review mistakes, or use flashcards.
                <br className="hidden xl:block" /> 
              </p>
              <Button
                onClick={start}
                disabled={!categories.length}
                className="mt-5 min-h-9 gap-2.5 px-4 py-2 text-[11px]"
              >
                {unfinished ? 'Continue your session' : 'Start studying'}
                <ArrowRight size={14} />
              </Button>
            </div>
            <div className="absolute -right-6 bottom-0 hidden h-55 w-95 sm:block sm:opacity-30 lg:right-5 lg:opacity-100">
              <FinanceArt />
            </div>
            <div className="hero-pattern absolute right-0 top-0 h-full w-24 opacity-10" />
          </section>
          <section
            className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4"
            aria-label="Your study statistics"
          >
            {stats.map((stat) => (
              <article
                key={stat.label}
                className="rounded-xl border border-line bg-surface p-4 lg:p-5"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[11px] font-medium text-subtle">{stat.label}</span>
                  <span
                    className={`flex size-8 items-center justify-center rounded-lg ${stat.color}`}
                  >
                    <stat.icon size={16} strokeWidth={1.6} />
                  </span>
                </div>
                <div className="flex items-end justify-between">
                  <strong className="font-display text-[28px] leading-none font-extrabold tracking-tight text-ink">
                    {stat.value}
                  </strong>
                  {stat.label === 'Overall accuracy' && count > 0 && (
                    <Badge className="bg-success-soft text-success">
                      <TrendingUp size={10} />
                      Growing
                    </Badge>
                  )}
                </div>
                <p className="mt-3 text-[10px] text-subtle">{stat.detail}</p>
              </article>
            ))}
          </section>
        </>
      )}
      <section>
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h2 className="font-display text-lg font-extrabold tracking-tight text-ink">
              {flashcardsOnly
                ? 'Choose your card deck'
                : libraryOnly
                  ? 'Explore the reviewers'
                  : 'Your study library'}
            </h2>
            <Badge className="border border-line bg-surface text-subtle">
              {categories.length} reviewers
            </Badge>
          </div>
          {!libraryOnly && !flashcardsOnly && (
            <button
              onClick={() => router.push('/categories')}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-primary"
            >
              View all categories
              <ArrowRight size={13} />
            </button>
          )}
        </div>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex max-w-full gap-1 overflow-x-auto rounded-lg bg-muted/75 p-1">
            {[
              ['all', 'All reviewers'],
              ['progress', 'In progress'],
              ['new', 'Not started'],
              ['completed', 'Completed'],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className={`shrink-0 rounded-md px-3 py-2 text-[10px] font-medium transition-all ${filter === id ? 'bg-surface text-primary shadow-sm' : 'text-subtle hover:text-ink'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-[10px] text-subtle">
            <ArrowDownWideNarrow size={13} />
            <Select
              aria-label="Sort reviewers"
              className="min-h-8 border-none bg-transparent py-1 text-[10px]"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="default">Default order</option>
              <option value="name">Name A–Z</option>
              <option value="count">Question count</option>
            </Select>
          </label>
        </div>
        {categoriesLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="h-74 animate-pulse rounded-xl border border-line bg-muted" />
            ))}
          </div>
        ) : filtered.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((category) => (
              <CategoryCard
                key={category.id}
                category={category}
                onStart={onStart}
                flashcardMode={flashcardsOnly}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<BookOpen />}
            title={
              categories.length
                ? 'No matching reviewers'
                : 'Reviewers are not available yet'
            }
            description={
              categories.length
                ? 'No reviewers match this filter. Explore all reviewers to find your next topic.'
                : 'The question library has not been published yet. Please check back after your administrator adds the reviewers.'
            }
            action={
              categories.length ? (
                <Button variant="secondary" onClick={() => setFilter('all')}>
                  Show all reviewers
                </Button>
              ) : undefined
            }
          />
        )}
      </section>
      {!libraryOnly && !flashcardsOnly && (
        <div className="grid gap-5 lg:grid-cols-3">
          <section className="rounded-xl border border-line bg-surface p-5 lg:col-span-2">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-sm font-bold text-ink">Your recent activity</h2>
              <button
                className="flex items-center gap-1 text-[10px] font-medium text-primary"
                onClick={() => router.push('/history')}
              >
                Session history
                <ChevronRight size={13} />
              </button>
            </div>
            {finished.length ? (
              [...finished]
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .slice(0, 3)
                .map((session) => (
                  <button
                    key={session.id}
                    className="flex w-full items-center gap-3 border-t border-line py-3 text-left first-of-type:border-0"
                    onClick={() => {
                      setActiveSessionId(session.id)
                      router.push('/results')
                    }}
                  >
                    <span className="flex size-8 items-center justify-center rounded-lg bg-success-soft text-success">
                      <CheckCircle2 size={16} />
                    </span>
                    <div className="flex-1">
                      <p className="text-xs font-medium text-ink">
                        {categories.find((c) => c.id === session.categoryId)?.title ||
                          'Study session'}
                      </p>
                      <p className="mt-1 text-[10px] text-subtle">
                        {session.questionIds.length} questions · {relativeDate(session.completedAt)}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-ink">
                      {sessionStats(session).percent}%
                    </span>
                    <ChevronRight size={14} className="text-faint" />
                  </button>
                ))
            ) : (
              <p className="py-6 text-xs leading-6 text-subtle">
                Completed sessions will appear here.
              </p>
            )}
          </section>
          <section className="relative flex flex-col justify-center overflow-hidden rounded-xl border border-warning/10 bg-warning-soft p-6">
            <span className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-warning">
              <Lightbulb size={15} />Quick practice
            </span>
            <h3 className="font-display text-base font-bold text-ink">
              Practice a few questions
            </h3>
            <p className="mt-2 text-[11px] leading-6 text-subtle">
              Choose your question count and feedback settings before you begin.
            </p>
            <button
              onClick={start}
              className="mt-4 flex items-center gap-2 text-[11px] font-semibold text-warning"
            >
              Start a quick practice
              <ArrowRight size={13} />
            </button>
            <Flame size={100} className="absolute -bottom-6 -right-5 rotate-12 text-warning/5" />
          </section>
        </div>
      )}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5 text-[10px] text-faint">
        <span>CFMS Study Hub</span>
        <span className="flex items-center gap-1.5">
          <BookOpen size={11} />
          CFMS Study Hub · Your personal study space
        </span>
      </footer>
    </div>
  )
}
