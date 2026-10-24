'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  BarChart3,
  ChevronRight,
  Clock3,
  History,
  Play,
  Search,
  TrendingUp,
} from 'lucide-react'
import { useStudy } from '@/lib/study-context'
import { modeLabels, sessionStats } from '@/lib/study-models'
import { Badge, Button, EmptyState, Input, Select } from './ui'
import { CategoryIcon } from './category-card'

export function SessionHistory() {
  const { data, categories, setActiveSessionId, loadOlderSessions } = useStudy()
  const [olderBusy, setOlderBusy] = useState(false)
  const [olderAvailable, setOlderAvailable] = useState(true)
  const [olderError, setOlderError] = useState('')
  const router = useRouter()
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const sessions = Object.values(data.sessions).sort((a, b) => b.updatedAt - a.updatedAt)
  const completed = sessions.filter((s) => s.status === 'completed')
  const points = [...completed].reverse().slice(-10)
  const filtered = sessions.filter(
    (s) =>
      (filter === 'all' || s.status === filter) &&
      (categories.find((c) => c.id === s.categoryId)?.title || '')
        .toLowerCase()
        .includes(search.toLowerCase()),
  )
  function open(id: string, complete: boolean) {
    setActiveSessionId(id)
    router.push(complete ? '/results' : '/study')
  }
  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="font-display text-[27px] font-extrabold tracking-tight text-ink">
          Session history
        </h1>
        <p className="mt-2 text-xs text-subtle">
          Resume a saved session or review completed results.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-line bg-surface p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xs font-semibold text-ink">
              <TrendingUp size={16} className="text-primary" />
              Performance over time
            </h2>
            <span className="text-[10px] text-subtle">Last {points.length} completed sessions</span>
          </div>
          {points.length > 1 ? (
            <div
              className="mt-7 flex h-32 items-end justify-around gap-3 border-b border-line px-4"
              aria-label="Session scores"
            >
              {points.map((session, i) => (
                <div
                  key={session.id}
                  className="relative flex h-full flex-1 items-end justify-center"
                >
                  <button
                    title={`${sessionStats(session).percent}% · ${new Date(session.completedAt || session.updatedAt).toLocaleDateString()}`}
                    onClick={() => open(session.id, true)}
                    className="group relative w-full max-w-13 rounded-t-md bg-primary/65 transition-colors hover:bg-primary"
                    style={{ height: `${Math.max(5, sessionStats(session).percent)}%` }}
                  >
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-subtle">
                      {sessionStats(session).percent}%
                    </span>
                  </button>
                  <span className="absolute -bottom-5 text-[9px] text-subtle">{i + 1}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-32 items-center justify-center text-xs text-subtle">
              Complete two sessions to start seeing your trend.
            </div>
          )}
          <p className="mt-8 text-[10px] text-faint">
            Session order · Scores include partial credit; review-required responses are not
            automatically credited.
          </p>
        </section>
        <section className="flex flex-col justify-center rounded-xl border border-primary/10 bg-primary-soft p-6">
          <span className="mb-3 flex size-10 items-center justify-center rounded-xl bg-surface text-primary">
            <BarChart3 size={21} />
          </span>
          <p className="font-display text-3xl font-extrabold text-ink">{completed.length}</p>
          <p className="mt-1 text-xs text-subtle">sessions completed</p>
          <p className="mt-5 text-xs leading-6 text-subtle">
            Consistency matters more than perfection. Your next session is another chance to grow.
          </p>
        </section>
      </div>
      <div className="flex flex-col justify-between gap-3 sm:flex-row">
        <label className="relative sm:w-80">
          <Search size={15} className="absolute left-3 top-3.5 text-faint" />
          <Input
            className="pl-9"
            placeholder="Search by reviewer…"
            aria-label="Search session history"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(0)
            }}
          />
        </label>
        <Select
          value={filter}
          aria-label="Filter sessions"
          onChange={(e) => {
            setFilter(e.target.value)
            setPage(0)
          }}
        >
          <option value="all">All sessions</option>
          <option value="in-progress">In progress</option>
          <option value="completed">Completed</option>
        </Select>
      </div>
      {filtered.length ? (
        <section className="overflow-hidden rounded-xl border border-line bg-surface">
          <div className="hidden grid-cols-12 gap-3 border-b border-line bg-canvas px-5 py-3 text-[10px] font-semibold text-subtle sm:grid">
            <span className="col-span-5">REVIEWER</span>
            <span className="col-span-2">DATE</span>
            <span className="col-span-2">STATUS</span>
            <span className="col-span-1">SCORE</span>
            <span className="col-span-2 text-right">DETAILS</span>
          </div>
          <div className="divide-y divide-line">
            {filtered.slice(page * 10, page * 10 + 10).map((session) => {
              const category = categories.find((c) => c.id === session.categoryId)
              const complete = session.status === 'completed'
              return (
                <button
                  key={session.id}
                  onClick={() => open(session.id, complete)}
                  className="grid w-full grid-cols-12 items-center gap-3 px-5 py-5 text-left transition-colors hover:bg-canvas"
                >
                  <span className="col-span-9 flex items-center gap-3 sm:col-span-5">
                    {category && (
                      <CategoryIcon category={category} size={17} className="size-9 rounded-lg" />
                    )}
                    <span>
                      <span className="block text-xs font-semibold text-ink">
                        {category?.title || session.categoryId}
                      </span>
                      <span className="mt-1 block text-[10px] text-subtle">
                        {modeLabels[session.mode]} · {session.questionIds.length} questions
                      </span>
                    </span>
                  </span>
                  <span className="col-span-2 hidden text-[10px] text-subtle sm:block">
                    {new Date(session.startedAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                  <span className="col-span-2 hidden sm:block">
                    <Badge
                      className={
                        complete ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning'
                      }
                    >
                      {complete ? 'Completed' : 'In progress'}
                    </Badge>
                  </span>
                  <span className="col-span-2 text-xs font-bold text-ink sm:col-span-1">
                    {complete ? `${sessionStats(session).percent}%` : '—'}
                  </span>
                  <span className="col-span-1 flex items-center justify-end gap-1 text-[10px] font-semibold text-primary sm:col-span-2">
                    <span className="hidden sm:inline">{complete ? 'View results' : 'Resume'}</span>
                    {complete ? <ChevronRight size={14} /> : <Play size={13} />}
                  </span>
                </button>
              )
            })}
          </div>
          {filtered.length > 10 && (
            <div className="flex items-center justify-between border-t border-line p-4 text-xs text-subtle">
              <Button variant="ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span>
                Page {page + 1} of {Math.ceil(filtered.length / 10)}
              </span>
              <Button
                variant="ghost"
                disabled={(page + 1) * 10 >= filtered.length}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </section>
      ) : (
        <EmptyState
          icon={<History />}
          title="No study sessions yet"
          description="Choose a reviewer to start your first session."
          action={
            <Button onClick={() => router.push('/categories')}>
              Start your first session
              <ArrowRight size={14} />
            </Button>
          }
        />
      )}
      {sessions.length >= 100 && olderAvailable && <div className="flex flex-wrap items-center gap-4"><Button variant="secondary" busy={olderBusy} onClick={async () => {
        setOlderBusy(true); setOlderError('')
        try { setOlderAvailable(await loadOlderSessions()) } catch { setOlderError('Earlier sessions could not be loaded. Please retry.') } finally { setOlderBusy(false) }
      }}>Load earlier history</Button><p className="text-xs text-subtle">Statistics cover the {sessions.length} loaded sessions.</p></div>}
      {olderError && <p role="alert" className="text-xs text-danger">{olderError}</p>}
    </div>
  )
}
