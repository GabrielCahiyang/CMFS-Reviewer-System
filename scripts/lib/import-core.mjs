import { createHash } from 'node:crypto'

export const hash = (value) => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : stableJson(value)).digest('hex')
export const stableJson = (value) => JSON.stringify(canonical(value))
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((k) => [k,canonical(value[k])]))
  return value
}
export const safeKey = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value)
export const normalizeSpace = (value) => value.replace(/\s+/g, ' ').trim()
const decode = (s) => s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ').replace(/&amp;/g,'&')

// Preserve a private HTML copy as the formatting reference. List numbers reconstructed
// from HTML remain provisional: Word numbering/style overrides need source review.
export function htmlToLines(html) {
  let counter = 0, ordered = false
  const lines = []
  for (const token of html.split(/(<\/?(?:ol|ul|li|p|h[1-6])\b[^>]*>)/i)) {
    if (/^<ol\b/i.test(token)) { ordered = true; counter = Number(token.match(/start="(\d+)"/)?.[1] ?? 1) - 1 }
    else if (/^<\/ol/i.test(token)) ordered = false
    else if (/^<li\b/i.test(token)) lines.push(ordered ? `${++counter}. ` : '')
    else if (/^<(?:p|h[1-6])\b/i.test(token)) lines.push('')
    else if (!/^<\//.test(token)) {
      const text = decode(token.replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]*>/g,''))
      if (text.trim()) { if (!lines.length) lines.push(''); lines[lines.length-1] += text }
    }
  }
  return lines.flatMap((text) => text.split('\n')).map((text) => ({ text: text.trim(), page: '' })).filter((l) => l.text)
}

export function parseQuestionLines(lines, source) {
  const questions = {}, warnings = [], keys = new Map()
  let inKeys = false, current, originalAnswer = '', rationale = false
  const finish = () => {
    if (!current) return
    const id = `q-${current.originalNumber.padStart(3,'0')}`
    if (questions[id]) { warnings.push(`Duplicate source number ${current.originalNumber}; import blocked.`); current = undefined; return }
    const { optionLetters, ...record } = current
    record.question = normalizeSpace(record.question)
    if (record.choices.length < 2) { delete record.choices; record.type = 'identification' }
    record.correctAnswer = ''
    record.verificationStatus = 'review-required'
    questions[id] = { ...record, _optionLetters: optionLetters, _inlineAnswer: originalAnswer }
    current = undefined; originalAnswer = ''; rationale = false
  }
  for (const line of lines) {
    const text = line.text.trim()
    if (/^(?:answer\s*key|answers(?:\s+and\s+explanations)?)(?:\s*[:—-].*)?$/i.test(text)) { finish(); inKeys = true; continue }
    if (inKeys) {
      const matches = [...text.matchAll(/(?:^|\s)(\d{1,4})\s*[.)\-:]\s*([A-H])(?:\s*[.)])?(?=\s|$)/gi)]
      if (matches.length) for (const m of matches) {
        if (keys.has(m[1])) warnings.push(`Duplicate key ${m[1]}; import blocked.`)
        keys.set(m[1], { answer: m[2].toUpperCase(), explanation: matches.length === 1 ? text.slice(m.index + m[0].length).replace(/^\s*[-:–—]\s*/, '') : '' })
      }
      else if (text) warnings.push(`Unparsed answer-key text: ${text.slice(0,100)}`)
      continue
    }
    const numbered = text.match(/^(?:Question\s+)?(\d{1,4})\s*[.)]\s+(.+)$/i)
    if (numbered) {
      finish()
      current = { originalNumber: numbered[1], question: numbered[2], type: 'multiple-choice', choices: [],
        optionLetters: [], topic: source.title, sourceDocument: source.filename,
        ...(line.page ? { sourcePage: String(line.page) } : {}), derived: false }
      continue
    }
    if (!current) continue
    const explicit = text.match(/^(?:CORRECT\s+ANSWER|Answer)\s*:\s*(.+)$/i)
    if (explicit) { originalAnswer = explicit[1].trim(); rationale = false; continue }
    if (/^(?:Why\s*\(Simple Bisaya-English\)|Explanation|Rationale)\s*:/i.test(text)) {
      rationale = true; current.explanation = text.replace(/^[^:]*:\s*/, ''); continue
    }
    const option = text.match(/^([A-H])\s*[.)]\s*(.+)$/i)
    if (rationale) current.explanation = `${current.explanation ?? ''} ${text}`.trim()
    else if (option) { current.optionLetters.push(option[1].toUpperCase()); current.choices.push(option[2]) }
    else if (current.choices.length) current.choices[current.choices.length - 1] += ` ${text}`
    else current.question += ` ${text}`
  }
  finish()
  for (const [id,q] of Object.entries(questions)) {
    const key = keys.get(q.originalNumber)
    const answer = q._inlineAnswer || key?.answer || ''
    const letter = answer.match(/^([A-H])(?:\s*[.)\-:]|$)/i)?.[1]?.toUpperCase()
    const exact = letter ? q.choices?.[q._optionLetters.indexOf(letter)] : q.choices?.find((c) => normalizeSpace(c) === normalizeSpace(answer))
    q.originalAnswerLetter = letter ?? ''
    q.correctAnswer = exact ?? (q.type === 'identification' ? answer : '')
    if (key?.explanation && !q.explanation) q.explanation = key.explanation
    if (q.correctAnswer && (!q.choices || q.choices.filter((c) => c === q.correctAnswer).length === 1)) q.verificationStatus = 'verified'
    if (source.highlightedAnswers && !answer) warnings.push(`${id}: highlighted answer requires visual review.`)
    // This known source ambiguity must survive automated extraction.
    if (source.categoryId === 'new-reviewer' && q.originalNumber === '39') q.verificationStatus = 'review-required'
    if (q._inlineAnswer && key?.answer && letter !== key.answer) { q.verificationStatus = 'review-required'; warnings.push(`${id}: inline answer disagrees with the answer key.`) }
    delete q._inlineAnswer; delete q._optionLetters
  }
  for (const number of keys.keys()) if (!Object.values(questions).some((q) => q.originalNumber === number)) warnings.push(`Orphan answer key ${number}; import blocked.`)
  const numbers = Object.values(questions).map((q) => Number(q.originalNumber)).sort((a,b) => a-b)
  const missingNumbers = Array.from({ length: numbers.at(-1) ?? 0 }, (_,i) => i+1).filter((n) => !numbers.includes(n))
  return { questions, warnings, missingNumbers, answerKeyCount: keys.size }
}

export function validateBank(questions, source = {}) {
  const errors = [], counts = { count: 0, verified: 0, reviewRequired: 0, keyed: 0 }
  const seen = new Set()
  if (!questions || typeof questions !== 'object' || Array.isArray(questions)) return { errors: ['Expected a question map.'], ...counts }
  const allowed = new Set(['originalNumber','question','type','choices','correctAnswer','originalAnswerLetter','acceptedAnswers','alternatives','orderMatters','explanation','topic','formula','sourceDocument','sourcePage','verificationStatus','derived','contentVersion','importId','reviewedBy','answerOrigin','sourceAnswer','reviewNote'])
  const walk = (value,path) => { if (value && typeof value === 'object') for (const [k,v] of Object.entries(value)) { if (/[.#$\[\]/\x00-\x1f\x7f]/.test(k)) errors.push(`${path}: Firebase-unsafe key ${k}`); walk(v,`${path}/${k}`) } }
  walk(questions,'questions')
  for (const [id,q] of Object.entries(questions)) {
    counts.count++
    if (!safeKey(id) || !q || typeof q !== 'object') { errors.push(`${id}: invalid record.`); continue }
    for (const field of Object.keys(q)) if (!allowed.has(field)) errors.push(`${id}: unexpected field ${field}.`)
    for (const field of ['originalNumber','question','topic','sourceDocument']) if (typeof q[field] !== 'string' || !q[field].trim()) errors.push(`${id}: missing ${field}.`)
    if (source.filename && q.sourceDocument !== source.filename) errors.push(`${id}: incorrect source filename.`)
    if (seen.has(q.originalNumber)) errors.push(`${id}: duplicate source number.`)
    seen.add(q.originalNumber)
    if (!['multiple-choice','true-false','identification','enumeration'].includes(q.type)) errors.push(`${id}: invalid type.`)
    if (!['verified','review-required'].includes(q.verificationStatus)) errors.push(`${id}: invalid verification status.`)
    const answers = Array.isArray(q.correctAnswer) ? q.correctAnswer : [q.correctAnswer]
    if (answers.some((a) => typeof a !== 'string')) errors.push(`${id}: invalid answer format.`)
    const keyed = answers.length > 0 && answers.every((a) => typeof a === 'string' && a.trim())
    if (keyed) counts.keyed++
    if (q.verificationStatus === 'verified') {
      counts.verified++
      if (!keyed) errors.push(`${id}: verified question is missing its key.`)
      if (['multiple-choice','true-false'].includes(q.type) && (!Array.isArray(q.choices) || q.choices.length < 2 || typeof q.correctAnswer !== 'string' || q.choices.filter((c) => c === q.correctAnswer).length !== 1)) errors.push(`${id}: key does not resolve to exactly one choice.`)
      if (q.derived && (!q.reviewedBy || !q.sourcePage)) errors.push(`${id}: derived content requires a named reviewer and source page.`)
    } else counts.reviewRequired++
    if (q.choices && (!Array.isArray(q.choices) || q.choices.some((c) => typeof c !== 'string' || !c.trim()) || new Set(q.choices).size !== q.choices.length)) errors.push(`${id}: empty or duplicate options.`)
  }
  const originalCount = Object.values(questions).filter(q => !q?.derived).length
  if (source.expectedCount && originalCount !== source.expectedCount) errors.push(`Expected ${source.expectedCount} original questions; found ${originalCount}.`)
  if (!counts.count) errors.push('No questions extracted.')
  return { errors, ...counts }
}

export function fieldDiff(before, after, path = '') {
  if (stableJson(before) === stableJson(after)) return []
  if (before && after && typeof before === 'object' && typeof after === 'object' && !Array.isArray(before) && !Array.isArray(after))
    return [...new Set([...Object.keys(before),...Object.keys(after)])].flatMap((key) => fieldDiff(before[key], after[key], `${path}/${key}`))
  return [{ path, before: before ?? null, after: after ?? null }]
}
