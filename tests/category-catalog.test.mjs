import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { parseCategories } from '../src/lib/question-schema.ts'

const category = { title: 'A new PDF reviewer', description: 'Imported questions',
  sourceDocument: 'new file.pdf', icon: 'book', color: 'indigo', questionCount: 121,
  types: ['multiple-choice'], enabledModes: ['practice','exam','flashcard','mixed'] }

test('every valid database category is visible, including unfamiliar IDs and changed titles', () => {
  const data = Object.fromEntries(Array.from({length:7}, (_,i) => [`file-${i+1}`, { ...category, title:`PDF ${i+1}` }]))
  assert.equal(parseCategories(data).length,7)
  data['a-future-pdf'] = { ...category, title:'A completely different title' }
  assert.equal(parseCategories(data).length,8)
  assert.ok(parseCategories(data).some(item => item.id === 'a-future-pdf'))
})

test('matching PDF contents remain separate catalog entries instead of being deduplicated', () => {
  const result = parseCategories({ first:category, second:category })
  assert.equal(result.length,2)
  assert.deepEqual(result.map(item => item.id), ['first','second'])
})

test('malformed records do not become broken cards or unsafe category links', () => {
  assert.deepEqual(parseCategories(null),[])
  assert.deepEqual(parseCategories([]),[])
  assert.equal(parseCategories({ valid:category, 'bad/id':category, bad:null,
    invalidCount:{...category,questionCount:-1},invalidTypes:{...category,types:['unknown']},
    invalidModes:{...category,enabledModes:['unknown']} }).length,1)
})

test('the provider reads the database catalog without a compiled title allowlist', async () => {
  const source = await readFile('src/lib/study-context.tsx','utf8')
  assert.match(source,/setCategories\(parseCategories\(value\)\)/)
  assert.doesNotMatch(source,/sourceCategoryTitles\[/)
})
