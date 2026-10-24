import { test } from 'node:test'
import assert from 'node:assert/strict'
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { prepareVercel, clearVercel } from '../scripts/prepare-vercel.mjs'
import { verifyBuildTraces } from '../scripts/verify-build-traces.mjs'

async function fixture(run) {
  const prefix = path.join(tmpdir(), 'cfms-vercel-test-')
  const root = await mkdtemp(prefix)
  try { await run(root) }
  finally {
    assert.ok(path.resolve(root).startsWith(path.resolve(prefix)))
    await rm(root, { recursive: true, force: true })
  }
}

test('Vercel uses conventional entry points and preserves Make source and unowned app files', () => fixture(async root => {
  const managed = path.join(root, 'src/app/(payload)/layout.tsx')
  await mkdir(path.dirname(managed), { recursive: true })
  await writeFile(managed, 'platform-owned')
  const files = await prepareVercel(root)
  assert.equal(files.length, 9)
  assert.equal(files.filter(file => file.endsWith('/route.ts')).length, 4)
  assert.ok(files.every(file => !file.includes('.vercel.')))
  assert.equal(await readFile(managed, 'utf8'), 'platform-owned')
  await prepareVercel(root)
  const generatedPage = path.join(root, 'app/page.tsx')
  const originalPage = await readFile(generatedPage, 'utf8')
  await writeFile(generatedPage, originalPage + '// user edit\n')
  await assert.rejects(clearVercel(root), /edited/)
  assert.ok((await readFile(generatedPage, 'utf8')).includes('user edit'))
  await writeFile(generatedPage, originalPage)
  await clearVercel(root)
  await assert.rejects(access(path.join(root, 'app')))
  await mkdir(path.join(root, 'app'))
  await writeFile(path.join(root, 'app/page.tsx'), 'user-owned')
  await assert.rejects(prepareVercel(root), /not CFMS-generated/)
  await assert.rejects(clearVercel(root), /not CFMS-generated/)
  assert.equal(await readFile(path.join(root, 'app/page.tsx'), 'utf8'), 'user-owned')
}))

test('packaging validation catches the missing API client-reference manifest before upload', () => fixture(async root => {
  const route = path.join(root, 'server/app/api/study/account')
  await mkdir(route, { recursive: true })
  const manifest = 'route_client-reference-manifest.js'
  await writeFile(path.join(route, 'route.js.nft.json'), JSON.stringify({ version: 1, files: [manifest] }))
  await assert.rejects(verifyBuildTraces(root), /missing traced files.*route_client-reference-manifest/)
  await writeFile(path.join(route, manifest), 'test manifest')
  assert.deepEqual(await verifyBuildTraces(root), { traces: 1, checked: 1 })
}))
