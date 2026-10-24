'use client'
import { firebaseServices } from './firebase'
import type { EventInput, EventType } from './activity-models'

type Pending = { uid: string; event: EventInput; attempts: number }
let queue: Pending[] = []
let running = false
let timer: ReturnType<typeof setTimeout> | undefined
let status: 'idle' | 'pending' | 'error' = 'idle'
let dropped = false
const subscribers = new Set<() => void>()
function setStatus(next: typeof status) { status = next; subscribers.forEach((f) => f()) }
export const activityStatus = () => status
export function subscribeActivity(callback: () => void) { subscribers.add(callback); return () => { subscribers.delete(callback) } }
export function clearActivityQueue() { queue = []; dropped = false; clearTimeout(timer); setStatus('idle') }
export function keepActivityFor(uid?: string) { queue = queue.filter((p) => p.uid === uid); if (!queue.length) setStatus('idle') }
export function trackEvent(type: EventType, details: Omit<EventInput, 'type'|'eventId'> = {}, eventId = crypto.randomUUID()) {
  const uid = firebaseServices().auth.currentUser?.uid
  if (!uid) return
  if (queue.length >= 100) { setStatus('error'); return }
  if (!queue.some((p) => p.event.eventId === eventId && p.uid === uid)) queue.push({ uid, event: { type, eventId, ...details }, attempts: 0 })
  setStatus('pending')
  void flushActivity()
}
export async function flushActivity() {
  if (running) return
  running = true
  try {
    while (queue.length) {
      const pending = queue[0]
      const user = firebaseServices().auth.currentUser
      if (!user || pending.uid !== user.uid) { queue.shift(); continue }
      try {
        const response = await fetch('/api/study/events', {
          method: 'POST', headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(pending.event), keepalive: true, signal: AbortSignal.timeout(10000),
        })
        if (!response.ok) throw new Error('Activity sync unavailable')
        if (queue[0] === pending) queue.shift()
      } catch {
        if (pending.uid !== firebaseServices().auth.currentUser?.uid) { queue.shift(); continue }
        pending.attempts++
        setStatus('error')
        if (pending.attempts >= 5) { dropped = true; queue.shift(); continue }
        timer = setTimeout(() => void flushActivity(), Math.min(30000, 1000 * 2 ** pending.attempts))
        return
      }
    }
    // Keep a visible warning after dropped events; never affect session writes.
    setStatus(dropped ? 'error' : 'idle')
  } finally { running = false }
}

export function trackVisibleQuestion(details: { categoryId: string; questionId: string; sessionId: string }) {
  let since = 0
  let viewed = false
  const isVisible = () => document.visibilityState === 'visible' && document.hasFocus()
  const end = () => {
    if (!since) return
    const durationMs = Math.min(300000, Math.max(0, Math.round(performance.now() - since)))
    since = 0
    if (durationMs >= 500) trackEvent('reading_summary', { ...details, durationMs })
  }
  const change = () => {
    if (isVisible()) {
      if (!viewed) { trackEvent('question_viewed', details); viewed = true }
      if (!since) since = performance.now()
    } else end()
  }
  const interval = setInterval(() => { end(); change() }, 60000)
  document.addEventListener('visibilitychange', change)
  window.addEventListener('focus', change)
  window.addEventListener('blur', change)
  window.addEventListener('pagehide', end)
  change()
  return () => {
    end(); clearInterval(interval)
    document.removeEventListener('visibilitychange', change)
    window.removeEventListener('focus', change); window.removeEventListener('blur', change)
    window.removeEventListener('pagehide', end)
  }
}
