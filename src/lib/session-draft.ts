import type { StudySession } from './study-models'

export interface SessionDraftRecord {
  version: 1
  draft: StudySession
  baseRevision: number
  sent?: { draft: StudySession; baseRevision: number }
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)]),
  )
  return value
}

// Server timestamps and computed scores can change without changing the user's work.
function sameWork(a: StudySession, b: StudySession) {
  const work = (session: StudySession) => ({
    id: session.id, categoryId: session.categoryId, mode: session.mode,
    settings: session.settings, questionIds: session.questionIds,
    currentQuestionIndex: session.currentQuestionIndex, status: session.status,
    contentVersion: session.contentVersion, choiceOrder: session.choiceOrder ?? {},
    answers: Object.fromEntries(Object.entries(session.answers ?? {}).map(([id, answer]) =>
      [id, { value: answer.value, skipped: answer.status === 'skipped' }])),
  })
  return JSON.stringify(canonical(work(a))) === JSON.stringify(canonical(work(b)))
}

/** Immediate local updates; only the latest snapshot is sent after each in-flight save. */
export class SessionDraftQueue {
  current: StudySession
  private baseRevision: number
  private pending = false
  private sent?: SessionDraftRecord['sent']
  private running?: Promise<StudySession>
  private timer?: ReturnType<typeof setTimeout>
  private stopped = false
  private refreshRequired = false

  constructor(initial: StudySession, private options: {
    send: (draft: StudySession, expectedRevision: number) => Promise<StudySession>
    refresh: () => Promise<StudySession | null>
    persist: (record: SessionDraftRecord | null) => void
    change: (session: StudySession) => void
    error: (error: unknown) => void
    delay?: number
  }, restored?: SessionDraftRecord) {
    this.current = restored?.draft ?? initial
    this.baseRevision = restored?.baseRevision ?? initial.revision
    this.pending = !!restored
    this.sent = restored?.sent
    this.refreshRequired = !!restored
    this.receive(initial)
  }

  get hasPending() { return this.pending }

  private publish() {
    this.options.persist(this.pending ? {
      version: 1, draft: this.current, baseRevision: this.baseRevision,
      ...(this.sent ? { sent: this.sent } : {}),
    } : null)
    if (!this.stopped) this.options.change(this.current)
  }

  stage(next: StudySession) {
    if (this.stopped || next.id !== this.current.id) throw new Error('This session is no longer active.')
    this.current = { ...next, revision: this.baseRevision, updatedAt: Date.now() }
    this.pending = true
    this.publish()
    this.schedule()
    return this.current
  }

  private acknowledge(saved: StudySession, submitted: StudySession) {
    if (saved.revision < this.baseRevision) return
    this.baseRevision = saved.revision
    if (this.sent && sameWork(this.sent.draft, submitted)) this.sent = undefined
    if (sameWork(this.current, submitted)) {
      this.current = saved
      this.pending = false
    } else this.current = { ...this.current, revision: saved.revision }
    this.publish()
  }

  receive(remote: StudySession) {
    if (remote.id !== this.current.id || remote.revision < this.baseRevision) return
    if (!this.pending) {
      this.current = remote
      this.baseRevision = remote.revision
    } else if (this.sent && remote.revision === this.sent.baseRevision + 1 && sameWork(remote, this.sent.draft)) {
      this.acknowledge(remote, this.sent.draft)
    }
  }

  schedule() {
    if (this.stopped || !this.pending || this.running || this.timer) return
    // Do not reset on every click: continuous interaction still saves regularly.
    this.timer = setTimeout(() => {
      this.timer = undefined
      void this.flush().catch(() => {})
    }, this.options.delay ?? 200)
  }

  flush(): Promise<StudySession> {
    if (this.timer) clearTimeout(this.timer)
    this.timer = undefined
    if (this.running) return this.running
    this.running = this.drain().finally(() => { this.running = undefined })
    return this.running
  }

  private async drain() {
    try {
      if (this.refreshRequired) {
        const remote = await this.options.refresh()
        if (remote) this.receive(remote)
        this.refreshRequired = false
      }
      while (this.pending && !this.stopped) {
        const submitted = this.current
        const revision = this.baseRevision
        this.sent = { draft: submitted, baseRevision: revision }
        this.publish()
        try {
          const saved = await this.options.send(submitted, revision)
          this.acknowledge(saved, submitted)
        } catch (error) {
          // The realtime listener can confirm the write before the HTTP response arrives.
          // A dropped response must not show a false failure or block later local work.
          if (this.baseRevision <= revision) throw error
        }
      }
      return this.current
    } catch (error) {
      this.refreshRequired = true
      if (!this.stopped) this.options.error(error)
      throw error
    }
  }

  stop() {
    this.stopped = true
    if (this.timer) clearTimeout(this.timer)
    this.timer = undefined
  }
}

export const sessionDraftKey = (uid: string, id: string) => `cfms-session-draft:v1:${uid}:${id}`
