import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { deleteApp } from 'firebase-admin/app'
import { trustedServices } from './lib/admin-client.mjs'
import { validatedFiles } from './lib/seed-files.mjs'
import { fieldDiff, hash, stableJson, safeKey } from './lib/import-core.mjs'

const args = process.argv.slice(2).filter((a) => a !== '--')
const command = args[0] ?? 'preview'
const option = (key) => args[args.indexOf(key) + 1]
let services
try {
  if (!['preview','apply','verify','rollback'].includes(command)) throw new Error('Use preview, apply, verify, or rollback.')
  const files = command === 'rollback' ? undefined : await validatedFiles()
  services = trustedServices()
  const base = services.database.ref('cfms')
  if (command === 'rollback') {
    if (!args.includes('--backup') || !args.includes('--confirm-import-id')) throw new Error('Rollback requires --backup <private file> --confirm-import-id <current import>.')
    const backup = JSON.parse(await readFile(option('--backup'),'utf8'))
    if (!backup.categories || !backup.questions || !backup.replacedBy || backup.replacedBy !== option('--confirm-import-id')) throw new Error('Backup/confirmation mismatch.')
    for (const id of Object.keys(backup.categories)) if (!safeKey(id)) throw new Error('Unsafe backup key.')
    const current = (await base.child('sourceImports').child(backup.replacedBy).get()).val()
    if (current?.status !== 'applied') throw new Error('Current import is not applied.')
    const updates = { [`sourceImports/${backup.replacedBy}/status`]: 'rolled-back' }
    for (const id of Object.keys(backup.questions)) { updates[`questions/${id}`] = backup.questions[id]; updates[`categories/${id}`] = backup.categories[id] }
    await base.update(updates)
    console.log('Previous banks and metadata restored. Archived versions remain for historic sessions.')
  } else if (command === 'verify') {
    for (const [id,bank] of Object.entries(files.banks)) {
      const [questions,category,archive] = await Promise.all([base.child(`questions/${id}`).get(),base.child(`categories/${id}`).get(),base.child(`questionBankVersions/${id}/${files.categories[id].contentVersion}/questions`).get()])
      if (stableJson(questions.val()) !== stableJson(bank) || stableJson(category.val()) !== stableJson(files.categories[id]) || stableJson(archive.val()) !== stableJson(bank)) throw new Error(`${id}: read-back mismatch.`)
      console.log(`${id}: ${Object.keys(bank).length} records verified.`)
    }
  } else {
    const before = { categories: {}, questions: {}, replacedBy: files.importId }
    const diffs = []
    for (const id of Object.keys(files.banks)) {
      before.categories[id] = (await base.child(`categories/${id}`).get()).val()
      before.questions[id] = (await base.child(`questions/${id}`).get()).val()
      diffs.push(...fieldDiff(before.categories[id],files.categories[id],`categories/${id}`),...fieldDiff(before.questions[id],files.banks[id],`questions/${id}`))
    }
    await writeFile('seed-output/DATABASE_DIFF.json',JSON.stringify({ importId: files.importId, diffs },null,2))
    const answerChanges = diffs.filter((d) => /\/correctAnswer(?:\/|$)/.test(d.path) && d.before !== null)
    console.log(`Import ${files.importId}: ${diffs.length} changed fields; ${answerChanges.length} existing answer changes. Review seed-output/DATABASE_DIFF.json.`)
    if (command === 'apply') {
      if (!args.includes('--confirm-import-id') || option('--confirm-import-id') !== files.importId) throw new Error('Apply requires the exact reviewed --confirm-import-id.')
      if (answerChanges.length && !args.includes('--approve-answer-changes')) throw new Error('Existing answer keys change. Review the diff before using --approve-answer-changes.')
      const previous = (await base.child(`sourceImports/${files.importId}`).get()).val()
      if (previous?.status === 'applied' && !diffs.length) console.log('Identical import already applied; no writes.')
      else {
        const lock = base.child('admin/importLock')
        const claim = await lock.transaction((v) => v && v.expiresAt > Date.now() ? undefined : { importId: files.importId, expiresAt: Date.now()+600000 })
        if (!claim.committed) throw new Error('Another import is running.')
        try {
          // Re-read under the cooperative import lock. Fail if any content changed since preview.
          for (const id of Object.keys(files.banks)) if (stableJson((await base.child(`questions/${id}`).get()).val()) !== stableJson(before.questions[id]) || stableJson((await base.child(`categories/${id}`).get()).val()) !== stableJson(before.categories[id])) throw new Error('Database changed. Preview again.')
          await mkdir('private-backups',{ recursive: true })
          const backupPath = `private-backups/${files.importId}-${Date.now()}.json`
          await writeFile(backupPath,JSON.stringify(before,null,2),{ flag: 'wx' })
          const updates = {}
          for (const [id,bank] of Object.entries(files.banks)) {
            const version = files.categories[id].contentVersion
            const archive = base.child(`questionBankVersions/${id}/${version}`)
            const existingArchive = (await archive.get()).val()
            if (existingArchive && hash(existingArchive.questions) !== hash(bank)) throw new Error('Immutable bank version collision.')
            if (!existingArchive) await archive.set({ questions: bank, checksum: hash(bank) })
            if (hash((await archive.child('questions').get()).val()) !== hash(bank)) throw new Error(`${id}: staged read-back failed.`)
            // Preserve a legacy bank version before replacing it.
            if (before.questions[id]) {
              const oldVersion = before.categories[id]?.contentVersion ?? `legacy-${hash(before.questions[id]).slice(0,24)}`
              const oldArchive = base.child(`questionBankVersions/${id}/${oldVersion}`)
              if (!(await oldArchive.get()).exists()) await oldArchive.set({ questions: before.questions[id], checksum: hash(before.questions[id]) })
            }
            updates[`questions/${id}`] = bank; updates[`categories/${id}`] = files.categories[id]
          }
          updates[`sourceImports/${files.importId}`] = { status: 'applied', appliedAt: Date.now(), actor: 'trusted-admin-sdk', payloadHash: files.payloadHash,
            sources: files.manifest.sources,
            ...(files.manifest.duplicateSources ? { duplicateSources: files.manifest.duplicateSources } : {}),
            ...(files.manifest.matchingSources?.length ? { matchingSources: files.manifest.matchingSources } : {}),
            ...(files.manifest.answerKeyPolicy ? { answerKeyPolicy: files.manifest.answerKeyPolicy } : {}),
            ...(files.manifest.corrections?.length ? { corrections: files.manifest.corrections } : {}),
            ...(files.manifest.keyConflicts?.length ? { sourceAmbiguities: files.manifest.keyConflicts } : {}),
            counts: Object.fromEntries(Object.entries(files.banks).map(([id,b]) => [id,Object.keys(b).length])) }
          // One atomic publish: all six banks, actual counts and import metadata become visible together.
          await base.update(updates)
          console.log(`Published ${files.importId}. Backup: ${backupPath}. Run pnpm seed:verify.`)
        } finally { await lock.remove() }
      }
    }
  }
} catch (error) { console.error(error.message); process.exitCode = 1 }
finally { if (services) await deleteApp(services.app) }
