import { trustedServices } from './lib/admin-client.mjs'
import { deleteApp } from 'firebase-admin/app'
import { applyEvent, dayKey } from '../src/lib/server/analytics.ts'
const services = trustedServices()
try {
  const cutoff = Date.now() - 90 * 86400000
  const base = services.database.ref('cfms')
  const snapshot = await base.child('activityEvents').orderByChild('occurredAt').startAt(cutoff).get()
  const daily = {}
  // Replay through the same idempotent ledger used by ingestion. Concurrent ingestion is safe;
  // this repairs missing summary writes without replacing an actively updated whole subtree.
  for (const [key,event] of Object.entries(snapshot.val() ?? {}).sort((a,b) => a[1].occurredAt-b[1].occurredAt)) {
    const score = event.type === 'session_completed' ? (await base.child(`analytics/scores/${event.uid}/${event.sessionId}`).get()).val() : undefined
    if (event.type === 'session_completed' && !score) { console.log(`Unscored completion ${event.sessionId}: requires trusted score repair.`); continue }
    const day = dayKey(event.occurredAt)
    daily[day] = (daily[day] ?? 0) + 1
    if (process.argv.includes('--apply')) await base.child(`analytics/daily/${day}`).transaction((bucket) => applyEvent(bucket,key,event,score))
  }
  console.log(JSON.stringify({ mode: process.argv.includes('--apply') ? 'applied' : 'dry-run', eventsByDay: daily },null,2))
} finally { await deleteApp(services.app) }
