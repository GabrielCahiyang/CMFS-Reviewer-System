import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { hash, validateBank } from './lib/import-core.mjs'
import { part1, part2, references } from './lib/chra-answer-review.mjs'

export const directory = 'seed-output/chra-2026-10-28'
const read = async path => JSON.parse(await readFile(path, 'utf8'))
const write = (path, value) => writeFile(path, JSON.stringify(value, null, 2) + '\n')
const config = await read('scripts/chra-source-manifest.json')
const categories = {}, sources = [], reports = [], corrections = [], generatedAnswers = []
for (const answers of [part1, part2]) assert.deepEqual(Object.keys(answers).map(Number), Array.from({length:100}, (_,i) => i+1))
await mkdir(`${directory}/questions`, { recursive: true })
for (const source of config.sources) {
  const extracted = await read(`${directory}/part-${source.part}-extracted.json`)
  assert.equal(extracted.filename, source.filename)
  const bank = {}
  for (const raw of extracted.questions) {
    const number = String(raw.number), questionId = `q-${number.padStart(3, '0')}`
    const key = extracted.sourceKeys[number], review = (source.part === 1 ? part1 : part2)[number]
    const letter = key ?? review.letter
    const q = { originalNumber: number, question: raw.question, choices: [...raw.choices],
      type: 'multiple-choice', topic: source.title, sourceDocument: source.filename, derived: false,
      verificationStatus: 'verified', originalAnswerLetter: key ?? '',
      answerOrigin: key ? 'source-key' : 'generated',
      reviewedBy: 'Codex source and reference review, 2026-10-28',
      reviewNote: `Source question begins at body paragraph ${raw.paragraph}. ${key ? 'Key from the source answer table.' : 'The document contains no answer key; answer supplied during review.'}`,
      ...(key ? { sourceAnswer: raw.choices[key.charCodeAt(0) - 65] } : { explanation: review.explanation }),
    }
    const before = structuredClone(q)
    let reason, reference
    if (source.part === 1 && raw.number === 8) {
      q.question = 'What is the general minimum total pay rate for work on a special non-working day, up to eight hours?'
      reason = 'Clarified total pay versus additional premium: the source asks for the premium but its 130% choice is the total rate.'
      reference = references.payComputations
    }
    if (source.part === 1 && raw.number === 23) {
      q.choices[2] = 'They must be distributed in full among all covered employees except managerial employees, based on actual hours or days worked under the applicable rules'
      reason = 'Replaced rank-and-file-only coverage with all covered non-managerial employees, and clarified the hours/days-worked distribution basis.'
      reference = references.serviceCharges
    }
    if (source.part === 1 && [63,84].includes(raw.number)) {
      q.question = 'An employee earns ₱100 per hour and works 2 ordinary-day overtime hours, both during qualifying night hours. Using the minimum ordinary-day overtime rate and night shift differential under DOLE rules, what is the total pay for those 2 hours?'
      q.choices.push('₱275')
      reason = 'Corrected the source additive night-overtime formula. 100 × 1.25 × 1.10 × 2 = 275. Added choice E because no printed choice gives this amount; all original choices retained.'
      reference = references.payComputations
    }
    if (source.part === 3 && raw.number === 39) {
      q.question = q.question.replace('Article 101', 'Article 103')
      q.explanation = 'The current time-of-payment provision is Article 103; the correct statement remains the source key D, subject to the statutory rules and exceptions.'
      reason = 'Updated the time-of-payment citation to Article 103 in the amended Labor Code. Source answer D retained.'
      reference = references.laborCode
    }
    if (source.part === 3 && raw.number === 45) {
      q.question = q.question.replace('Article 102', 'Article 104')
      q.explanation = 'The current place-of-payment provision is Article 104; the general rule is payment at or near the place of undertaking, subject to applicable rules.'
      reason = 'Updated the place-of-payment citation to Article 104 in the amended Labor Code. Source answer C retained.'
      reference = references.laborCode
    }
    q.correctAnswer = q.choices[letter.charCodeAt(0) - 65]
    assert.ok(q.correctAnswer, `${source.categoryId}/${number}: unresolved letter`)
    if (reason) corrections.push({ categoryId: source.categoryId, questionId, originalNumber: number,
      sourceParagraph: raw.paragraph, reason, reference, before, after: structuredClone(q) })
    if (!key) generatedAnswers.push({ categoryId: source.categoryId, questionId, originalNumber: number,
      selectedLetter: letter, answer: q.correctAnswer, explanation: q.explanation })
    bank[questionId] = q
  }
  const qa = validateBank(bank, source)
  assert.deepEqual(qa.errors, [])
  assert.equal(qa.keyed, 100)
  categories[source.categoryId] = { title: source.title,
    description: source.part === 3 ? '100 Labor Code questions with the supplied answer key.' :
      `100 ${source.part === 1 ? 'statutory-benefits and payroll' : 'HR and situational'} questions with added answer keys and explanations.`,
    sourceDocument: source.filename, icon: source.icon, color: source.color, questionCount: qa.count, expectedCount: qa.count,
    types: ['multiple-choice'], enabledModes: ['practice', 'exam', 'flashcard', 'mixed'] }
  sources.push({ ...source, checksum: extracted.checksum, extractionReviewed: true, numberingReviewed: true,
    answerKeyReviewed: true, printedAnswerKeys: Object.keys(extracted.sourceKeys).length,
    addedAnswerKeys: source.part === 3 ? 0 : 100 })
  reports.push({ categoryId: source.categoryId, ...qa, missingNumbers: [], warnings: [] })
  await write(`${directory}/questions/${source.categoryId}.json`, bank)
}
const manifest = { sources, reports, corrections, generatedAnswers, references,
  answerKeyPolicy: 'Preserve supplied keys; author missing keys; correct clear source defects with a before/after audit.' }
await write(`${directory}/categories.json`, categories)
await write(`${directory}/manifest.json`, manifest)
await writeFile('docs/CHRA_IMPORT_AUDIT.md', '# CHRA examination import audit\n\n' +
  'All three supplied DOCX documents were read in full. Each has 100 questions numbered 1–100. They are added as three independent categories alongside the seven existing PDF categories; no existing content or accounts are replaced.\n\n' +
  '## Answer provenance\n\nParts 1 and 2 contain no printed keys, answer table, or marked correct choices. Their 200 answers and explanations were authored during review, following the user’s earlier instruction to supply missing answers. These records use `answerOrigin: generated`; their question text is from the documents. Part 3 contains a table with four item/answer pairs per row: all 100 supplied keys were paired by item number and retained. No source document is modified.\n\n' +
  'Private extraction files retain original paragraph positions and source checksums. Explicit Word breaks/tabs are preserved before parsing options, including options that share paragraphs. Source non-question text “Submit and reveal answers” is excluded; it is not an instruction or a question.\n\n' +
  '## Source corrections\n\n' + corrections.map(c => `- **${c.categoryId}, item ${c.originalNumber}, body paragraph ${c.sourceParagraph}:** ${c.reason} [Reference](${c.reference})`).join('\n') +
  '\n\nFull before/after question records and the authored answer rationale ledger are kept in the private import artifact. Firebase import metadata retains the correction records. Source answer letters remain separate from added answer keys. No verification warning or manual-review scoring gate is introduced.\n\n' +
  '## References used during review\n\n' + Object.entries(references).map(([label,url]) => `- [${label}](${url})`).join('\n') + '\n\n' +
  '## Delivery verification\n\n- [ ] Publish the three new banks and verify live read-back.\n- [ ] Verify original content and account preservation.\n- [ ] Validate grading and available formats for all 300 questions.\n- [ ] Verify production delivery, including all new category routes after the updated application is deployed.\n')
console.log(JSON.stringify({ sources: sources.length, questions: reports.reduce((n,r) => n+r.count,0),
  printedKeys: 100, authoredKeys: generatedAnswers.length, corrections: corrections.length,
  artifactHash: hash(manifest) }, null, 2))
