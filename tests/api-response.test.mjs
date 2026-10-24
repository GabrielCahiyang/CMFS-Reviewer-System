import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readApiResponse } from '../src/lib/api-response.ts'

test('empty and HTML server failures produce useful messages without leaking raw responses', async () => {
  for (const body of ['', '<html>private platform error details</html>']) {
    await assert.rejects(readApiResponse(new Response(body, { status: 500 }), 'Your session could not be saved.'), error =>
      error.message.includes('HTTP 500') && !/JSON|private platform|<html>/.test(error.message))
  }
})

test('structured API errors survive and malformed successful responses fail safely', async () => {
  await assert.rejects(readApiResponse(Response.json({ error: 'This session changed in another tab.' }, { status: 409 }), 'Failed.'), /changed in another tab/)
  for (const body of ['', 'null', '42'])
    await assert.rejects(readApiResponse(new Response(body), 'Failed.'), /invalid response/)
  assert.deepEqual(await readApiResponse(Response.json({ session: { id: 'saved' } }), 'Failed.'), { session: { id: 'saved' } })
})
