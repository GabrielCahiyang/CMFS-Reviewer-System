import { mkdir, writeFile } from 'node:fs/promises'
import { deleteApp } from 'firebase-admin/app'
import { trustedServices } from './lib/admin-client.mjs'
import { hash } from './lib/import-core.mjs'

// Add query metadata only; preserve every existing grant and unrelated namespace.
const services = trustedServices()
try {
  const original = await services.database.getRulesJSON()
  const updated = structuredClone(original)
  let node = updated.rules
  for (const key of ['cfms', 'users']) {
    if (node[key] === undefined) node[key] = {}
    if (!node[key] || typeof node[key] !== 'object' || Array.isArray(node[key])) throw new Error('Unexpected existing rules structure.')
    node = node[key]
  }
  const wildcards = Object.keys(node).filter(key => key.startsWith('$'))
  if (wildcards.length > 1) throw new Error('Multiple user wildcard rules require manual review.')
  const userKey = wildcards[0] || '$uid'
  for (const key of [userKey, 'sessions']) {
    if (node[key] === undefined) node[key] = {}
    if (!node[key] || typeof node[key] !== 'object' || Array.isArray(node[key])) throw new Error('Unexpected existing session rules structure.')
    node = node[key]
  }
  const existing = node['.indexOn']
  if (existing !== undefined && typeof existing !== 'string' && !Array.isArray(existing)) throw new Error('Unexpected existing query index.')
  node['.indexOn'] = [...new Set([...(typeof existing === 'string' ? [existing] : existing || []), 'updatedAt'])]
  if (hash(original) !== hash(updated)) {
    if (!process.argv.includes('--apply')) {
      console.log('Preview: add updatedAt index to CFMS user sessions; existing rules remain unchanged.')
    } else {
      await mkdir('private-backups', { recursive: true })
      await writeFile(`private-backups/cfms-session-index-${Date.now()}.json`, JSON.stringify(original, null, 2), { flag: 'wx' })
      if (hash(await services.database.getRulesJSON()) !== hash(original)) throw new Error('Rules changed during preparation. Retry after review.')
      await services.database.setRules(updated)
      if (hash(await services.database.getRulesJSON()) !== hash(updated)) throw new Error('Index read-back verification failed.')
      console.log('CFMS session updatedAt index applied and verified; existing grants and unrelated rules preserved.')
    }
  } else console.log('CFMS session updatedAt index is already present.')
} finally { await deleteApp(services.app) }
