import { adminServices, apiError, authenticate } from '@/lib/server/firebase-admin'
export const runtime = 'nodejs'
export async function GET(request: Request) {
  try {
    const token = await authenticate(request)
    const data = (await adminServices().database.ref(`cfms/users/${token.uid}`).get()).val()
    return Response.json({ exportedAt: new Date().toISOString(), uid: token.uid, data }, { headers: {
      'Cache-Control':'no-store', 'Content-Disposition':'attachment; filename="cfms-study-data.json"',
    } })
  } catch (error) { return apiError(error) }
}
