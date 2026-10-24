'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Play,
  Search,
  Target,
} from 'lucide-react'
import { useStudy } from '@/lib/study-context'
import { friendlyError } from '@/lib/firebase'
import { trackEvent } from '@/lib/activity-tracker'
import {
  Category,
  hasResponse,
  latestAnswers,
  modeLabels,
  Question,
  reviewedQuestionCount,
  sessionStats,
  typeLabels,
} from '@/lib/study-models'
import { CategoryIcon, relativeDate } from './category-card'
import { Badge, Button, EmptyState, Input, Progress, Select } from './ui'

export function CategoryDetail({
  category,
  onStart,
}: {
  category: Category
  onStart: (category: Category, ids?: string[]) => void
}) {
  const { user, data, loadQuestions, toggleBookmark, setActiveSessionId } = useStudy()
  const router = useRouter()
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(0)
  const [retry, setRetry] = useState(0)
  useEffect(() => { trackEvent('category_opened', { categoryId: category.id }) }, [category.id])
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    loadQuestions(category.id)
      .then((qs) => {
        if (active) {
          setQuestions(qs)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (active) {
          setError(friendlyError(err))
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [category.id, user?.uid, retry])
  const answers = latestAnswers(data.sessions, category.id)
  const completed = reviewedQuestionCount(data.sessions, category.id)
  const percent = Math.min(100, Math.round((completed / Math.max(questions.length, 1)) * 100))
  const sessions = Object.values(data.sessions)
    .filter((s) => s.categoryId === category.id)
    .sort((a, b) => b.updatedAt - a.updatedAt)
  const ongoing = sessions.find((s) => s.status === 'in-progress')
  const last = sessions.find((s) => s.status === 'completed')
  const filtered = useMemo(
    () =>
      questions.filter(
        (q) =>
          `${q.question} ${q.topic} ${q.originalNumber}`
            .toLowerCase()
            .includes(search.toLowerCase()) &&
          (filter === 'all' ||
            (filter === 'unanswered' && !hasResponse(answers[q.id])) ||
            (filter === 'correct' && answers[q.id]?.status === 'correct') ||
            (filter === 'incorrect' &&
              ['incorrect', 'partial', 'review-required'].includes(answers[q.id]?.status)) ||
            (filter === 'bookmarked' && data.bookmarks[category.id]?.[q.id])),
      ),
    [questions, search, filter, data.sessions, data.bookmarks, category.id],
  )
  const pages = Math.ceil(filtered.length / 10)

  return (
    <div className="page-enter space-y-6">
      <Button variant="ghost" className="px-0 text-xs" onClick={() => router.push('/categories')}>
        <ArrowLeft size={15} />
        Back to study categories
      </Button>
      <section className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
        <div className="flex flex-wrap items-start gap-4">
          <CategoryIcon category={category} size={28} className="size-15 rounded-2xl" />
          <div className="flex-1">
            <Badge className="mb-2 bg-primary-soft text-primary">SOURCE-DOCUMENT REVIEWER</Badge>
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">
              {category.title}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-subtle">{category.description}</p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-4 border-b border-line pb-6 text-xs text-subtle">
          <span className="flex items-center gap-1.5">
            <FileText size={14} />
            Source: {category.sourceDocument}
          </span>
          <span className="flex items-center gap-1.5">
            <BookOpen size={14} />
            {questions.length} available questions
            {category.expectedCount ? ` · ${category.expectedCount} expected originals` : ''}
          </span>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-5">
          <div className="flex flex-wrap gap-2">
            {[...new Set(questions.map((q) => q.type))].map((type) => (
              <Badge key={type} className="border border-line bg-canvas text-subtle">
                {typeLabels[type]}
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            {ongoing && (
              <Button
                variant="secondary"
                onClick={() => {
                  setActiveSessionId(ongoing.id)
                  router.push('/study')
                }}
              >
                <Play size={14} />
                Resume session
              </Button>
            )}
            <Button onClick={() => onStart(category)} disabled={!questions.length}>
              <Play size={14} />
              Start new session
            </Button>
          </div>
        </div>
      </section>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-surface p-5">
          <p className="flex items-center gap-2 text-xs text-subtle">
            <CheckCircle2 size={15} />
            Completion
          </p>
          <p className="my-3 font-display text-2xl font-bold text-ink">{percent}%</p>
          <Progress value={percent} />
          <p className="mt-2 text-[10px] text-subtle">
            {completed} of {questions.length} questions reviewed
          </p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-5">
          <p className="flex items-center gap-2 text-xs text-subtle">
            <Target size={15} />
            Last score
          </p>
          <p className="my-3 font-display text-2xl font-bold text-ink">
            {last ? `${sessionStats(last).percent}%` : '—'}
          </p>
          <p className="text-[10px] text-subtle">
            {last
              ? `${modeLabels[last.mode]} · ${relativeDate(last.completedAt)}`
              : 'Finish your first session to see a score'}
          </p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-5">
          <p className="flex items-center gap-2 text-xs text-subtle">
            <BookOpen size={15} />
            Study sessions
          </p>
          <p className="my-3 font-display text-2xl font-bold text-ink">{sessions.length}</p>
          <p className="text-[10px] text-subtle">
            Last studied: {relativeDate(sessions[0]?.updatedAt)}
          </p>
        </div>
      </div>
      <section className="overflow-hidden rounded-xl border border-line bg-surface">
        <div className="border-b border-line p-5">
          <h2 className="font-display text-base font-bold text-ink">Question directory</h2>
          <p className="mt-1 text-xs text-subtle">
            Find a concept. Bookmark it. Study one question at a time.
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <label className="relative flex-1">
              <Search size={16} className="absolute left-3 top-3.5 text-faint" />
              <Input
                aria-label="Search questions"
                placeholder="Search questions, topics, or original numbers…"
                className="pl-10"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(0)
                }}
              />
            </label>
            <Select
              aria-label="Filter question directory"
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value)
                setPage(0)
              }}
            >
              <option value="all">All questions</option>
              <option value="unanswered">Unanswered</option>
              <option value="correct">Correct</option>
              <option value="incorrect">Incorrect / review required</option>
              <option value="bookmarked">Bookmarked</option>
            </Select>
          </div>
        </div>
        {loading ? (
          <p className="p-10 text-center text-sm text-subtle">Loading questions…</p>
        ) : error ? (
          <div className="p-6 text-sm text-danger" role="alert">
            {error}
            <Button className="ml-3" variant="secondary" onClick={() => setRetry((r) => r + 1)}>
              Retry
            </Button>
          </div>
        ) : filtered.length ? (
          <div className="divide-y divide-line">
            {filtered.slice(page * 10, page * 10 + 10).map((q) => (
              <div key={q.id} className="flex items-center gap-3 px-5 py-4 hover:bg-canvas">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-[10px] font-semibold text-subtle">
                  {q.originalNumber}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-ink">{q.question}</p>
                  <div className="mt-1.5 flex flex-wrap gap-2 text-[10px] text-subtle">
                    <span>{q.topic}</span>
                    <span>·</span>
                    <span>{typeLabels[q.type]}</span>
                    {q.derived && <span className="text-primary">Derived</span>}
                    {answers[q.id] && (
                      <span
                        className={
                          answers[q.id].status === 'correct' ? 'text-success' : 'text-warning'
                        }
                      >
                        · {answers[q.id].status.replaceAll('-', ' ')}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  aria-label={
                    data.bookmarks[category.id]?.[q.id] ? 'Remove bookmark' : 'Bookmark question'
                  }
                  onClick={() => toggleBookmark(category.id, q.id).catch(() => {})}
                  className={`rounded-lg p-2 ${data.bookmarks[category.id]?.[q.id] ? 'bg-primary-soft text-primary' : 'text-faint hover:text-primary'}`}
                >
                  <Bookmark
                    size={16}
                    fill={data.bookmarks[category.id]?.[q.id] ? 'currentColor' : 'none'}
                  />
                </button>
                <Button
                  variant="ghost"
                  className="min-h-8 px-2 text-[10px]"
                  onClick={() => onStart(category, [q.id])}
                >
                  Study
                  <ArrowRight size={12} />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<BookOpen />}
            title="No matching questions"
            description="Try a different search or filter. If the bank is empty, official source questions still need to be imported."
          />
        )}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between border-t border-line p-4 text-[11px] text-subtle">
            <span>
              Showing {page * 10 + 1}–{Math.min((page + 1) * 10, filtered.length)} of{' '}
              {filtered.length}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                aria-label="Previous page"
                disabled={!page}
                onClick={() => setPage((p) => p - 1)}
                className="min-h-8 p-1.5"
              >
                <ChevronLeft size={16} />
              </Button>
              <span>
                Page {page + 1} of {pages}
              </span>
              <Button
                variant="ghost"
                aria-label="Next page"
                disabled={page >= pages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="min-h-8 p-1.5"
              >
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
