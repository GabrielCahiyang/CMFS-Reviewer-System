export function financialChoiceQuestions(sourceDocument) {
  const mcqs = [
    [4,'Which statement shows assets, liabilities and equity at a specific date?',['Balance sheet','Income statement','Statement of cash flows','Sales budget'],0],
    [4,'Which financial statement reports revenues, expenses and profit over a period?',['Balance sheet','Income statement','Inventory listing','Bank reconciliation'],1],
    [6,'Which item is an example of a current asset?',['Inventory','Five-year bank loan','Share capital','Long-term mortgage payable'],0],
    [6,'Which item is normally classified as a non-current asset?',['Accounts receivable','Inventory','Property, plant and equipment','Cash'],2],
    [9,'What arises when an acquisition price exceeds the fair value of net assets acquired?',['Unearned revenue','Goodwill','Accounts payable','Contributed capital'],1],
    [9,'Which item is an intangible asset?',['Inventory','Machinery','Trademark','Cash'],2],
    [13,'Which shares normally carry voting rights?',['Common shares','Treasury bonds','Bank loans','Trade payables'],0],
    [13,'Which shares generally have dividend priority over common shares?',['Common shares','Preferred shares','Authorised but unissued shares','Treasury bills'],1],
    [25,'Buying production equipment is generally classified under which cash-flow activity?',['Operating','Investing','Financing','Revenue recognition'],1],
    [25,'Issuing shares to raise cash is classified under which cash-flow activity?',['Operating','Investing','Financing','Depreciation'],2],
    [27,'The indirect method of reporting operating cash flow starts with which amount?',['Cash receipts','Net income','Total assets','Share capital'],1],
    [31,'Which formula calculates the current ratio?',['Current assets divided by current liabilities','Total liabilities divided by total assets','Net income divided by revenue','Revenue divided by inventory'],0],
  ]
  const tf = [
    [4,'A balance sheet presents the financial position at a point in time.',true],
    [4,'An income statement reports profitability over a period of time.',true],
    [6,'Inventory is an example of a current asset.',true],
    [6,'A loan repayable over five years is a current liability merely because it is a bank loan.',false],
    [9,'Intangible assets have physical substance.',false],
    [9,'Unearned revenue can arise when payment is received before a service is delivered.',true],
    [13,'Preferred shares generally receive dividends after common shares.',false],
    [25,'The cash flow statement separates operating, investing and financing activities.',true],
    [25,'Proceeds from issuing shares are normally an operating cash inflow.',false],
    [27,'The direct method starts with cash transactions.',true],
    [27,'The indirect method starts with total liabilities.',false],
    [31,'The current ratio is current liabilities divided by current assets.',false],
  ]
  const record = (number,page,question,choices,answer,type) => ({
    originalNumber:`Derived ${number}`,question,type,choices,correctAnswer:answer,
    topic:page<15?'Balance sheet':page<24?'Income statement':page<29?'Cash flow':'Financial reporting',
    sourceDocument,sourcePage:String(page),derived:true,answerOrigin:'generated',verificationStatus:'review-required',
    explanation:`Generated study question based on page ${page} of the supplied reference. The answer awaits instructor review.`,
    reviewNote:'Generated from teaching material; no original exam question or supplied key is claimed.',
  })
  return Object.fromEntries([
    ...mcqs.map(([page,question,choices,correct],i)=>[`q-${String(41+i).padStart(3,'0')}`,record(41+i,page,question,choices,choices[correct],'multiple-choice')]),
    ...tf.map(([page,question,correct],i)=>[`q-${String(53+i).padStart(3,'0')}`,record(53+i,page,question,['True','False'],correct?'True':'False','true-false')]),
  ])
}
