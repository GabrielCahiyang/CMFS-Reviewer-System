'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Activity, ArrowLeft, ArrowRight, BarChart3, Download, RefreshCw, ShieldCheck, Users } from 'lucide-react'
import { useStudy } from '@/lib/study-context'
import { adminReport, downloadCsv } from '@/lib/admin-analytics-service'
import { eventTypes, type ActivityEvent } from '@/lib/activity-models'
import type { DailyBucket, Totals, ValidatedScore } from '@/lib/server/analytics'
import { Badge, Button, EmptyState, Input, Select } from '../ui'

type Summary = { days: Record<string, Omit<DailyBucket, 'processed'>>; generatedAt: number; timezone: string }
type Student = { uid: string; displayName: string; email: string; createdAt: number; lastLogin: number }
type Cursor = { cursorTime: number; cursorKey: string }
const zero = (): Totals => ({ logins: 0, starts: 0, completions: 0, categoryOpens: 0, views: 0, durationMs: 0, scoreSum: 0, gradedSessions: 0, flashcards: 0 })
const add = (a: Totals, b: Totals) => { for (const k of Object.keys(a) as Array<keyof Totals>) a[k] += b[k] ?? 0; return a }
const date = (timestamp?: number) => timestamp ? new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }).format(timestamp) : '—'
const dateInput = (timestamp: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(timestamp)
const panel = 'rounded-2xl border border-line bg-surface p-5 sm:p-6'
const headings = ['Overview', 'Students', 'Activity log', 'Question insights']
const paths = ['study-admin', 'study-admin/students', 'study-admin/activity', 'study-admin/questions']

export function AnalyticsDashboard({ page }: { page: string }) {
  const { isAdmin, claimsLoading, categories } = useStudy()
  const router = useRouter()
  const tab = Math.max(0, paths.indexOf(page))
  const [start, setStart] = useState(() => dateInput(Date.now() - 29 * 86400000))
  const [end, setEnd] = useState(() => dateInput(Date.now()))
  const [summary, setSummary] = useState<Summary>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [uid, setUid] = useState('')
  const [categoryId, setCategory] = useState('')
  const [type, setType] = useState('')
  const [mode, setMode] = useState('')
  const [events, setEvents] = useState<Array<ActivityEvent & { key: string }>>([])
  const [cursor, setCursor] = useState<Cursor>()
  const [next, setNext] = useState<Cursor | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [studentAfter, setStudentAfter] = useState('')
  const [nextStudent, setNextStudent] = useState<string | null>(null)
  const [studentSearch, setStudentSearch] = useState('')
  const [selected, setSelected] = useState<Student>()
  const [scores, setScores] = useState<ValidatedScore[]>([])
  const range = useMemo(() => ({ start: Date.parse(`${start}T00:00:00+08:00`), end: Math.min(Date.now(), Date.parse(`${end}T23:59:59.999+08:00`)) }), [start,end,refresh])
  useEffect(() => { setCursor(undefined); setStudentAfter('') }, [start,end,uid,categoryId,type,mode])

  useEffect(() => {
    if (!isAdmin) return
    const controller = new AbortController()
    setLoading(true); setError(''); setEvents([]); setStudents([]); setScores([])
    const run = async () => {
      const overview = await adminReport<Summary>({ kind: 'overview', ...range }, controller.signal)
      setSummary(overview)
      if (tab === 2 || selected) {
        const result = await adminReport<{ events: typeof events; next: Cursor | null }>({ kind: 'activity', ...range,
          uid: selected?.uid || uid, categoryId, type, mode, ...(cursor ?? {}) }, controller.signal)
        setEvents(result.events); setNext(result.next)
      }
      if (tab === 1) {
        if (selected) {
          const result = await adminReport<{ scores: Record<string, ValidatedScore> }>({ kind: 'student', uid: selected.uid, ...range }, controller.signal)
          setScores(Object.values(result.scores).sort((a,b) => b.completedAt - a.completedAt))
        } else {
          const result = await adminReport<{ students: Student[]; next: string | null }>({ kind: 'students', after: studentAfter, ...range }, controller.signal)
          setStudents(result.students); setNextStudent(result.next)
        }
      }
    }
    run().catch((e) => { if (!controller.signal.aborted) setError(e.message) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [isAdmin,tab,range,refresh,uid,categoryId,type,mode,cursor,studentAfter,selected])

  const rollup = useMemo(() => {
    const total = zero(), categoryTotals: Record<string, Totals> = {}, userTotals: Record<string, Totals & { lastActive: number }> = {}
    const questions: Record<string, { categoryId: string; questionId: string; correct: number; incorrect: number; skipped: number; review: number }> = {}
    for (const b of Object.values(summary?.days ?? {})) {
      add(total, b.totals)
      for (const [id,t] of Object.entries(b.categories ?? {})) add(categoryTotals[id] ??= zero(),t)
      for (const [id,t] of Object.entries(b.users ?? {})) { const u = userTotals[id] ??= { ...zero(), lastActive: 0 }; add(u,t); u.lastActive = Math.max(u.lastActive, t.lastActive) }
      for (const [cat,qs] of Object.entries(b.questions ?? {})) for (const [id,t] of Object.entries(qs)) {
        const q = questions[`${cat}/${id}`] ??= { categoryId: cat, questionId: id, correct: 0, incorrect: 0, skipped: 0, review: 0 }
        q.correct += t.correct; q.incorrect += t.incorrect; q.skipped += t.skipped; q.review += t.review
      }
    }
    return { total, categoryTotals, userTotals, questions: Object.values(questions).sort((a,b) => b.incorrect - a.incorrect) }
  }, [summary])

  if (claimsLoading) return <p className="p-8 text-sm text-subtle" role="status">Checking access…</p>
  if (!isAdmin) return <EmptyState icon={<ShieldCheck />} title="Administrator access required" description="This report is available to authorized administrators." action={<Button onClick={() => router.push('/dashboard')}>Return to study hub</Button>} />
  const categoryTitle = (id: string) => categories.find((c) => c.id === id)?.title || id
  const totals = rollup.total
  const filteredStudents = students.filter((s) => `${s.displayName} ${s.email} ${s.uid}`.toLowerCase().includes(studentSearch.toLowerCase()))
  const activityTable = <>
    <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-xs">
      <thead className="border-b border-line text-subtle"><tr>{['Time · Manila','Student UID','Activity','Reviewer / Question','Details'].map((h) => <th key={h} className="p-3 font-medium">{h}</th>)}</tr></thead>
      <tbody>{events.map((e) => <tr key={e.key} className="border-b border-line/60"><td className="whitespace-nowrap p-3">{date(e.occurredAt)}</td><td className="max-w-40 truncate p-3" title={e.uid}>{e.uid}</td><td className="p-3">{e.type.replaceAll('_',' ')}</td><td className="p-3">{e.categoryId ? categoryTitle(e.categoryId) : '—'}{e.questionId && <span className="block text-subtle">{e.questionId}</span>}</td><td className="p-3">{e.durationMs !== undefined ? `${Math.round(e.durationMs / 1000)}s visible` : e.mode || e.authMethod || e.action || '—'}</td></tr>)}</tbody>
    </table></div>
    {!loading && !events.length && <p className="py-10 text-center text-sm text-subtle">No matching events in this page. {next ? 'Continue to older events to search further.' : ''}</p>}
    <div className="mt-4 flex flex-wrap justify-between gap-3"><Button variant="secondary" disabled={!events.length || loading} onClick={() => downloadCsv('study-activity.csv', events)}> <Download size={14} /> Export this page</Button><div className="flex gap-2"><Button variant="secondary" disabled={!cursor} onClick={() => setCursor(undefined)}>Newest</Button><Button variant="secondary" disabled={!next || loading} onClick={() => setCursor(next ?? undefined)}>Older events <ArrowRight size={14} /></Button></div></div>
  </>
  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><Badge className="mb-3 bg-primary-soft text-primary"><ShieldCheck size={12} /> Administration</Badge><h1 className="font-display text-3xl font-extrabold tracking-tight">{selected ? selected.displayName : headings[tab]}</h1><p className="mt-2 text-xs text-subtle">Study activity and server-recomputed results · Asia/Manila</p></div><Button variant="secondary" onClick={() => setRefresh((v) => v + 1)}><RefreshCw size={14} />Refresh</Button></div>
    <nav className="flex flex-wrap gap-2" aria-label="Administration">{headings.map((h,i) => <Button key={h} variant={tab === i ? 'primary' : 'secondary'} onClick={() => { setSelected(undefined); router.push(`/${paths[i]}`) }}>{h}</Button>)}</nav>
    <div className={`${panel} flex flex-wrap items-end gap-4`}><label className="space-y-2 text-xs">From<Input aria-label="From date" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label><label className="space-y-2 text-xs">Through<Input aria-label="Through date" type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></label><p className="pb-3 text-xs text-subtle">Daily totals include the selected Manila calendar days. Up to 90 days.</p></div>
    {error && <div role="alert" className="rounded-xl border border-danger/25 bg-danger-soft p-4 text-sm text-danger">{error}</div>}
    {loading && <p role="status" className="text-sm text-subtle">Loading report…</p>}
    {!error && !loading && !Object.keys(summary?.days ?? {}).length && <div className={panel}><p className="text-sm text-subtle">No study activity has been recorded for these dates.</p></div>}
    {tab === 0 && <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
        ['Active students',Object.keys(rollup.userTotals).length,Users],['App sign-ins',totals.logins,Activity],
        ['Completed sessions',totals.completions,ShieldCheck],['Average accuracy',totals.gradedSessions ? `${Math.round(totals.scoreSum / totals.gradedSessions)}%` : '—',BarChart3],
        ['Sessions started',totals.starts,Activity],['Completion rate',totals.starts ? `${Math.round(totals.completions / totals.starts * 100)}%` : '—',ShieldCheck],
        ['Foreground study',`${Math.round(totals.durationMs / 60000)} min`,Activity],['Flashcard reviews',totals.flashcards,BarChart3],
      ].map(([label,value,Icon]) => { const I = Icon as typeof Users; return <section key={String(label)} className={panel}><I size={18} className="text-primary" /><p className="mt-4 text-xs text-subtle">{String(label)}</p><p className="mt-1 font-display text-3xl font-bold">{String(value)}</p></section> })}</div>
      <section className={panel}><h2 className="font-semibold">Daily sign-ins and completions</h2><div className="mt-5 space-y-3">{Object.entries(summary?.days ?? {}).map(([day,b]) => <div key={day} className="grid grid-cols-[90px_1fr_90px] items-center gap-3 text-xs"><span>{day}</span><div className="space-y-1"><progress className="block h-2 w-full accent-indigo-600" value={b.totals.logins} max={Math.max(1,...Object.values(summary?.days ?? {}).map((d) => d.totals.logins))} aria-label={`${day}: ${b.totals.logins} sign-ins`} /><progress className="block h-2 w-full accent-emerald-600" value={b.totals.completions} max={Math.max(1,...Object.values(summary?.days ?? {}).map((d) => d.totals.completions))} aria-label={`${day}: ${b.totals.completions} completions`} /></div><span className="text-right text-subtle">{b.totals.logins} / {b.totals.completions}</span></div>)}</div><p className="mt-4 text-xs text-subtle">Indigo: sign-ins · Green: completions</p></section>
      <section className={panel}><h2 className="mb-4 font-semibold">Reviewer performance</h2><div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-xs"><thead><tr>{['Reviewer','Opens','Starts','Completed','Average score'].map((h) => <th key={h} className="p-3 text-subtle">{h}</th>)}</tr></thead><tbody>{Object.entries(rollup.categoryTotals).map(([id,t]) => <tr key={id} className="border-t border-line"><td className="p-3">{categoryTitle(id)}</td><td className="p-3">{t.categoryOpens}</td><td className="p-3">{t.starts}</td><td className="p-3">{t.completions}</td><td className="p-3">{t.gradedSessions ? `${Math.round(t.scoreSum / t.gradedSessions)}%` : '—'}</td></tr>)}</tbody></table></div></section>
    </>}
    {tab === 1 && <section className={panel}>{selected ? <>
      <Button variant="ghost" onClick={() => { setSelected(undefined); setCursor(undefined) }}><ArrowLeft size={14} />Students</Button><p className="my-4 text-sm text-subtle">{selected.email} · Last sign-in {date(selected.lastLogin)}</p>
      <h2 className="mb-3 font-semibold">Recomputed scores</h2><div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-xs"><thead><tr>{['Completed','Reviewer','Mode','Score','Status'].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{scores.map((s) => <tr key={s.sessionId} className="border-t border-line"><td className="p-3">{date(s.completedAt)}</td><td className="p-3">{categoryTitle(s.categoryId)}</td><td className="p-3">{s.mode}</td><td className="p-3">{s.mode === 'flashcard' ? 'Self-assessed' : `${s.score}/${s.maxScore} · ${s.percent}%`}</td><td className="p-3">{s.provisional ? `Provisional · ${s.review} to review` : 'Recomputed'}</td></tr>)}</tbody></table></div>{!scores.length && <p className="my-6 text-xs text-subtle">No scored sessions in this range.</p>}<h2 className="mb-3 mt-8 font-semibold">Activity timeline</h2>{activityTable}
    </> : <><Input aria-label="Search loaded students" placeholder="Search this page by name, email, or UID" value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} /><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[700px] text-left text-xs"><thead><tr>{['Student','Last sign-in','Last active','Sessions started / completed','Accuracy'].map((h) => <th key={h} className="p-3 text-subtle">{h}</th>)}</tr></thead><tbody>{filteredStudents.map((s) => { const t = rollup.userTotals[s.uid]; return <tr key={s.uid} className="border-t border-line"><td className="p-3"><button className="font-semibold text-primary underline-offset-4 hover:underline" onClick={() => { setSelected(s); setCursor(undefined) }}>{s.displayName}</button><p className="mt-1 text-subtle">{s.email}</p></td><td className="p-3">{date(s.lastLogin)}</td><td className="p-3">{date(t?.lastActive)}</td><td className="p-3">{t?.starts ?? 0} / {t?.completions ?? 0}</td><td className="p-3">{t?.gradedSessions ? `${Math.round(t.scoreSum / t.gradedSessions)}%` : '—'}</td></tr> })}</tbody></table></div>{!students.length && !loading && <p className="py-10 text-center text-sm text-subtle">No students have been recorded yet.</p>}<div className="mt-4 flex justify-between"><Button variant="secondary" disabled={!students.length} onClick={() => downloadCsv('study-students.csv', students)}>Export this page</Button><Button variant="secondary" disabled={!nextStudent || loading} onClick={() => setStudentAfter(nextStudent ?? '')}>Next page <ArrowRight size={14} /></Button></div></> }</section>}
    {tab === 2 && <section className={panel}><div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Input aria-label="Filter by student UID" placeholder="Student UID" value={uid} onChange={(e) => setUid(e.target.value)} /><Select aria-label="Filter reviewer" value={categoryId} onChange={(e) => setCategory(e.target.value)}><option value="">All reviewers</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Select><Select aria-label="Filter activity" value={type} onChange={(e) => setType(e.target.value)}><option value="">All activities</option>{eventTypes.map((t) => <option key={t} value={t}>{t.replaceAll('_',' ')}</option>)}</Select><Select aria-label="Filter study mode" value={mode} onChange={(e) => setMode(e.target.value)}><option value="">All modes</option>{['practice','exam','mixed','flashcard'].map((m) => <option key={m} value={m}>{m}</option>)}</Select></div>{activityTable}</section>}
    {tab === 3 && <section className={panel}><h2 className="font-semibold">Questions needing attention</h2><p className="mt-2 text-xs text-subtle">Counts from completed, recomputed sessions. Questions with uncertain keys remain flagged.</p><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[600px] text-left text-xs"><thead><tr>{['Reviewer / Question','Correct','Incorrect / partial','Skipped','Review required'].map((h) => <th key={h} className="p-3 text-subtle">{h}</th>)}</tr></thead><tbody>{rollup.questions.map((q) => <tr key={`${q.categoryId}/${q.questionId}`} className="border-t border-line"><td className="p-3">{categoryTitle(q.categoryId)}<p className="mt-1 text-subtle">{q.questionId}</p></td><td className="p-3">{q.correct}</td><td className="p-3 text-danger">{q.incorrect}</td><td className="p-3">{q.skipped}</td><td className="p-3 text-warning">{q.review}</td></tr>)}</tbody></table></div>{!rollup.questions.length && !loading && <p className="py-10 text-center text-sm text-subtle">Question insights appear after completed sessions are processed.</p>}<Button className="mt-4" variant="secondary" disabled={!rollup.questions.length} onClick={() => downloadCsv('question-insights.csv', rollup.questions)}>Export insights</Button></section>}
    <p className="text-xs leading-6 text-subtle">Updated {date(summary?.generatedAt)}. Scores are recomputed from saved answers and versioned source keys. Activity describes app use; it does not certify reading or exam security. Completion rate uses starts and completions within this date range, which may belong to different sessions.</p>
  </div>
}
