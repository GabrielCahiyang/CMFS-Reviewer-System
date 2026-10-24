'use client'
import { firebaseServices } from './firebase'

export async function adminReport<T>(params: Record<string, string | number>, signal?: AbortSignal): Promise<T> {
  const user = firebaseServices().auth.currentUser
  if (!user) throw new Error('Please sign in.')
  const query = new URLSearchParams(Object.entries(params).map(([k,v]) => [k, String(v)]))
  const response = await fetch(`/api/study/admin?${query}`, {
    headers: { Authorization: `Bearer ${await user.getIdToken()}` }, cache: 'no-store', signal,
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'The report could not be loaded.')
  return data as T
}

export function downloadCsv<T extends object>(filename: string, rows: T[]) {
  if (!rows.length) return
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))]
  const cell = (value: unknown) => {
    let s = String(value ?? '')
    if (/^[=+@\-\t\r]/.test(s)) s = `'${s}`
    return `"${s.replaceAll('"', '""')}"`
  }
  const csv = [keys.map(cell).join(','), ...rows.map((r) => keys.map((k) => cell((r as Record<string, unknown>)[k])).join(','))].join('\r\n')
  const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
