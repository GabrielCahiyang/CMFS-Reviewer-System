import { apiError, authenticate, HttpError } from '@/lib/server/firebase-admin'
import { ingestEvent } from '@/lib/server/ingest-event'

export const runtime = 'nodejs'
export async function POST(request: Request) {
  try {
    const token = await authenticate(request)
    const text = await request.text()
    if (text.length > 4096) throw new HttpError(413, 'Activity payload too large.')
    let body
    try { body = JSON.parse(text) } catch { throw new HttpError(400, 'Invalid JSON.') }
    const result = await ingestEvent(token, body)
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return apiError(error) }
}
