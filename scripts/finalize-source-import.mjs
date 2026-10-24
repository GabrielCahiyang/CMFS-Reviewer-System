import {readFile,writeFile} from 'node:fs/promises'
import {validateBank} from './lib/import-core.mjs'
import {financialChoiceQuestions} from './lib/financial-choice-questions.mjs'
import {missingFormatQuestions, allQuestionTypes, allStudyModes} from './lib/all-category-formats.mjs'
const read=async (file)=>JSON.parse(await readFile(file,'utf8'))
const write=(file,value)=>writeFile(file,JSON.stringify(value,null,2)+'\n')
const manifest=await read('seed-output/manifest.json')
const sourceConfig=await read('scripts/source-manifest.json')
const categories=await read('seed-output/categories.json')
const highlights=await read('seed-output/inspection/working-capital.highlight-keys.json')
const working=await read('seed-output/questions/working-capital.json')
for(const q of Object.values(working)) {
  const letters=highlights[q.originalNumber]
  if(!letters?.length) throw new Error(`No highlighted key for original Working Capital ${q.originalNumber}`)
  const answers=letters.map((letter)=>q.choices[letter.charCodeAt(0)-65])
  if(answers.some((a)=>!a))throw new Error(`Highlighted key does not resolve: original ${q.originalNumber}; ${JSON.stringify(q)}`)
  q.correctAnswer=answers.length===1?answers[0]:answers
  q.originalAnswerLetter=letters.join(', ');q.sourceAnswer=letters.join(', ');q.answerOrigin='source-highlight'
  q.verificationStatus=answers.length===1?'verified':'review-required'
  if(answers.length>1)q.reviewNote='The source highlights more than one choice. Both source keys are preserved for review.'
  const notes={
    '6':'Source labels the quick ratio as an efficiency measure; it is primarily a liquidity ratio.',
    '15':'The highlighted answer covers receivables collection rather than the complete cash conversion cycle.',
    '17':'The source key/rationale conflicts with CCC = DIO + DSO − DPO: a lower DPO increases the cycle.',
    '18':'The highlighted answer describes sales-to-cash rather than the entire cash conversion cycle.',
    '33':'Highlighted D is preserved. The source explanation instead describes equal increases in inventory/payables, which leave net working capital unchanged.',
    '39':'Highlighted C ($25,000) is preserved, but the source calculation says $5,000 and explicitly reports inconsistent choices.'
  }
  if(notes[q.originalNumber]){q.verificationStatus='review-required';q.reviewNote=notes[q.originalNumber]}
}
await write('seed-output/questions/working-capital.json',working)

// The reference PDF contains teaching material rather than an original numbered exam.
// These source-grounded questions are generated drafts; no human review is fabricated.
const referenceItems=[
  [4,'Which financial statement provides a snapshot of assets, liabilities and equity at a point in time?','Balance sheet'],
  [4,'Which financial statement presents profitability over a period of time?','Income statement'],
  [4,'Which statement shows cash from operations, investing and financing?','Statement of cash flows'],
  [6,'Name the three main categories of a balance sheet.',['Assets','Liabilities','Equity']],
  [6,'How does the source distinguish a current asset from a non-current asset?','A current asset is expected to be converted into cash in less than one year.'],
  [6,'Name two examples of current assets listed in the source.',['Accounts receivable','Inventory']],
  [6,'What category contains property, plant and equipment held for more than one year?','Non-current assets'],
  [6,'What is a current liability according to the source?','An obligation expected to be paid in less than one year.'],
  [6,'What are total assets in the simplified balance sheet example?','214,000'],
  [8,'Give the two reasons the source lists for holding external investments.',['Excess cash','Accumulating cash to make a large purchase']],
  [8,'Name one type of internal investment listed in the source.','Investment in subsidiaries'],
  [9,'What intangible asset arises when purchase price exceeds the fair value of net assets acquired?','Goodwill'],
  [9,'What are intangible assets?','Items of value used to generate revenue that have no physical substance.'],
  [9,'Name the three examples of intangible assets shown in the source.',['Trademarks','Patents','Copyrights']],
  [9,'What does unearned revenue represent?','Revenue collected for goods or services that have not yet been delivered.'],
  [9,'For a $1,200 annual subscription earned evenly, how much revenue is earned each month?','$100'],
  [10,'How is a loan repayable over five years classified in the source?','Non-current liability'],
  [11,'What are commitments?','Future obligations that a company agrees to.'],
  [11,'What are contingencies?','Liabilities that may or may not happen depending on circumstances.'],
  [13,'What does the number of authorised shares represent?','The total number of shares a company can sell.'],
  [13,'What does the number of outstanding or issued shares represent?','The total number of shares a company has sold or issued.'],
  [13,'Which type of shares normally gives voting rights in the source?','Common shares'],
  [13,'Which type of shares offers a fixed dividend with priority over common-share dividends?','Preferred shares'],
  [14,'In the 180,000-share example at 25 cents par value, what is paid-up share capital?','$45,000'],
  [14,'In the example of 180,000 shares sold at 40 cents with 25 cents par, what is contributed surplus?','$27,000'],
  [17,'Name the three main sections of an income statement listed in the source.',['Revenues','Expenses','Profit or loss']],
  [20,'Name the three components of cost of sales illustrated in the source.',['Direct materials','Direct labor','Direct overhead']],
  [21,'What does SG&A stand for?','Selling, general and administrative expenses'],
  [22,'Give one example of an incidental activity that can produce a gain or loss.','Sale of investments'],
  [23,'What does OCI stand for?','Other comprehensive income'],
  [25,'Name the three activity categories in the statement of cash flows.',['Operating','Investing','Financing']],
  [25,'Under which cash-flow activity is the purchase of property, plant and equipment normally classified?','Investing'],
  [25,'Under which cash-flow activity is issuing shares or borrowing normally classified?','Financing'],
  [27,'What is the starting point of the direct method of reporting operating cash flow?','Cash transactions'],
  [27,'What is the starting point of the indirect method of reporting operating cash flow?','Net income'],
  [29,'Why are notes provided under the full disclosure principle?','To help readers understand and make judgements about the company’s financial activities.'],
  [31,'What is the current-ratio formula shown in the source?','Current assets divided by current liabilities'],
  [31,'Name three investor ratios listed in the source.',['Dividend yield','P/E ratio','Earnings per share']],
  [33,'Name the three financial statements included in the annual report.',['Balance sheet','Income statement','Statement of cash flows']],
  [34,'What does MD&A provide information about?','Past performance and future strategic direction']
]
const refSource=sourceConfig.sources.find((s)=>s.categoryId==='financial-statements')
const reference=Object.fromEntries(referenceItems.map(([page,question,answer],i)=>[`q-${String(i+1).padStart(3,'0')}`,{
  originalNumber:`Derived ${i+1}`,question,type:Array.isArray(answer)?'enumeration':'identification',correctAnswer:answer,
  topic:page<15?'Balance sheet':page<24?'Income statement':page<29?'Cash flow':'Financial reporting',
  sourceDocument:refSource.filename,sourcePage:String(page),derived:true,answerOrigin:'generated',verificationStatus:'review-required',
  explanation:`Generated study question based on page ${page} of the supplied reference. The answer is grounded in that page and awaits instructor review.`,
  reviewNote:'Generated from teaching material; no original numbered question or answer key is claimed.'
}]))
Object.assign(reference,financialChoiceQuestions(refSource.filename))
await write('seed-output/questions/financial-statements.json',reference)
categories['financial-statements']={title:refSource.title,description:'64 source-grounded study questions across four formats; generated drafts for instructor review.',sourceDocument:refSource.filename,icon:refSource.icon,color:refSource.color,questionCount:64,expectedCount:64,types:['multiple-choice','true-false','identification','enumeration'],enabledModes:['practice','exam','flashcard','mixed']}
await write('seed-output/categories.json',categories)

for(const source of sourceConfig.sources) {
  const path=`seed-output/questions/${source.categoryId}.json`
  const bank=await read(path)
  Object.assign(bank,missingFormatQuestions(source.categoryId,bank))
  categories[source.categoryId]={...categories[source.categoryId],questionCount:Object.keys(bank).length,expectedCount:Object.keys(bank).length,types:allQuestionTypes,enabledModes:allStudyModes}
  for(const q of Object.values(bank)) {
    if(!q.answerOrigin)q.answerOrigin='source-key'
    if(!q.sourceAnswer && q.originalAnswerLetter)q.sourceAnswer=q.originalAnswerLetter
    if(source.categoryId==='pre-finals' && q.originalNumber==='27') {
      q.verificationStatus='review-required';q.reviewNote='Source states equity at December 31, then adds net income/dividends again. The supplied B key is retained pending review.'
    }
  }
  await write(path,bank)
  const qa=validateBank(bank,source)
  if(qa.errors.length)throw new Error(source.categoryId+': '+qa.errors.join('; '))
  const prior=manifest.reports.find((r)=>r.categoryId===source.categoryId)
  const report={categoryId:source.categoryId,sourceDocument:source.filename,...qa,warnings:prior?.warnings??[],missingNumbers:[]}
  manifest.reports=manifest.reports.filter((r)=>r.categoryId!==source.categoryId).concat(report)
}
await write('seed-output/manifest.json',manifest)
await write('seed-output/categories.json',categories)
await writeFile('seed-output/QA_REPORT.md','# Source import audit\n\n'+manifest.reports.map((r)=>`## ${r.categoryId}\n\n${r.count} records; ${r.keyed} keyed; ${r.verified} source-verified; ${r.reviewRequired} flagged.\n\n${r.warnings.map((w)=>'- '+w).join('\n')}\n`).join('\n'))
console.log(JSON.stringify(manifest.reports.map(({categoryId,count,verified,reviewRequired})=>({categoryId,count,verified,reviewRequired})),null,2))
