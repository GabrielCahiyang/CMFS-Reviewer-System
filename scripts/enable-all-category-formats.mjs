import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { deleteApp } from 'firebase-admin/app'
import { trustedServices } from './lib/admin-client.mjs'
import { allQuestionTypes, allStudyModes, missingFormatQuestions } from './lib/all-category-formats.mjs'
import { hash, stableJson, validateBank } from './lib/import-core.mjs'

const services = trustedServices()
try {
  const base = services.database.ref('cfms')
  const sources = JSON.parse(await readFile('scripts/source-manifest.json', 'utf8')).sources
  const before = { categories: {}, questions: {} }, changes = {}, summaries = []
  for (const { categoryId: id } of sources) {
    const [c, b] = await Promise.all([base.child(`categories/${id}`).get(), base.child(`questions/${id}`).get()])
    const category = c.val(), previous = b.val()
    if (!category || !previous) throw new Error(`Missing reviewer ${id}.`)
    const additions = missingFormatQuestions(id, previous)
    const raw = JSON.parse(JSON.stringify({ ...previous, ...additions }))
    for (const q of Object.values(raw)) { delete q.contentVersion; delete q.importId }
    const qa = validateBank(raw)
    if (qa.errors.length) throw new Error(`${id}: ${qa.errors.join('; ')}`)
    const counts = Object.fromEntries(allQuestionTypes.map(type => [type, Object.values(raw).filter(q => q.type === type).length]))
    if (Object.values(counts).some(n => n === 0)) throw new Error(`${id} still has an empty question format.`)
    summaries.push({ categoryId: id, before: Object.keys(previous).length, added: Object.keys(additions).length, total: qa.count, counts })
    if (!Object.keys(additions).length && stableJson(category.types) === stableJson(allQuestionTypes) && stableJson(category.enabledModes) === stableJson(allStudyModes)) continue
    before.categories[id] = category; before.questions[id] = previous
    changes[id] = { raw, category }
  }
  if (!Object.keys(changes).length) { console.log('All categories already have all four question formats and study modes.'); process.exitCode = 0 }
  else {
    const importId = `import-${hash(Object.fromEntries(Object.entries(changes).map(([id, c]) => [id, c.raw]))).slice(0, 24)}`
    before.replacedBy = importId
    await mkdir('private-backups', { recursive: true })
    const backupPath = `private-backups/${importId}-${Date.now()}.json`
    await writeFile(backupPath, JSON.stringify(before, null, 2), { flag: 'wx' })
    const updates = {}
    for (const [id, change] of Object.entries(changes)) {
      const contentVersion = `v-${hash({ bank: change.raw, importId }).slice(0, 24)}`
      const bank = Object.fromEntries(Object.entries(change.raw).map(([key, q]) => [key, { ...q, contentVersion, importId }]))
      const archive = base.child(`questionBankVersions/${id}/${contentVersion}`)
      const current = (await archive.get()).val()
      if (current && stableJson(current.questions) !== stableJson(bank)) throw new Error('Version collision.')
      if (!current) await archive.set({ questions: bank, checksum: hash(bank) })
      if (hash((await archive.child('questions').get()).val()) !== hash(bank)) throw new Error(`${id}: staged verification failed.`)
      const category = { ...change.category, questionCount: Object.keys(bank).length, expectedCount: Object.keys(bank).length, types: allQuestionTypes, enabledModes: allStudyModes, contentVersion }
      updates[`questions/${id}`] = bank; updates[`categories/${id}`] = category
      change.bank = bank; change.updatedCategory = category
    }
    // Preserve every prior record and key. Publish new banks and accurate metadata together.
    for (const id of Object.keys(changes)) {
      if (stableJson((await base.child(`questions/${id}`).get()).val()) !== stableJson(before.questions[id])) throw new Error('Reviewer changed during preparation. Retry before publishing.')
    }
    updates[`sourceImports/${importId}`] = { status: 'applied', appliedAt: Date.now(), actor: 'trusted-admin-sdk', purpose: 'All question formats in every category', categories: summaries, backupPath }
    await base.update(updates)
    const stagingCategories = JSON.parse(await readFile('seed-output/categories.json', 'utf8'))
    for (const [id, change] of Object.entries(changes)) {
      const [b, c] = await Promise.all([base.child(`questions/${id}`).get(), base.child(`categories/${id}`).get()])
      if (stableJson(b.val()) !== stableJson(change.bank) || stableJson(c.val()) !== stableJson(change.updatedCategory)) throw new Error(`${id}: live read-back mismatch.`)
      await writeFile(`seed-output/questions/${id}.json`, JSON.stringify(change.raw, null, 2) + '\n')
      const { contentVersion: _version, ...category } = change.updatedCategory
      stagingCategories[id] = category
    }
    await writeFile('seed-output/categories.json', JSON.stringify(stagingCategories, null, 2) + '\n')
    await mkdir('docs/verification', { recursive: true })
    const report = { importId, readBackVerified: true, backupPath, categories: summaries, total: summaries.reduce((n, c) => n + c.total, 0) }
    await writeFile('docs/verification/all-category-formats.json', JSON.stringify(report, null, 2) + '\n')
    console.log(JSON.stringify(report, null, 2))
  }
} finally { await deleteApp(services.app) }
