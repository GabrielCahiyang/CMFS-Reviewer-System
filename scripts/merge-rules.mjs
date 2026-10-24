import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { trustedServices } from './lib/admin-client.mjs'
import { hash } from './lib/import-core.mjs'
import { deleteApp } from 'firebase-admin/app'
const services = trustedServices()
try {
  const live = await services.database.getRulesJSON()
  // A root wildcard can match cfms too. Refuse grants on ancestors or root wildcard siblings.
  if ((live.rules?.['.read'] && live.rules['.read'] !== false && live.rules['.read'] !== 'false') ||
      (live.rules?.['.write'] && live.rules['.write'] !== false && live.rules['.write'] !== 'false') ||
      Object.keys(live.rules ?? {}).some((key) => key.startsWith('$')))
    throw new Error('Existing root grants/wildcards may expose cfms. Review and narrow the live root rules before merging. No rules deployed.')
  const local = JSON.parse(await readFile('firebase.database.rules.json','utf8'))
  const merged = { ...live, rules: { ...live.rules, cfms: local.rules.cfms } }
  await mkdir('private-backups',{ recursive: true }); await mkdir('seed-output',{ recursive: true })
  const checksum = hash(merged)
  await writeFile('seed-output/MERGED_RULES.json',JSON.stringify(merged,null,2))
  console.log(`Prepared merged rules ${checksum}. Unrelated namespaces preserved. Test this exact merged file with the emulator.`)
  if (process.argv.includes('--apply')) {
    if (process.argv[process.argv.indexOf('--confirm-rules')+1] !== checksum) throw new Error('Apply requires --confirm-rules <reviewed checksum>.')
    await writeFile(`private-backups/rules-${Date.now()}.json`,JSON.stringify(live,null,2),{ flag: 'wx' })
    await services.database.setRules(merged)
    console.log('Merged rules deployed.')
  }
} finally { await deleteApp(services.app) }
