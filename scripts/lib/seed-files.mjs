import { readFile, writeFile } from 'node:fs/promises'
import { hash, validateBank } from './import-core.mjs'

export async function validatedFiles() {
  const manifest = JSON.parse(await readFile('seed-output/manifest.json','utf8'))
  const categories = JSON.parse(await readFile('seed-output/categories.json','utf8'))
  const banks = {}, errors = []
  const expected = JSON.parse(await readFile('scripts/source-manifest.json','utf8')).sources
  for (const source of expected) {
    const entry = manifest.sources.find((s) => s.categoryId === source.categoryId)
    if (!entry || !entry.checksum) { errors.push(`${source.categoryId}: source checksum missing.`); continue }
    if (entry.extractionReviewed !== true) errors.push(`${source.categoryId}: extractionReviewed must be true after source-by-source review.`)
    const bank = JSON.parse(await readFile(`seed-output/questions/${source.categoryId}.json`,'utf8'))
    const qa = validateBank(bank,source)
    errors.push(...qa.errors.map((e) => `${source.categoryId}: ${e}`))
    const report = manifest.reports.find((r) => r.categoryId === source.categoryId)
    if (report?.missingNumbers?.length && !entry.numberingReviewed) errors.push(`${source.categoryId}: numbering gaps require review.`)
    if (report?.warnings?.some((w) => /Duplicate|Orphan|Unparsed answer-key/.test(w)) && !entry.answerKeyReviewed) errors.push(`${source.categoryId}: answer-key parser warnings require review.`)
    const category = categories[source.categoryId]
    if (!category || category.title !== source.title || category.sourceDocument !== source.filename || category.questionCount !== qa.count) errors.push(`${source.categoryId}: category metadata/count mismatch.`)
    const actualTypes = [...new Set(Object.values(bank).map((q) => q.type))].sort()
    if (JSON.stringify([...category?.types ?? []].sort()) !== JSON.stringify(actualTypes)) errors.push(`${source.categoryId}: supported types do not match data.`)
    // Hash the reviewed normalized content, not just the source PDF. Corrections form a new version.
    banks[source.categoryId] = bank
  }
  if (errors.length) throw new Error(errors.join('\n'))
  const payloadHash = hash({ categories, banks, sources: manifest.sources })
  // A changed reviewed artifact gets a changed import identity.
  const importId = `import-${payloadHash.slice(0,24)}`
  for (const [id,bank] of Object.entries(banks)) {
    const contentVersion = `v-${hash({ bank, importId }).slice(0,24)}`
    categories[id].contentVersion = contentVersion
    for (const q of Object.values(bank)) { q.importId = importId; q.contentVersion = contentVersion }
  }
  return { manifest, importId, categories, banks, payloadHash }
}
export async function reportValidation() {
  const files = await validatedFiles()
  const counts = Object.fromEntries(Object.entries(files.banks).map(([id,bank]) => [id,validateBank(bank)]))
  await writeFile('seed-output/VALIDATED_REPORT.json', JSON.stringify({ importId: files.importId, payloadHash: files.payloadHash, counts },null,2))
  console.log(JSON.stringify({ importId: files.importId, counts },null,2))
  return files
}
