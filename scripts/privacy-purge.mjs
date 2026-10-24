import { trustedServices } from './lib/admin-client.mjs'
import { deleteApp } from 'firebase-admin/app'
const services = trustedServices()
try {
  const cutoff = Date.now() - 90 * 86400000
  const base = services.database.ref('cfms')
  const expired = await base.child('activityEvents').orderByChild('occurredAt').endAt(cutoff).limitToFirst(500).get()
  const updates = Object.fromEntries(Object.keys(expired.val() ?? {}).map((key) => [`activityEvents/${key}`,null]))
  console.log(`${Object.keys(updates).length} expired raw events in this batch. ${process.argv.includes('--apply') ? 'Applying retention.' : 'Dry run; use --apply after review.'}`)
  if (process.argv.includes('--apply') && Object.keys(updates).length) await base.update(updates)
} finally { await deleteApp(services.app) }
