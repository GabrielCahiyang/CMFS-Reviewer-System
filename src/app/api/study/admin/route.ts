import { adminServices, apiError, authenticate, HttpError } from '@/lib/server/firebase-admin'
import { dayKey } from '@/lib/server/analytics'
import { safeId } from '@/lib/question-schema'
import { eventTypes, type ActivityEvent } from '@/lib/activity-models'

export const runtime = 'nodejs'
export async function GET(request: Request) {
  try {
    await authenticate(request, true)
    const params = new URL(request.url).searchParams
    const { database } = adminServices()
    const base = database.ref('cfms')
    const kind = params.get('kind') ?? 'overview'
    const end = Number(params.get('end') || Date.now())
    const start = Number(params.get('start') || end - 30 * 86400000)
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || end - start > 90 * 86400000)
      throw new HttpError(400, 'Choose a date range of at most 90 days.')
    const uid = params.get('uid') || ''
    const categoryId = params.get('categoryId') || ''
    const type = params.get('type') || ''
    const mode = params.get('mode') || ''
    if ((uid && !safeId(uid)) || (categoryId && !safeId(categoryId)) || (type && !eventTypes.includes(type as never)) || (mode && !['practice','exam','mixed','flashcard'].includes(mode))) throw new HttpError(400, 'Invalid filter.')
    const reply = (data: unknown) => Response.json(data, { headers: { 'Cache-Control': 'no-store' } })
    if (kind === 'activity') {
      const cursorTime = Number(params.get('cursorTime') || end)
      const cursorKey = params.get('cursorKey') || ''
      if (!Number.isFinite(cursorTime) || cursorTime < start || cursorTime > end || (cursorKey && !safeId(cursorKey))) throw new HttpError(400, 'Invalid page cursor.')
      // Scan a bounded indexed window; empty filtered pages retain a cursor so older matches remain reachable.
      const query = base.child('activityEvents').orderByChild('occurredAt').startAt(start)
      const snapshot = await (cursorKey ? query.endBefore(cursorTime, cursorKey) : query.endAt(cursorTime)).limitToLast(201).get()
      const rows: Array<ActivityEvent & { key: string }> = []
      snapshot.forEach((s) => { rows.push({ ...s.val(), key: s.key! }) })
      const hasMore = rows.length > 200
      const scanned = rows.slice(hasMore ? 1 : 0).reverse()
      const events = scanned.filter((e) => (!uid || e.uid === uid) && (!categoryId || e.categoryId === categoryId) && (!type || e.type === type) && (!mode || e.mode === mode))
      const oldest = scanned.at(-1)
      return reply({ events, next: hasMore && oldest ? { cursorTime: oldest.occurredAt, cursorKey: oldest.key } : null, scanned: scanned.length })
    }
    if (kind === 'students') {
      const after = params.get('after') || ''
      if (after && !safeId(after)) throw new HttpError(400, 'Invalid directory cursor.')
      let query = base.child('admin/userDirectory').orderByKey()
      if (after) query = query.startAfter(after)
      const snapshot = await query.limitToFirst(51).get()
      const students: Record<string, unknown>[] = []
      snapshot.forEach((s) => { students.push({ ...s.val(), uid: s.key }) })
      return reply({ students: students.slice(0, 50), next: students.length > 50 ? students[49].uid : null })
    }
    if (kind === 'student') {
      if (!uid) throw new HttpError(400, 'Choose a student.')
      const [profile, scores] = await Promise.all([
        base.child(`admin/userDirectory/${uid}`).get(),
        base.child(`analytics/scores/${uid}`).orderByChild('completedAt').startAt(start).endAt(end).limitToLast(100).get(),
      ])
      return reply({ profile: profile.val(), scores: scores.val() ?? {} })
    }
    if (kind !== 'overview') throw new HttpError(400, 'Unknown report.')
    const [daily, imports] = await Promise.all([
      base.child('analytics/daily').orderByKey().startAt(dayKey(start)).endAt(dayKey(end)).get(),
      base.child('sourceImports').orderByChild('appliedAt').limitToLast(6).get(),
    ])
    // The internal event ledger is never serialized into the admin response.
    const days = Object.fromEntries(Object.entries(daily.val() ?? {}).map(([day, raw]) => {
      const { processed: _processed, ...summary } = raw as Record<string, unknown>
      return [day, summary]
    }))
    return reply({ days, imports: imports.val() ?? {}, timezone: 'Asia/Manila', generatedAt: Date.now() })
  } catch (error) { return apiError(error) }
}
