import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { hash, validateBank } from './lib/import-core.mjs'
import { correctReplacementBank } from './lib/replacement-corrections.mjs'

const root = 'seed-output/replacement-2026-10-26'
const read = async path => JSON.parse(await readFile(path, 'utf8'))
const write = (path, data) => writeFile(path, JSON.stringify(data, null, 2) + '\n')
const config = await read('scripts/source-manifest.json')
const inspected = await read(`${root}/sources.json`)
const categories = {}, reports = [], sources = [], corrections = []
const exceptions = [
  { categoryId: 'reviewer-3', numbers: ['10-102', '1117'], handling: 'Printed labels preserved at document positions 102 and 117; document contains 121 questions despite its 120-item heading.' },
  { categoryId: 'working-capital', numbers: ['10'], handling: 'No item 10 exists in the supplied PDF. Imported all 39 printed items without inventing a missing question.' },
  { categoryId: 'working-capital', numbers: ['7', '9'], handling: 'Both colored answer choices preserved and accepted.' },
  { categoryId: 'pre-finals', numbers: ['31'], handling: 'The printed key names C and E. The correction audit broadens acceptance to all defensible listed credit-risk statements.' },
  { categoryId: 'pre-finals', numbers: ['46'], handling: 'The source answer "No correct option appears to be listed" is available as an added F choice. All five printed options and the printed answer text remain intact.' },
]
// These document defects are recorded separately from extraction accuracy. The
// default policy preserves supplied keys; corrections require an explicit choice.
const keyConflicts = [
  { categoryId: 'reviewer-2', numbers: ['9'], detail: 'Both loss aversion and sunk-cost framing may fit the wording. Retained the printed sunk-cost-fallacy key and rationale rather than asserting a unique new psychological diagnosis.' },
  { categoryId: 'reviewer-3', numbers: ['23', '24'], detail: 'Question/option wording is unclear and does not support a confident replacement. Printed key retained, and no new factual assertion generated.' },
  { categoryId: 'reviewer-4', numbers: ['101', '115', '119'], detail: 'Printed rounded answers retained: item 101 uses a 360-day year; real/nominal yield items use the standard introductory additive approximation.' },
  { categoryId: 'working-capital', numbers: ['6', '7', '9', '24', '27'], detail: 'Some wording simplifies liquidity/efficiency or has more than one defensible interpretation. Kept supplied keys (including both highlighted choices for 7 and 9), without inventing a unique replacement.' },
]

await mkdir('seed-output/questions', { recursive: true })
for (const source of config.sources) {
  const extracted = await read(`${root}/bank-${source.sourceIndex}.json`)
  const bank = Object.fromEntries(extracted.map((question, index) => [`q-${String(index + 1).padStart(3, '0')}`, question]))
  corrections.push(...correctReplacementBank(source.categoryId, bank))
  const qa = validateBank(bank, source)
  if (qa.errors.length) throw new Error(`${source.categoryId}: ${qa.errors.join('; ')}`)
  if (qa.keyed !== source.expectedCount) throw new Error(`${source.categoryId}: missing answer keys.`)
  categories[source.categoryId] = {
    title: source.title, description: `${source.expectedCount} source questions with checked answer keys and explanations.`,
    sourceDocument: source.filename, icon: source.icon, color: source.color,
    questionCount: qa.count, expectedCount: qa.count,
    types: [...new Set(extracted.map(q => q.type))], enabledModes: ['practice', 'exam', 'flashcard', 'mixed'],
  }
  const metadata = inspected.find(s => s.index === source.sourceIndex)
  if (!metadata) throw new Error('Missing inspected document.')
  sources.push({ ...source, checksum: metadata.sha256 ?? metadata.checksum, pages: metadata.pages,
    extractionReviewed: true, numberingReviewed: true, answerKeyReviewed: true })
  reports.push({ categoryId: source.categoryId, sourceDocument: source.filename, ...qa,
    warnings: exceptions.filter(item => item.categoryId === source.categoryId).map(item => item.handling),
    missingNumbers: source.categoryId === 'working-capital' ? [10] : [] })
  await write(`seed-output/questions/${source.categoryId}.json`, bank)
}

const duplicateSources = config.duplicateSources.map(source => {
  const inspectedSource = inspected.find(s => s.index === source.sourceIndex)
  return { ...source, checksum: inspectedSource.sha256 ?? inspectedSource.checksum, pages: inspectedSource.pages,
    duplicateQuestions: 121, handling: 'Compared every question, option and answer key with Reviewer 3. Only a hyphen line-wrap differs; imported once.' }
})
const matchingSources = config.sources.filter(source => source.matchesCategory).map(source => ({
  categoryId: source.categoryId, matchesCategory: source.matchesCategory, filename: source.filename,
  matchingQuestions: source.expectedCount, handling: 'Kept as its own category, as requested: one category per supplied PDF.',
}))
await write('seed-output/categories.json', categories)
await write('seed-output/manifest.json', { importId: `import-${hash({ sources, categories }).slice(0, 24)}`,
  sources, duplicateSources, matchingSources, reports, exceptions, keyConflicts, corrections,
  answerKeyPolicy: 'clear-errors-corrected-with-user-authorization' })
await write(`${root}/audit.json`, { sourceFiles: inspected.length, totalPages: inspected.reduce((n,s) => n + s.pages, 0),
  categories: Object.fromEntries(Object.entries(categories).map(([id, value]) => [id, value.questionCount])),
  totalQuestions: reports.reduce((n, report) => n + report.count, 0), duplicateSources, matchingSources, exceptions, keyConflicts, corrections,
  answerKeyPolicy: 'clear-errors-corrected-with-user-authorization' })
await mkdir('docs', { recursive: true })
await writeFile('docs/REPLACEMENT_IMPORT_AUDIT.md', '# Replacement reviewer import audit\n\n' +
  'Seven supplied PDFs were read (114 pages), with one separate category for every file. The numbered PDF matches all 121 Reviewer 3 question/option/key records and is intentionally retained as its own category. Seven categories contain 646 question records (525 unique source questions); no extra generated questions are added. Working Capital has 39 printed questions because its numbering skips 10; the user confirmed keeping the actual source count.\n\n' +
  'The user authorized correction of clear source errors. Original printed keys, prompts, choices and explanations are retained in the private JSON audit and database import metadata. Printed numbering defects remain visible in document sequence. Added choices supply a correct answer when the printed choices are incomplete; counts are unchanged.\n\n' +
  '## Categories\n\n| Category | Questions |\n| --- | ---: |\n' +
  Object.values(categories).map(c => `| ${c.title} | ${c.questionCount} |`).join('\n') + '\n\n' +
  `## Corrections (${corrections.length})\n\n` +
  corrections.map(c => `- **${c.categoryId}, original ${c.originalNumber}, PDF page ${c.sourcePage}**: ${c.reason} [Reference](${c.reference})`).join('\n') + '\n\n' +
  '## Source exceptions\n\n' + exceptions.map(e => `- **${e.categoryId} ${e.numbers.join(', ')}**: ${e.handling}`).join('\n') + '\n\n' +
  '## Ambiguities retained\n\n' + keyConflicts.map(e => `- **${e.categoryId} ${e.numbers.join(', ')}**: ${e.detail}`).join('\n') + '\n')
console.log(JSON.stringify({ categories: Object.fromEntries(Object.entries(categories).map(([id,c]) => [id,c.questionCount])),
  total: reports.reduce((n,r) => n+r.count,0), duplicateFiles: duplicateSources.length, corrections: corrections.length,
  policy: 'clear-errors-corrected-with-user-authorization' }, null, 2))
