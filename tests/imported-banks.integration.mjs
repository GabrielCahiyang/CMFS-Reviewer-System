import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { validatedFiles } from '../scripts/lib/seed-files.mjs'
import { parseQuestions } from '../src/lib/question-schema.ts'
import { canAutoGrade, gradeAnswer } from '../src/lib/study-models.ts'
import { presentQuestion } from '../src/lib/question-presentation.ts'
import { sourceCategoryTitles } from '../src/lib/study-categories.ts'
const files = await validatedFiles()
const expected = {'reviewer-1':100,'reviewer-2':60,'reviewer-3':121,'numbered-reviewer':121,'reviewer-4':120,'pre-finals':85,'working-capital':39}
const answerFor = q => q.type === 'enumeration' ? q.correctAnswer : Array.isArray(q.correctAnswer) ? q.correctAnswer[0] : q.correctAnswer

test('all 646 question records are keyed, loadable and score correctly in every available presentation', () => {
  let total=0, views=0
  for(const [id,count] of Object.entries(expected)) {
    const bank=parseQuestions(files.banks[id],id)
    assert.equal(bank.length,count);total+=count
    assert.equal(sourceCategoryTitles[id], files.categories[id].title)
    for(const q of bank) {
      assert.equal(q.derived,false)
      assert.ok(q.sourcePage)
      assert.equal(canAutoGrade(q),true)
      assert.ok(!/Downloaded by|lOMoAR|CORRECT ANSWER:/.test(q.question))
      assert.ok(!q.choices?.some(c=>/Rationalization:|Explanation:|CORRECT ANSWER:|Downloaded by/.test(c)))
      for(const format of ['original','multiple-choice','true-false','identification','enumeration','mixed']) {
        const view=presentQuestion(q,format,bank,'replacement-validation')
        assert.equal(canAutoGrade(view),true,`${id}/${q.id}/${format}`)
        assert.equal(gradeAnswer(view,answerFor(view)).status,'correct',`${id}/${q.id}/${format}`)
        views++
      }
    }
  }
  assert.equal(total,646);assert.equal(views,3876)
})

test('all seven PDFs have independent categories, including the matching 121-question file',()=>{
  assert.equal(files.manifest.sources.length,7)
  assert.equal(files.manifest.duplicateSources.length,0)
  assert.equal(files.manifest.matchingSources[0].filename,'5_6206280459148598165.pdf')
  assert.equal(files.manifest.matchingSources[0].matchingQuestions,121)
  assert.equal(files.manifest.sources.reduce((n,s)=>n+s.pages,0),114)
  assert.equal(files.categories['numbered-reviewer'].sourceDocument,'5_6206280459148598165.pdf')
  for (const [id,q] of Object.entries(files.banks['reviewer-3'])) {
    const matching = files.banks['numbered-reviewer'][id]
    assert.deepEqual(matching.correctAnswer,q.correctAnswer)
    assert.notEqual(matching.sourceDocument,q.sourceDocument)
  }
})

test('malformed printed numbers retain their source sequence and the absent working-capital item is not invented',()=>{
  const bank=parseQuestions(files.banks['reviewer-3'],'reviewer-3')
  assert.equal(bank[101].originalNumber,'10-102')
  assert.equal(bank[116].originalNumber,'1117')
  assert.equal(bank[117].originalNumber,'118')
  assert.equal(Object.values(files.banks['working-capital']).some(q=>q.originalNumber==='10'),false)
})

test('multiple source keys are accepted and the source no-valid-option answer is available',()=>{
  for(const number of ['7','9']) {
    const q=Object.values(files.banks['working-capital']).find(q=>q.originalNumber===number)
    assert.equal(q.correctAnswer.length,2)
    for(const answer of q.correctAnswer)assert.equal(gradeAnswer(q,answer).status,'correct')
  }
  const q=Object.values(files.banks['pre-finals']).find(q=>q.originalNumber==='46')
  assert.equal(q.answerOrigin,'source-key')
  assert.match(q.correctAnswer,/No correct option/)
  assert.ok(q.choices.includes(q.correctAnswer))
})

test('every correction retains a complete before/after record and matches the published key',()=>{
  assert.equal(files.manifest.answerKeyPolicy,'clear-errors-corrected-with-user-authorization')
  assert.equal(files.manifest.corrections.length,38)
  for(const item of files.manifest.corrections) {
    const published=files.banks[item.categoryId][item.questionId]
    assert.deepEqual(published.correctAnswer,item.after.correctAnswer)
    assert.equal(published.sourceAnswer,item.before.sourceAnswer)
    assert.equal(published.originalAnswerLetter,item.before.originalAnswerLetter)
    assert.ok(item.reason && item.reference && item.sourcePage)
  }
  const at=(category,number)=>Object.values(files.banks[category]).find(q=>q.originalNumber===String(number))
  assert.equal(at('reviewer-4',104).correctAnswer,'$50,000')
  assert.equal(at('reviewer-4',107).correctAnswer,'$12,000')
  assert.equal(at('reviewer-4',106).correctAnswer,'75 days')
  assert.equal(at('reviewer-4',111).correctAnswer,'15 days')
  assert.equal(at('reviewer-4',114).correctAnswer,'72 days')
  assert.equal(at('reviewer-4',116).correctAnswer,'45 days')
  assert.equal(at('reviewer-4',112).correctAnswer,'$1,000')
  assert.equal(at('reviewer-3',112).correctAnswer,'Project A and Project B')
  assert.equal(at('reviewer-3',115).correctAnswer,'Limited liability protection for owners')
  assert.equal(at('pre-finals',27).correctAnswer,'$20.25')
})

test('all 60 Reviewer 2 explanations are paired with their original question',()=>{
  assert.ok(Object.values(files.banks['reviewer-2']).every(q=>q.explanation))
})
