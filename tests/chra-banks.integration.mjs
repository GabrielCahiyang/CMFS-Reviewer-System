import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import mammoth from 'mammoth'
import { validatedFiles } from '../scripts/lib/seed-files.mjs'
import { parseCategories, parseQuestions } from '../src/lib/question-schema.ts'
import { canAutoGrade, gradeAnswer } from '../src/lib/study-models.ts'
import { presentQuestion } from '../src/lib/question-presentation.ts'
import { sourceCategoryTitles } from '../src/lib/study-categories.ts'

const directory = 'seed-output/chra-2026-10-28'
const files = await validatedFiles({ directory, sourceManifest: 'scripts/chra-source-manifest.json' })
const read = async path => JSON.parse(await readFile(path, 'utf8'))
const normalize = value => value.replace(/\s+/g,' ').trim()

test('each of the three documents has 100 separate questions, intact source choices, and explicit key provenance', async () => {
  assert.equal(parseCategories(files.categories).length,3)
  for (const source of files.manifest.sources) {
    const original = await read(`${directory}/part-${source.part}-extracted.json`)
    assert.equal(sourceCategoryTitles[source.categoryId], source.title)
    assert.equal(Object.keys(original.sourceKeys).length, source.part === 3 ? 100 : 0)
    const independent = normalize((await mammoth.extractRawText({
      path: join(process.env.CHRA_SOURCE_DIRECTORY ?? 'C:/Users/gabri/Downloads', source.filename),
    })).value)
    if (source.part === 3) {
      const table = independent.split('ANSWER KEY')[1].replace(/(?:Item\s+Answer\s*)+/g,'')
      const independentKeys = Object.fromEntries([...table.matchAll(/(\d+)\s+([A-D])\b/g)].map(m=>[m[1],m[2]]))
      assert.equal(Object.keys(independentKeys).length,100)
      assert.deepEqual(independentKeys,original.sourceKeys)
    }
    const bank = parseQuestions(files.banks[source.categoryId], source.categoryId)
    assert.equal(bank.length,100)
    for (const [i,q] of bank.entries()) {
      const raw=original.questions[i]
      assert.equal(q.originalNumber,String(i+1))
      assert.equal(q.sourceDocument,source.filename)
      assert.equal(q.derived,false)
      // Mammoth is an independent DOCX reader, separate from the XML extractor.
      assert.ok(independent.includes(normalize(raw.question)), `${source.categoryId}/${q.id}: source prompt`)
      for (const choice of raw.choices) assert.ok(independent.includes(normalize(choice)), `${source.categoryId}/${q.id}: source option`)
      const correction=files.manifest.corrections.find(c=>c.categoryId===source.categoryId && c.questionId===q.id)
      if (!correction) { assert.equal(q.question,raw.question);assert.deepEqual(q.choices,raw.choices) }
      if (source.part===3) {
        assert.equal(q.answerOrigin,'source-key')
        assert.equal(q.originalAnswerLetter,original.sourceKeys[q.originalNumber])
        assert.equal(q.correctAnswer,raw.choices[q.originalAnswerLetter.charCodeAt(0)-65])
      } else {
        assert.equal(q.answerOrigin,'generated')
        assert.equal(q.originalAnswerLetter,'')
        assert.ok(q.explanation)
      }
      assert.ok(!/Submit and reveal answers|ANSWER KEY/.test(q.question + q.choices.join(' ')))
    }
  }
})

test('all 300 source questions score correctly across all six available presentations', () => {
  let views=0
  for (const [id,raw] of Object.entries(files.banks)) {
    const bank=parseQuestions(raw,id)
    for (const q of bank) for (const format of ['original','multiple-choice','true-false','identification','enumeration','mixed']) {
      const view=presentQuestion(q,format,bank,'chra-validation')
      assert.equal(canAutoGrade(view),true,`${id}/${q.id}/${format}`)
      const value=view.type==='enumeration' ? view.correctAnswer : Array.isArray(view.correctAnswer) ? view.correctAnswer[0] : view.correctAnswer
      assert.equal(gradeAnswer(view,value).status,'correct',`${id}/${q.id}/${format}`)
      if (view.type==='multiple-choice' || view.type==='true-false') {
        const wrong=view.choices.find(c=>c!==view.correctAnswer)
        assert.equal(gradeAnswer(view,wrong).status,'incorrect')
      }
      views++
    }
  }
  assert.equal(views,1800)
})

test('source defects are corrected with exact before/after records, not hidden or discarded', () => {
  assert.equal(files.manifest.corrections.length,6)
  assert.equal(files.manifest.generatedAnswers.length,200)
  for (const correction of files.manifest.corrections) {
    const q=files.banks[correction.categoryId][correction.questionId]
    assert.equal(q.question,correction.after.question)
    assert.deepEqual(q.choices,correction.after.choices)
    assert.equal(q.correctAnswer,correction.after.correctAnswer)
    assert.ok(correction.before.question && correction.reference && correction.reason && correction.sourceParagraph)
  }
  for (const n of ['063','084']) {
    const q=files.banks['chra-part-1'][`q-${n}`]
    assert.equal(q.correctAnswer,'₱275')
    assert.equal(q.choices.length,5)
    assert.equal(100*1.25*1.10*2,275)
  }
  assert.match(files.banks['chra-part-3']['q-039'].question,/Article 103/)
  assert.match(files.banks['chra-part-3']['q-045'].question,/Article 104/)
})
