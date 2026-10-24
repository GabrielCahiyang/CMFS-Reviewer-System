import json, pathlib, re, hashlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'seed-output'
INSPECT = OUT / 'inspection'
sources = json.loads((ROOT/'scripts/source-manifest.json').read_text(encoding='utf-8'))['sources']
reports, categories = [], {}
def text(x): return re.sub(r'\s+', ' ', x).strip()
def paragraphs(category): return json.loads((INSPECT/f'{category}.paragraphs.json').read_text(encoding='utf-8'))
def write_bank(source, records, notes=None):
    bank = {}
    for n, rec in enumerate(records, 1):
        rec.update({'topic': rec.get('topic', source['title']), 'sourceDocument':source['filename'], 'derived':rec.get('derived',False)})
        if 'type' not in rec:
            rec['type'] = 'true-false' if [v.lower() for v in rec.get('choices',[])] == ['true','false'] else 'multiple-choice'
        rec.setdefault('correctAnswer','')
        rec.setdefault('verificationStatus','verified' if rec['correctAnswer'] else 'review-required')
        bank[f'q-{n:03}'] = rec
    (OUT/'questions'/f'{source["categoryId"]}.json').write_text(json.dumps(bank,ensure_ascii=False,indent=2),encoding='utf-8')
    categories[source['categoryId']]={'title':source['title'],'description':source['title'],'sourceDocument':source['filename'],'icon':source['icon'],'color':source['color'],'questionCount':len(records),'expectedCount':len(records),'types':list(dict.fromkeys(q['type'] for q in records)),'enabledModes':['practice','exam','flashcard','mixed']}
    reports.append({'categoryId':source['categoryId'],'sourceDocument':source['filename'],'count':len(records),'keyed':sum(bool(q['correctAnswer']) for q in records),'verified':sum(q['verificationStatus']=='verified' for q in records),'reviewRequired':sum(q['verificationStatus']=='review-required' for q in records),'errors':[],'warnings':notes or [],'missingNumbers':[]})
    print(source['categoryId'],len(records),'questions;',sum(bool(q['correctAnswer']) for q in records),'keys')
    return bank

def letter_key(q,letter):
    letter=letter.upper(); i=ord(letter)-65
    if not 0<=i<len(q['choices']): raise ValueError(f'Key {letter} not in options for {q["originalNumber"]}')
    q['correctAnswer']=q['choices'][i]; q['originalAnswerLetter']=letter

def split_options(value):
    matches=list(re.finditer(r'(?:^|\s)([a-eA-E])[.)]\s*(?=\S)',value))
    return [(m.group(1).upper(),text(value[m.end():matches[i+1].start() if i+1<len(matches) else len(value)])) for i,m in enumerate(matches)]

def new_reviewer(source):
    ps=[p['text'].strip() for p in paragraphs(source['categoryId']) if p['text'].strip()]
    end=next(i for i,p in enumerate(ps) if p.upper()=='ANSWERS:')
    records=[]
    for p in ps[:end]:
        m=re.match(r'^(\d+)\.\s*(.+)',p,re.S)
        opt=re.match(r'^([a-eA-E])[.)]\s*(.+)',p,re.S)
        if m: records.append({'originalNumber':m[1],'question':text(m[2]),'choices':[]})
        elif opt: records[-1]['choices'].append(text(opt[2]))
    # The first source key lists five answers per topic, with twelve topic headings.
    keyend=next(i for i,p in enumerate(ps) if p.startswith('Explanations:'))
    key=[]
    for p in ps[end+1:keyend]:
        m=re.match(r'^([a-dA-D])(?:[.)]\s*.*)?$',p,re.S)
        if m:key.append(m[1])
    if len(key)!=len(records): raise ValueError(f'NEW REVIEWER key count {len(key)} != {len(records)}')
    for q,l in zip(records,key): letter_key(q,l)
    # Numbered explanations 1–55, followed by five unnumbered explanation blocks.
    current=None
    for p in ps[keyend+1:]:
        m=re.match(r'^(\d+)\.\s*The correct answer is:\s*(.*)',p,re.S)
        if m:
            current=records[int(m[1])-1]
            current['explanation']=''
            p=m[2]
            if not p:continue
        if current is not None:
            current['explanation']=text(current.get('explanation','')+' '+p)
    for i,q in enumerate(records):
        if i>=55:q.pop('explanation',None)
    # Recover final unnumbered source rationales by matching their exact question text.
    tail='\n'.join(ps[keyend+1:])
    for idx in range(55,60):
        q=records[idx]; a=tail.find(q['question'])
        if a>=0:
            following=[tail.find(records[j]['question'],a+len(q['question'])) for j in range(idx+1,60)]
            b=min([v for v in following if v>=0],default=len(tail))
            q['explanation']=text(tail[a+len(q['question']):b])
    # Explanation 55 also contains the unnumbered tail in the original XML.
    q=records[54]
    if 'explanation' in q:q['explanation']=q['explanation'].split(records[55]['question'])[0].strip()
    records[38]['verificationStatus']='review-required'
    records[38]['reviewNote']='Source answer preserved; price/yield wording requires instructor review.'
    records[45]['verificationStatus']='review-required'
    records[45]['reviewNote']='Both marketable securities and accounts receivable can be current assets; supplied single key preserved.'
    return write_bank(source,records,['60 source questions and 60 source keys preserved. Items 39 and 46 flagged for source ambiguity.'])

def cfms(source):
    ps=paragraphs(source['categoryId']); records=[]; keys=[]; inkey=False
    for p in ps:
        value=p['text'].strip()
        if not value:continue
        if re.match(r'^Answer Key:',value,re.I):inkey=True;continue
        if inkey:
            if not re.fullmatch(r'[A-E]',value):raise ValueError(f'Unexpected CFMS key {value}')
            keys.append(value);continue
        m=re.match(r'^(\d+(?:-\d+)?)\.\s*(.+)',value,re.S)
        if m and p['numId'] is None:records.append({'originalNumber':m[1],'question':text(m[2]),'choices':[]})
        elif p['numId'] is not None:records[-1]['choices'].append(text(value))
        elif records:records[-1]['question']=text(records[-1]['question']+' '+value)
    if len(keys)!=len(records):raise ValueError(f'CFMS questions {len(records)} vs keys {len(keys)}')
    for q,l in zip(records,keys):letter_key(q,l)
    return write_bank(source,records,['Document title says 120, but it contains 121 questions and keys. The printed labels "10-102" and "1117" are preserved verbatim; source sequence maps to keys 102 and 117.'])

def huhu(source):
    ps=paragraphs(source['categoryId']); records=[];keys={}
    for p in ps:
        value=p['text'].strip()
        if not value:continue
        key=re.fullmatch(r'(\d+)\.\s*([a-e])',value,re.I)
        if key: keys[int(key[1])]=key[2];continue
        if re.fullmatch(r'[a-e]',value,re.I):keys[len(keys)+1]=value;continue
        lines=[v.strip() for v in value.splitlines() if v.strip()]
        if len(lines)>1 and re.match(r'^[a-e][.)]',lines[1],re.I):
            opts=split_options('\n'.join(lines[1:]))
            records.append({'originalNumber':str(len(records)+1),'question':text(lines[0]),'choices':[v for _,v in opts]})
    if len(keys)!=len(records):raise ValueError(f'HUHU questions {len(records)} vs keys {len(keys)}')
    for n,q in enumerate(records,1):letter_key(q,keys[n])
    return write_bank(source,records,['Word list numbers restart across sections; source sequence 1–120 matches the numbered 120-entry key.'])

def pdf_questions(source):
    pages=json.loads((INSPECT/f'{source["categoryId"]}.pages.json').read_text(encoding='utf-8'))
    records=[]; chunks=[]; current=None
    for page in pages:
        for line in page['text'].splitlines():
            if re.match(r'^(?:lOMoAR|Downloaded by|\d+\s*\|\s*Page)',line):continue
            m=re.match(r'^(\d{1,3})[.,]\s+(\S.*)',line)
            # Source skips 10 entirely; 13 uses a comma. Page headers are already removed.
            if m and (not current or int(m[1])>int(current['originalNumber'])):
                if current:chunks.append(current)
                current={'originalNumber':m[1],'sourcePage':str(page['page']),'lines':[m[2]]}
            elif current:current['lines'].append(line)
    if current:chunks.append(current)
    for chunk in chunks:
        body='\n'.join(chunk.pop('lines'))
        if source['categoryId']=='pre-finals':
            body=re.split(r'GOOD LUCK AND I WISH',body)[0]
            body=body.replace('B. True or False','')
            parts=re.split(r'CORRECT ANSWER:\s*',body,maxsplit=1)
            if len(parts)!=2:raise ValueError(f'Pre-finals missing key {chunk["originalNumber"]}')
            prompt,keypart=parts
            prompt=prompt.replace('decreasese. Both','decreases e. Both')
            keyparts=re.split(r'Why \(Simple Bisaya-English\):\s*',keypart,maxsplit=1)
            key=text(keyparts[0]); explanation=text(keyparts[1]) if len(keyparts)>1 else ''
        else:
            # Explanations can continue across pages and may contain choice-letter discussion.
            split=re.search(r'(?m)^(?:Explanation:|Rationalization:|Solution:|Choice a\.|A time deposit,|A conservative working capital policy|A positive change in net working capital occurs|This statement I|This statement is not true|The opportunity cost|To calculate the net float|Forecasted Inventories)',body)
            prompt=body[:split.start()] if split else body
            explanation=text(body[split.start():]) if split else ''
            key=''
            prompt=re.split(r'(?m)^-NOTHING FOLLOWS-',prompt)[0]
        opts=split_options(prompt)
        first=re.search(r'(?:^|\s)[a-eA-E][.)]\s*(?=\S)',prompt)
        question=text(prompt[:first.start()] if first else prompt)
        q={**chunk,'question':question,'choices':[v for _,v in opts]}
        if explanation:q['explanation']=explanation
        if source['categoryId']=='pre-finals':
            m=re.match(r'^([A-E])[.)]\s*',key)
            if m:letter_key(q,m[1])
            elif key.lower() in ['true','false']:
                q['choices']=['True','False'];q['correctAnswer']=key.title();q['type']='true-false'
            elif 'C and E' in key:
                q['correctAnswer']=[q['choices'][2],q['choices'][4]]
                q['originalAnswerLetter']='C, E';q['verificationStatus']='review-required';q['reviewNote']=key
            elif 'No correct option' in key:
                q['correctAnswer']='A shorter useful life increases annual depreciation and reduces net fixed assets, EBIT and tax payments, other things equal.'
                q['verificationStatus']='review-required';q['reviewNote']=key+'; generated conceptual answer supplied because the source has no valid listed option.'
                q['answerOrigin']='generated';q['sourceAnswer']=key
            else:raise ValueError(f'Cannot resolve prefinal key {chunk["originalNumber"]}: {key}')
        records.append(q)
    return write_bank(source,records,['Question number 10 is absent from the working-capital source; item 13 uses a comma.' ] if source['categoryId']=='working-capital' else [])

for source in sources:
    category=source['categoryId']
    if category=='new-reviewer':new_reviewer(source)
    elif category=='cfms-questionnaire':cfms(source)
    elif category=='huhuhuhu-reviewer':huhu(source)
    elif category in ['pre-finals','working-capital']:pdf_questions(source)

(OUT/'categories.json').write_text(json.dumps(categories,ensure_ascii=False,indent=2),encoding='utf-8')
manifest=json.loads((OUT/'manifest.json').read_text(encoding='utf-8'))
manifest['reports']=reports
for source in manifest['sources']:
    source.update({'extractionReviewed':True,'numberingReviewed':True,'answerKeyReviewed':True})
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
