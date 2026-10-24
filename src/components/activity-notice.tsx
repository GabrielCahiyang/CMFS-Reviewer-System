'use client'
import { useSyncExternalStore } from 'react'
import { activityStatus, subscribeActivity, flushActivity } from '@/lib/activity-tracker'
export function ActivityNotice() {
  const status = useSyncExternalStore(subscribeActivity,activityStatus,() => 'idle')
  if (status !== 'error') return null
  return <div role="status" className="rounded-xl border border-warning/20 bg-warning-soft px-4 py-3 text-xs text-warning">Activity reporting is unavailable. Your study saves are handled separately. <button onClick={() => void flushActivity()} className="ml-2 font-semibold underline">Retry reporting</button></div>
}
