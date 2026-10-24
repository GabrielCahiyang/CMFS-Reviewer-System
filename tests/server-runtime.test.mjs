import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

test('Firebase Auth cold-starts and resolves signing keys under the Vercel ESM restriction', async () => {
  const { stdout } = await promisify(execFile)(process.execPath,
    ['--no-experimental-require-module', 'scripts/verify-server-runtime.mjs'], { timeout: 30000 })
  assert.match(stdout, /passed without require\(esm\)/)
})
