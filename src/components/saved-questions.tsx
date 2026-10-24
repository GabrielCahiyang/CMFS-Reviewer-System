'use client'

import { useEffect, useState } from 'react'
import {
  ArrowRight,
  Bookmark,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  Target,
} from 'lucide-react'
import { useStudy } from '@/lib/study-context'
import { Category, latestAnswers, Question, typeLabels } from '@/lib/study-models'
import { friendlyError } from '@/lib/firebase'
import { Badge, Button, EmptyState, Input, Select } from './ui'
import { useRouter } from 'next/navigation'

export function SavedQuestions({
  mistakes = false,
  onStart,
}: {
  mistakes?: boolean
  onStart: (category: Category, ids?: string[]) => void
}) {
  const { user, data, categories, loadQuestions, toggleBookmark } = useStudy()
  const router = useRouter()
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(0)
  const [retry, setRetry] = useState(0)
  const answersByCategory = Object.fromEntries(categories.map((category) => [category.id, latestAnswers(data.sessions, category.id)]))
  const requiredCategories = categories.filter((category) =>
    mistakes
      ? Object.keys(latestAnswers(data.sessions, category.id)).some((id) =>
          ['incorrect', 'partial', 'review-required'].includes(answersByCategory[category.id]?.[id]?.status),
        )
      : Object.values(data.bookmarks[category.id] ?? {}).some(Boolean),
  )
  const requiredKey = requiredCategories.map((c) => c.id).join(',')
  useEffect(() => {
    let alive = true
    setLoading(true)
    setError('')
    Promise.all(requiredCategories.map((c) => loadQuestions(c.id)))
      .then((lists) => {
        if (alive) {
          setQuestions(lists.flat())
          setLoading(false)
        }
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
  }, [user?.uid, requiredKey, retry])
  const selected = questions.filter(
    (q) =>
      (mistakes
        ? ['incorrect', 'partial', 'review-required'].includes(answersByCategory[q.categoryId]?.[q.id]?.status)
        : data.bookmarks[q.categoryId]?.[q.id]) &&
      (filter === 'all' || q.categoryId === filter) &&
      `${q.question} ${q.topic}`.toLowerCase().includes(search.toLowerCase()),
  )
  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="font-display text-[27px] font-extrabold tracking-tight text-ink">
          {mistakes ? 'Review mistakes' : 'Saved questions'}
        </h1>
        <p className="mt-2 text-xs leading-6 text-subtle">
          {mistakes
            ? 'Incorrect, partial-credit, and review-required responses. A fresh chance to understand, not just memorize.'
            : 'Your personal collection of concepts worth coming back to. Synced to your account when you’re signed in.'}
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <Search size={15} className="absolute left-3 top-3.5 text-faint" />
          <Input
            placeholder="Find a question or concept…"
            aria-label="Search saved questions"
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(0)
            }}
          />
        </label>
        <Select
          aria-label="Filter by reviewer"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value)
            setPage(0)
          }}
        >
          <option value="all">All reviewers</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </Select>
      </div>
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-primary" />
        </div>
      ) : error ? (
        <div role="alert" className="rounded-xl bg-danger-soft p-5 text-sm text-danger">
          {error}
          <Button variant="secondary" className="ml-4" onClick={() => setRetry((r) => r + 1)}>
            Retry
          </Button>
        </div>
      ) : selected.length ? (
        <section className="overflow-hidden rounded-xl border border-line bg-surface">
          <div className="border-b border-line px-5 py-4 text-xs font-semibold text-ink">
            {selected.length} questions {mistakes ? 'to revisit' : 'bookmarked'}
          </div>
          <div className="divide-y divide-line">
            {selected.slice(page * 10, page * 10 + 10).map((question) => {
              const category = categories.find((c) => c.id === question.categoryId)!
              return (
                <article key={question.id} className="flex items-start gap-4 p-5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    {mistakes ? <Target size={17} /> : <Bookmark size={17} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap gap-2">
                      <Badge className="bg-muted text-subtle">{category.title}</Badge>
                      <Badge className="bg-primary-soft text-primary">
                        {typeLabels[question.type]}
                      </Badge>
                      {mistakes && (
                        <Badge className="bg-warning-soft text-warning">
                          {answersByCategory[question.categoryId]?.[question.id]?.status.replaceAll('-', ' ')}
                        </Badge>
                      )}
                    </div>
                    <p className="line-clamp-2 text-sm leading-6 font-medium text-ink">
                      {question.question}
                    </p>
                    <p className="mt-2 text-[10px] text-subtle">
                      No. {question.originalNumber} · {question.topic}
                      {question.derived ? ' · Derived content' : ''}
                    </p>
                    <Button
                      variant="ghost"
                      className="mt-2 min-h-8 px-0 text-[11px]"
                      onClick={() => onStart(category, [question.id])}
                    >
                      Practice this question
                      <ArrowRight size={13} />
                    </Button>
                  </div>
                  <button
                    aria-label="Toggle bookmark"
                    onClick={() => toggleBookmark(question.categoryId, question.id).catch(() => {})}
                    className={`rounded-lg p-2 ${data.bookmarks[question.categoryId]?.[question.id] ? 'text-primary' : 'text-faint'}`}
                  >
                    <Bookmark
                      size={18}
                      fill={
                        data.bookmarks[question.categoryId]?.[question.id] ? 'currentColor' : 'none'
                      }
                    />
                  </button>
                </article>
              )
            })}
          </div>
          <div className="flex items-center justify-between border-t border-line p-4 text-xs text-subtle">
            <Button variant="ghost" disabled={!page} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft size={14} />
              Previous
            </Button>
            <span>
              {page + 1} / {Math.ceil(selected.length / 10)}
            </span>
            <Button
              variant="ghost"
              disabled={(page + 1) * 10 >= selected.length}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight size={14} />
            </Button>
          </div>
        </section>
      ) : (
        <EmptyState
          icon={mistakes ? <Target /> : <Bookmark />}
          title={
            mistakes
              ? 'A fresh start for every concept'
              : 'A place for your “come back to this” moments'
          }
          description={
            mistakes
              ? 'Questions that need another look will appear here after your sessions. Try a reviewer to get started.'
              : 'Tap the bookmark icon on a question to save it here. Your collection will be ready when you are.'
          }
          action={
            <Button onClick={() => router.push('/categories')}>
              Explore reviewers
              <ArrowRight size={14} />
            </Button>
          }
        />
      )}
    </div>
  )
}
