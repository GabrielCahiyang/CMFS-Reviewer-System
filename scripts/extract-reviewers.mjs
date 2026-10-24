import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import mammoth from 'mammoth'
import { hash, htmlToLines, parseQuestionLines, validateBank } from './lib/import-core.mjs'

const args = process.argv.slice(2)
const sourceDir = path.resolve(args[args.indexOf('--source-dir') + 1] || 'private-source-reviewers')
if (!args.includes('--source-dir')) throw new Error('Usage: pnpm seed:extract -- --source-dir <private folder>')
const manifest = JSON.parse(await readFile('scripts/source-manifest.json','utf8'))
await mkdir('seed-output/raw', { recursive: true }); await mkdir('seed-output/questions',{ recursive: true })
const reports = [], categories = {}, sources = []
for (const source of manifest.sources) {
  let bytes
  try { bytes = await readFile(path.join(sourceDir, source.filename)) }
  catch { reports.push({ categoryId: source.categoryId, errors: ['Source file missing.'], count: 0 }); continue }
  const checksum = hash(bytes)
  let lines = [], rawWarnings = []
  if (source.filename.endsWith('.docx')) {
    const html = await mammoth.convertToHtml({ buffer: bytes }, { includeDefaultStyleMap: true })
    await writeFile(`seed-output/raw/${source.categoryId}.html`, html.value)
    lines = htmlToLines(html.value)
    rawWarnings = html.messages.map((m) => m.message)
    rawWarnings.push('Review Word numbering and formatting against the source; HTML does not preserve reliable page numbers.')
  } else {
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const loading = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true })
    const pdf = await loading.promise
    const annotations = []
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p)
      const content = await page.getTextContent()
      const rows = new Map()
      for (const item of content.items) {
        if (!('str' in item)) continue
        const y = Math.round(item.transform[5] / 3) * 3
        const row = rows.get(y) ?? []; row.push({ x: item.transform[4], text: item.str }); rows.set(y,row)
      }
      const pageLines = [...rows.entries()].sort((a,b) => b[0]-a[0]).map(([,row]) => ({ text: row.sort((a,b) => a.x-b.x).map((i) => i.text).join(' ').trim(), page: String(p) })).filter((l) => l.text)
      lines.push(...pageLines)
      if (!pageLines.length) rawWarnings.push(`Page ${p} has no extractable text; OCR and visual review required.`)
      for (const annotation of await page.getAnnotations()) if (annotation.subtype === 'Highlight') annotations.push({ page: p, rect: annotation.rect, quadPoints: annotation.quadPoints, contents: annotation.contentsObj?.str })
    }
    await writeFile(`seed-output/raw/${source.categoryId}.highlights.json`, JSON.stringify(annotations,null,2))
    if (source.highlightedAnswers) rawWarnings.push('Highlight geometry retained. Verify highlighted choices visually; flattened highlights may have no annotations. No highlighted key is guessed.')
    await loading.destroy()
  }
  await writeFile(`seed-output/raw/${source.categoryId}.lines.json`, JSON.stringify(lines,null,2))
  const parsed = source.referenceOnly ? { questions: {}, warnings: ['Teaching source: manually prepare derived questions with page references and named human review.'], missingNumbers: [], answerKeyCount: 0 } : parseQuestionLines(lines,source)
  const qa = validateBank(parsed.questions,source)
  reports.push({ categoryId: source.categoryId, sourceDocument: source.filename, checksum, ...qa, warnings: [...rawWarnings,...parsed.warnings], missingNumbers: parsed.missingNumbers, answerKeyCount: parsed.answerKeyCount })
  sources.push({ ...source, checksum, extractionReviewed: false })
  const types = [...new Set(Object.values(parsed.questions).map((q) => q.type))]
  categories[source.categoryId] = { title: source.title, sourceDocument: source.filename, description: source.title,
    icon: source.icon, color: source.color, questionCount: qa.count, ...(source.expectedCount ? { expectedCount: source.expectedCount } : {}), types,
    enabledModes: ['practice','exam','flashcard','mixed'] }
  await writeFile(`seed-output/questions/${source.categoryId}.json`, JSON.stringify(parsed.questions,null,2))
}
const importId = `import-${hash(sources.map((s) => ({ id: s.categoryId, checksum: s.checksum }))).slice(0,24)}`
await writeFile('seed-output/categories.json', JSON.stringify(categories,null,2))
await writeFile('seed-output/manifest.json', JSON.stringify({ importId, sources, reports },null,2))
await writeFile('seed-output/QA_REPORT.md', '# Extraction audit\n\n' + reports.map((r) => `## ${r.categoryId}\n\nCount: ${r.count}; keyed: ${r.keyed ?? 0}; verified: ${r.verified ?? 0}; flagged: ${r.reviewRequired ?? 0}.\n\n${[...(r.errors ?? []),...(r.warnings ?? []),...(r.missingNumbers?.length ? [`Missing numbers: ${r.missingNumbers.join(', ')}`] : [])].map((s) => `- ${s}`).join('\n')}\n`).join('\n'))
console.log(`Extracted ${sources.length}/6 sources. Review seed-output/QA_REPORT.md and private raw files. Import: ${importId}`)
if (reports.some((r) => r.errors.length || r.missingNumbers?.length)) process.exitCode = 1
