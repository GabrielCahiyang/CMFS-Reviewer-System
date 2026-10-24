export const allQuestionTypes = ['multiple-choice', 'true-false', 'identification', 'enumeration']
export const allStudyModes = ['practice', 'exam', 'flashcard', 'mixed']

const capital = {
  identification: [
    ['What market handles newly issued shares and bonds?', 'Primary market', 'primary market'],
    ['What market handles trading in securities that have already been issued?', 'Secondary market', 'secondary market'],
    ['What financial instrument represents a debt obligation of its issuer?', 'Bond', 'bond'],
    ['What is the term for spreading investments across different assets to reduce concentration risk?', 'Diversification', 'diversif'],
    ['What ratio divides market price per share by earnings per share?', 'Price-to-earnings ratio', 'P/E'],
    ['What bias describes following the investment decisions of a crowd?', 'Herding', 'herd'],
    ['What term describes a company’s mix of debt and equity financing?', 'Capital structure', 'capital structure'],
    ['What financial measure equals current assets minus current liabilities?', 'Net working capital', 'working capital'],
  ],
  'true-false': [
    ['A primary-market transaction involves newly issued securities.', true, 'primary market'],
    ['Existing securities are generally traded in the secondary market.', true, 'secondary market'],
    ['Bond prices generally move in the same direction as market interest rates.', false, 'interest rates'],
    ['Diversification guarantees that an investment portfolio cannot lose value.', false, 'diversif'],
    ['A company’s capital structure includes both debt and equity financing.', true, 'capital structure'],
    ['The current ratio is calculated by subtracting current liabilities from current assets.', false, 'current ratio'],
    ['A bond’s coupon payment is a dividend paid to an equity shareholder.', false, 'coupon'],
    ['Herding can cause investors to follow a group instead of doing their own analysis.', true, 'herd'],
  ],
  enumeration: [
    ['Name the two security markets distinguished by whether securities are newly issued or already outstanding.', ['Primary market', 'Secondary market'], 'market'],
    ['Name the two broad financing components of capital structure.', ['Debt', 'Equity'], 'capital structure'],
    ['Name the two financial statement amounts used to calculate the current ratio.', ['Current assets', 'Current liabilities'], 'current ratio'],
    ['Name the two per-share amounts used to calculate the price-to-earnings ratio.', ['Market price per share', 'Earnings per share'], 'P/E'],
    ['Name the three periods used to calculate the cash conversion cycle.', ['Inventory period', 'Receivables collection period', 'Payables deferral period'], 'cash conversion'],
    ['Name the two values compared to determine whether a bond trades at a premium or a discount.', ['Market price', 'Face value'], 'bond'],
    ['Name the two amounts used to calculate a bond’s current yield.', ['Annual coupon payment', 'Current market price'], 'yield'],
    ['Name two behavioral biases involving following the crowd and overestimating one’s investing ability.', ['Herding', 'Overconfidence'], 'behavior'],
  ],
}

const prefinals = {
  identification: [
    ['What financial statement presents assets, liabilities and equity at a particular date?', 'Balance sheet', 'balance sheet'],
    ['What is the term for the mix of long-term debt and equity used to finance a company?', 'Capital structure', 'capital structure'],
    ['What valuation approach discounts expected future cash flows to their present value?', 'Discounted cash flow', 'discounted cash flow'],
    ['What financial measure equals current assets minus current liabilities?', 'Net working capital', 'working capital'],
    ['What liquidity ratio divides current assets by current liabilities?', 'Current ratio', 'current ratio'],
    ['What risk describes the fall in an existing bond’s price when market interest rates rise?', 'Interest rate risk', 'interest rate risk'],
    ['What type of market handles trading in existing shares between investors?', 'Secondary market', 'secondary market'],
    ['What business structure generally gives shareholders limited liability for company debts?', 'Corporation', 'corporation'],
  ],
  enumeration: [
    ['Name the two main components of capital structure.', ['Debt', 'Equity'], 'capital structure'],
    ['Name the three main categories presented in a balance sheet.', ['Assets', 'Liabilities', 'Equity'], 'balance sheet'],
    ['Name the two values used to calculate the current ratio.', ['Current assets', 'Current liabilities'], 'current ratio'],
    ['Name the two values used to calculate the debt ratio.', ['Total liabilities', 'Total assets'], 'debt ratio'],
    ['Name the three periods used to calculate the cash conversion cycle.', ['Inventory period', 'Receivables collection period', 'Payables deferral period'], 'cash conversion'],
    ['Name the three credit-policy considerations involving customer eligibility, credit amounts and recovery.', ['Credit standards', 'Credit limits', 'Collection efforts'], 'credit policy'],
    ['Name the two market categories distinguished by newly issued versus existing securities.', ['Primary market', 'Secondary market'], 'market'],
    ['Name the two amounts used to calculate book value per share.', ['Common equity', 'Shares outstanding'], 'book value'],
  ],
}

const working = {
  identification: [
    ['What financial measure equals current assets minus current liabilities?', 'Net working capital', 'Working capital is'],
    ['What cycle measures the time between paying for operating resources and collecting cash from customers?', 'Cash conversion cycle', 'Cash Conversion Cycle'],
    ['What cash conversion cycle component measures the average time taken to sell inventory?', 'Days Inventory Outstanding', 'Days Inventory Outstanding'],
    ['What cash conversion cycle component measures the average time taken to collect credit sales?', 'Receivables period', 'Receivables Period'],
    ['What cash conversion cycle component measures the average time taken to pay suppliers?', 'Payables period', 'Payables Period'],
    ['Which working capital policy generally keeps larger liquidity buffers to reduce liquidity risk?', 'Conservative policy', 'conservative'],
    ['What bank placement holds funds for a specified period and commonly pays more interest than a savings account?', 'Time deposit', 'time deposit'],
    ['What is the term for the return forgone by holding cash instead of investing it?', 'Opportunity cost', 'opportunity cost'],
  ],
  'true-false': [
    ['Net working capital equals current assets minus current liabilities.', true, 'Working capital is'],
    ['Inventory can be a component of current assets.', true, 'Inventory'],
    ['A conservative working capital policy generally aims to maintain a larger liquidity buffer.', true, 'conservative'],
    ['An aggressive working capital policy normally eliminates liquidity risk.', false, 'aggressive'],
    ['The cash conversion cycle adds the inventory and receivables periods and subtracts the payables period.', true, 'cash conversion'],
    ['Extending supplier payment terms, with other factors unchanged, always increases the cash conversion cycle.', false, 'payment terms'],
    ['A longer receivables collection period usually shortens the cash conversion cycle.', false, 'Receivables Period'],
    ['Holding idle cash can involve an opportunity cost.', true, 'opportunity cost'],
  ],
  enumeration: [
    ['Name the two balance-sheet categories used to calculate net working capital.', ['Current assets', 'Current liabilities'], 'Working capital is'],
    ['Name the three periods used to calculate the cash conversion cycle.', ['Inventory period', 'Receivables period', 'Payables period'], 'Cash Conversion Cycle'],
    ['Name the two periods added before the payables period is subtracted in the cash conversion cycle.', ['Inventory period', 'Receivables period'], 'Cash Conversion Cycle'],
    ['Name the three broad working capital policies discussed in the reviewer.', ['Conservative', 'Aggressive', 'Moderate'], 'policy'],
    ['Name the two operating balances involving unsold goods and unpaid customer invoices.', ['Inventory', 'Accounts receivable'], 'working capital'],
    ['Name the two operating cash timing activities synchronized by cash management.', ['Cash receipts', 'Cash payments'], 'Synchronization'],
    ['Name the two amounts multiplied to estimate daily interest forgone on idle cash.', ['Cash balance', 'Daily interest rate'], 'opportunity cost'],
    ['Name the two amounts used to calculate inventory turnover.', ['Cost of goods sold', 'Average inventory'], 'inventory turnover'],
  ],
}

export function missingFormatQuestions(categoryId, bank) {
  const existingTypes = new Set(Object.values(bank).map(q => q.type))
  const templates = categoryId === 'working-capital' ? working : categoryId === 'pre-finals' ? prefinals : capital
  const additions = {}
  for (const type of allQuestionTypes) {
    if (existingTypes.has(type)) continue
    if (!templates[type]?.length) throw new Error(`No source-grounded ${type} templates for ${categoryId}.`)
    templates[type].forEach(([question, answer, hint], index) => {
      const records = Object.entries(bank)
      const anchors = records.filter(([, q]) => `${q.question} ${q.explanation ?? ''} ${JSON.stringify(q.choices ?? [])}`.toLowerCase().includes(hint.toLowerCase()))
      // Keep source references within the selected reviewer, including conceptual aliases.
      const [anchorId, anchor] = anchors[0] ?? records[0]
      const key = `derived-${type}-${String(index + 1).padStart(3, '0')}`
      const isTF = type === 'true-false'
      additions[key] = {
        originalNumber: `Derived ${type} ${index + 1}`, question, type,
        correctAnswer: isTF ? answer ? 'True' : 'False' : answer,
        ...(isTF ? { choices: ['True', 'False'] } : {}),
        topic: anchor.topic, sourceDocument: anchor.sourceDocument,
        ...(anchor.sourcePage ? { sourcePage: anchor.sourcePage } : {}),
        derived: true, answerOrigin: 'generated', verificationStatus: 'review-required',
        explanation: 'Additional study question based on the concepts covered by this reviewer. The generated answer awaits instructor review.',
        reviewNote: `Generated study format; original questions and supplied keys are unchanged. Reviewer reference: ${anchorId}, original ${anchor.originalNumber}.`,
      }
    })
  }
  return additions
}
