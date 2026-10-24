/** Keep empty/HTML platform failures from surfacing as JSON parser errors. */
export async function readApiResponse<T>(response: Response, fallback: string): Promise<T> {
  let data: unknown
  try { data = await response.json() }
  catch {
    throw new Error(response.ok
      ? `${fallback} The server returned an invalid response. Please try again.`
      : `${fallback} The server returned HTTP ${response.status}. Please try again.`)
  }
  if (!response.ok) {
    const error = data && typeof data === 'object' && 'error' in data ? data.error : undefined
    throw new Error(typeof error === 'string' && error.trim()
      ? error : `${fallback} The server returned HTTP ${response.status}. Please try again.`)
  }
  if (data === null || typeof data !== 'object')
    throw new Error(`${fallback} The server returned an invalid response. Please try again.`)
  return data as T
}
