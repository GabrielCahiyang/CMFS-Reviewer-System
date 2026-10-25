import assert from 'node:assert/strict'

const finance = 'https://openstax.org/books/principles-finance/pages/19-1-what-is-working-capital'
const ratios = 'https://openstax.org/books/principles-finance/pages/6-2-operating-efficiency-ratios'
const bookValue = 'https://openstax.org/books/principles-finance/pages/6-5-market-value-ratios'
const bonds = 'https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins/what-are'
const depreciation = 'https://openstax.org/books/principles-financial-accounting/pages/11-3-explain-and-apply-depreciation-methods-to-allocate-capitalized-costs'
const npv = 'https://openstax.org/books/principles-finance-2e/pages/16-5-choosing-between-projects'
const structures = 'https://www.sba.gov/business-guide/launch-your-business/choose-business-structure'
const yieldCurve = 'https://openstax.org/books/principles-finance-2e/pages/10-3-using-the-yield-curve'

// Each change has a source-key precondition. Original prompt/options/key/rationale
// are captured in the audit before any correction. No extra questions are made.
const changes = [
  ['reviewer-1', '17', 'A', { letters: ['C'], why: 'An inverted curve has short-term yields above long-term yields. Expected declining future rates/inflation can explain inversion; a higher positive maturity premium instead pushes long-term yields up.', reference: yieldCurve }],
  ['reviewer-1', '26', 'B', { add: '$20.25', why: 'The question explicitly gives year-end common equity. Book value per share = $4,050,000 / 200,000 = $20.25. Adding the same year income/dividends again double-counts them.', reference: bookValue }],
  ['reviewer-1', '68', 'D', { add: 'Sole proprietorship and general partnership (A and C).', why: 'In the textbook US formation comparison, sole proprietorships and general partnerships do not require incorporation. A limited partnership requires formal registration; routine business licenses can still be required.', reference: 'https://dor.wa.gov/open-business/choose-ownership-structure/compare-business-structures' }],
  ['reviewer-1', '69', 'D', { add: 'Sole proprietorship and general partnership (A and C).', why: 'Sole proprietors and general partners have personal liability for business obligations. A limited partnership includes limited partners, so the printed A-and-B combination is not a valid general description.', reference: structures }],
  ['reviewer-2', '37', 'B', { add: 'None of the listed factors: all can affect bond value.', why: 'Market rates, maturity and coupon affect discounted bond cash flows. Company earnings can also affect credit quality and the required credit spread, so they cannot be treated as irrelevant to bond value.', reference: bonds }],
  ['reviewer-2', '39', 'A', { add: 'Cannot determine premium or discount to par from the information given.', why: 'Price relative to par depends on the coupon rate versus the required yield. The question supplies yields but no coupon rate, so it does not establish whether price is above or below par.', reference: bonds }],
  ['reviewer-2', '46', 'C', { letters: ['A', 'C'], why: 'Both marketable securities and accounts receivable are current assets and can be components of working capital. Either listed answer is accepted.', reference: finance }],
  ['reviewer-3', '9', 'C', { letters: ['B'], why: 'Income-bond interest is contingent on sufficient earnings/profits, rather than gross revenue alone.', reference: bonds }],
  ['reviewer-3', '22', 'A', { add: 'It makes buying and selling easier without substantially changing the market price.', why: 'Market liquidity supports prompt trading with limited price impact; it does not guarantee sales limits or protection against unethical platforms. The supplied options do not state the definition.', reference: 'https://www.investor.gov/introduction-investing/investing-basics/glossary/liquidity-or-marketability' }],
  ['reviewer-3', '59', 'B', { add: 'Assets minus liabilities at their accounting carrying amounts.', why: 'Book value of equity is net accounting assets after liabilities. Historical asset cost alone omits liabilities and accumulated accounting adjustments.', reference: bookValue }],
  ['reviewer-3', '91', 'B', { letters: ['A'], why: 'An inverted curve has higher short-term than long-term yields for comparable credit risks. Of these choices, long-term fixed-rate debt uses the lower end of the stated curve.', reference: yieldCurve }],
  ['reviewer-3', '112', 'B', { letters: ['C'], why: 'A+B costs $600,000 + $400,000 = $1,000,000 and gives NPV $150,000 + $100,000 = $250,000. B+C gives $220,000; A+C exceeds the budget.', reference: npv }],
  ['reviewer-3', '115', 'B', { letters: ['C'], why: 'Limited liability protection is a standard corporate advantage. A corporation generally involves more paperwork and regulation than a sole proprietorship.', reference: structures }],
  ['reviewer-4', '103', 'C', { add: 'Cannot determine uniquely without the receivables collection period; 15 days if sales are collected immediately.', why: 'CCC = 30 + DSO - 15 = 15 + DSO days. No receivables period is supplied. For cash sales, DSO = 0 and the result is 15 days; 45 days is not justified by the stated data.', reference: finance }],
  ['reviewer-4', '104', 'B', { letters: ['A'], why: 'Average inventory = cost of goods sold / inventory turnover = $600,000 / 12 = $50,000.', reference: ratios }],
  ['reviewer-4', '106', 'C', { letters: ['A'], why: 'CCC = inventory days + receivables days - payables days = 60 + 45 - 30 = 75 days. The asset, liability and operating cash amounts do not change this calculation.', reference: finance }],
  ['reviewer-4', '107', 'A', { letters: ['B'], why: 'Straight-line depreciation = (cost - salvage value) / useful life = ($80,000 - $20,000) / 5 = $12,000 per year.', reference: depreciation }],
  ['reviewer-4', '108', 'C', { add: 'Cannot be determined from the information provided.', why: 'CCC requires inventory, receivables and payables periods. Only the 20-day inventory period is supplied; dollar balances and total operating cash flow do not determine the other two periods.', reference: finance }],
  ['reviewer-4', '110', 'B', { add: 'Cannot determine standard inventory turnover without cost of goods sold.', why: 'Inventory turnover = cost of goods sold / average inventory. The question gives annual sales rather than COGS. Sales / inventory would be 8.0, but the cost-based turnover cannot be uniquely calculated.', reference: ratios }],
  ['reviewer-4', '111', 'C', { letters: ['A'], why: 'CCC = 45 inventory days + 30 receivables days - 60 payables days = 15 days.', reference: finance }],
  ['reviewer-4', '112', 'A', { letters: ['B'], why: 'A $50 semiannual coupon on $1,000 is $100 per year, a 10% coupon rate. With a 10% YTM, the coupon rate equals the discount rate and the bond sells at par: $1,000.', reference: bonds }],
  ['reviewer-4', '114', 'A', { add: '72 days', why: 'Reducing 90 days by 20% gives 90 * (1 - 0.20) = 72 days. None of the four printed options equals 72.', reference: finance }],
  ['reviewer-4', '116', 'D', { add: '45 days', why: 'CCC = 30 inventory days + 60 receivables days - 45 payables days = 45 days. None of the four printed options equals 45.', reference: finance }],
  ['pre-finals', '8', 'C', { letters: ['C', 'D'], why: 'A rising corporate yield curve may reflect maturity risk premiums (D) and does not guarantee that long-term bonds are better investments (C). Both statements are defensible; either answer is accepted.', reference: yieldCurve }],
  ['pre-finals', '15', 'B', { explanationOnly: true, why: 'Borrowing short-term and using the proceeds to repay long-term debt increases current liabilities while leaving current assets unchanged after the transaction. The current ratio therefore falls. The printed key B is retained; its original rationale described a different transaction.', reference: finance }],
  ['pre-finals', '27', 'B', { add: '$20.25', why: 'The wording gives $4,050,000 as equity at December 31. Book value per share = $4,050,000 / 200,000 = $20.25; do not add the same year income and dividends again.', reference: bookValue }],
  ['pre-finals', '31', 'C, E', { letters: ['A', 'B', 'C', 'D', 'E'], why: 'All five statements describe defensible credit-risk pricing directions, other things held constant: weaker inventory turnover, slower collections, lower interest coverage or lower liquidity can raise borrowing risk, while less leverage can lower it. The supplied C/E set is therefore too restrictive; any defensible listed statement is accepted.', reference: 'https://openstax.org/books/principles-finance/pages/6-3-liquidity-ratios' }],
  ['working-capital', '15', 'D', { add: 'The time from paying cash for operating inputs until collecting cash from customers.', why: 'The complete cash conversion cycle includes inventory and receivables timing, offset by supplier credit. Receivables collection alone is only one component.', reference: finance }],
  ['working-capital', '17', 'A', { letters: ['D'], why: 'CCC = DIO + DSO - DPO. Reducing DPO, with other periods unchanged, increases the cash conversion cycle because suppliers are paid sooner.', reference: finance }],
  ['working-capital', '18', 'C', { add: 'The time from paying cash for operating inputs until collecting cash from customers.', why: 'The complete CCC runs from cash paid for operating inputs to cash received from customers, accounting for supplier credit. Sales-to-cash alone describes receivables collection.', reference: finance }],
  ['working-capital', '33', 'D', { explanationOnly: true, why: 'Net working capital = current assets - current liabilities. In D, the increase in receivables exceeds the decrease in inventory, so total current assets and NWC increase. Equal increases in inventory and accounts payable in C leave NWC unchanged.', reference: finance }],
  ['working-capital', '39', 'C', { add: 'Cannot determine net float without the disbursement clearing period.', why: 'Collection float is $40,000 * 5 = $200,000. Net float also requires disbursement float ($35,000 times its clearing period), but that period is not supplied. A $5,000 daily difference is not a float balance. If both periods were five days, net disbursement-minus-collection float would be -$25,000.', reference: 'https://www.newyorkfed.org/research/staff_reports/sr84.html' }],
]

export function correctReplacementBank(categoryId, bank) {
  const audit = []
  for (const [category, number, printedLetter, edit] of changes) {
    if (category !== (categoryId === 'numbered-reviewer' ? 'reviewer-3' : categoryId)) continue
    const [id, question] = Object.entries(bank).find(([,q]) => q.originalNumber === number) ?? []
    assert.ok(question, `Correction target missing: ${category}/${number}`)
    assert.equal(question.originalAnswerLetter, printedLetter, `Source key changed: ${category}/${number}`)
    const before = structuredClone(question)
    if (edit.add) {
      assert.ok(!question.choices.includes(edit.add))
      question.choices.push(edit.add)
      question.correctAnswer = edit.add
    } else if (edit.letters) {
      const answers = edit.letters.map(letter => question.choices[letter.charCodeAt(0)-65])
      assert.ok(answers.every(Boolean))
      question.correctAnswer = answers.length === 1 ? answers[0] : answers
    }
    question.explanation = edit.why
    question.reviewedBy = 'Source and formula audit, 2026-10-26'
    question.reviewNote = `Corrected with user authorization. Printed source key retained: ${before.sourceAnswer}. ${edit.why}`
    question.verificationStatus = Array.isArray(question.correctAnswer) ? 'review-required' : 'verified'
    audit.push({ categoryId, questionId: id, originalNumber: number, sourceDocument: question.sourceDocument,
      sourcePage: question.sourcePage, before, after: structuredClone(question), reason: edit.why, reference: edit.reference })
  }
  return audit
}
