import sys, json, re, hashlib
from pathlib import Path
import pdfplumber
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'seed-output/replacement-2026-10-26'
OUT.mkdir(parents=True,exist_ok=True)
source_dir=Path(sys.argv[1])
config=json.loads((ROOT/'scripts/source-manifest.json').read_text(encoding='utf8'))
ordered=sorted(config['sources']+config['duplicateSources'],key=lambda s:s['sourceIndex'])
SOURCES=[]
for source in ordered:
 i=source['sourceIndex'];path=source_dir/source['filename'];ps=[]
 with pdfplumber.open(path) as pdf:
  for n,page in enumerate(pdf.pages,1):
   value=page.extract_text() or ''
   if i==2:
    value='\n'.join(page.crop(box).extract_text() or '' for box in [(0,0,page.width/2,page.height),(page.width/2,0,page.width,page.height)])
   ps.append({'page':n,'text':value})
 (OUT/f'source-{i}{"-columns" if i==2 else ""}.json').write_text(json.dumps(ps,ensure_ascii=False,indent=2),encoding='utf8')
 SOURCES.append({'index':i,'filename':source['filename'],'path':str(path),'checksum':hashlib.sha256(path.read_bytes()).hexdigest(),'pages':len(ps)})
 if i==7:
  keys={};current=None
  with pdfplumber.open(path) as pdf:
   for n,page in enumerate(pdf.pages,1):
    for line in page.extract_text_lines():
     value=line['text'].strip();m=re.match(r'^(\d{1,2})[.,]\s+',value)
     if m:current=m[1]
     option=re.match(r'^([a-d])[.)]',value,re.I)
     if option and current:
      red=[c for c in line['chars'] if isinstance(c.get('non_stroking_color'),(tuple,list)) and len(c['non_stroking_color'])>=3 and c['non_stroking_color'][0]>.7 and c['non_stroking_color'][1]<.3 and c['non_stroking_color'][2]<.3]
      if len(red)>2:keys.setdefault(current,[]).append({'letter':option[1].upper(),'page':n,'text':value})
  (OUT/'working-highlight-keys.json').write_text(json.dumps(keys,indent=2),encoding='utf8')
(OUT/'sources.json').write_text(json.dumps(SOURCES,ensure_ascii=False,indent=2),encoding='utf8')
def norm(x):return re.sub(r'\s+',' ',x).strip()
def pages(i):return json.loads((OUT/f'source-{i}{"-columns" if i==2 else ""}.json').read_text(encoding='utf8'))
def split_chunks(ps,stop=None):
 chunks=[];current=None
 for p in ps:
  for line in p['text'].splitlines():
   line=line.strip()
   if stop and stop(line):
    if current:chunks.append(current)
    return chunks
   if re.match(r'^(lOMoAR|Downloaded by|\d+\s*\|\s*Page)',line):continue
   m=re.match(r'^(\d{1,4}(?:-\d+)?)\s*(?:\.(?!\d)\s*|,\s+)(\S.*)',line)
   if m:
    if current:chunks.append(current)
    current={'originalNumber':m[1],'sourcePage':str(p['page']),'lines':[m[2]]}
   elif current:current['lines'].append(line)
 if current:chunks.append(current)
 return chunks

def options(body):
 # Source six runs several inline choice letters directly into the previous word.
 body=re.sub(r'(?<=[a-z])([c-e])\. (?=(?:Both|have no impact|Maximizing))',r' \1. ',body)
 matches=list(re.finditer(r'(?:^|\s)([a-eA-E])[.)]\s*(?=\S)',body))
 prompt=norm(body[:matches[0].start()] if matches else body)
 opts=[(m[1].upper(),norm(body[m.end():matches[i+1].start() if i+1<len(matches) else len(body)]))for i,m in enumerate(matches)]
 return prompt,opts

def parse_standard(i,count):
 ps=pages(i);question_pages={1:15,2:5,3:19,4:19,5:15}[i]
 chunks=split_chunks([p for p in ps if p['page']<=question_pages])
 keys={}
 for p in ps:
  if p['page']>question_pages and (i!=2 or p['page']==6):
   for m in re.finditer(r'(?:^|\s)(\d{1,3})\.\s*([A-Ea-e])(?=[.)\s]|$)',p['text']):
    n=int(m[1]);assert n not in keys,(i,'duplicate key',n);keys[n]=m[2].upper()
 assert len(chunks)==count,(i,'questions',len(chunks),[c['originalNumber'] for c in chunks])
 assert sorted(keys)==list(range(1,count+1)),(i,'keys',len(keys),sorted(keys))
 records=[]
 for n,chunk in enumerate(chunks,1):
  body='\n'.join(chunk.pop('lines'));prompt,opts=options(body)
  assert [a for a,v in opts]==list('ABCDE')[:len(opts)],(i,n,'options',opts)
  assert 2<=len(opts)<=5,(i,n,'choice count',opts)
  assert keys[n] in [a for a,v in opts],(i,n,'missing key')
  correct=dict(opts)[keys[n]]
  records.append({**chunk,'question':prompt,'choices':[v for a,v in opts],'correctAnswer':correct,'originalAnswerLetter':keys[n],'answerOrigin':'source-key','sourceAnswer':keys[n],'type':'true-false' if [v.lower()for a,v in opts]==['true','false'] else 'multiple-choice'})
 return records
banks={}
for i,n in [(1,100),(2,60),(3,121),(4,121),(5,120)]:
 banks[i]=parse_standard(i,n)
 print('PARSED',i,len(banks[i]))
# Compare canonical records, allowing only the observed PDF hyphen line-wrap difference.
for n,(a,b)in enumerate(zip(banks[3],banks[4]),1):
 def comparable(q):return json.dumps(q,sort_keys=True).replace('long- term','long-term')
 assert comparable(a)==comparable(b),('Duplicate differs',n,a,b)
print('DUPLICATE',len(banks[4]),'matching question/choice/key records')
# Recover the supplied explanatory prose in the same column order. It is never
# used to guess or overwrite an answer letter from the dedicated key table.
explanations='\n'.join(p['text'] for p in pages(2) if p['page']>=7)
blocks=list(re.finditer(r'(?m)^(\d+)\.\s*(?:The correct answer is:|(?=What does the yield|If a bond|The current yield|A bond with|The yield to call))',explanations))
assert len(blocks)==60,('Reviewer 2 explanation coverage',len(blocks))
for n,m in enumerate(blocks):
 body=explanations[m.end():blocks[n+1].start() if n+1<len(blocks) else len(explanations)].strip()
 q=banks[2][int(m[1])-1]
 if int(m[1])<=55:
  letter=re.match(r'([a-dA-D])[.)]',body)
  assert letter and letter[1].upper()==q['originalAnswerLetter'],('Explanation/key conflict',m[1],body)
 else:
  letter=re.search(r'(?m)^Answer:\s*([a-dA-D])[.)]',body)
  if int(m[1])==59:letter=re.search(r'(?m)^([a-dA-D])[.)]',body)
  assert letter and letter[1].upper()==q['originalAnswerLetter'],('Explanation/key conflict',m[1],body)
 q['explanation']=norm(body)
# Inline answer/explanation PDF.
records=[]
for c in split_chunks(pages(6)):
 body='\n'.join(c.pop('lines'));body=re.split(r'GOOD LUCK AND I WISH',body)[0]
 body=body.replace('B. True or False','')
 assert 'CORRECT ANSWER:' in body,(c,body)
 p,k=re.split(r'CORRECT ANSWER:\s*',body,maxsplit=1)
 key,why=re.split(r'Why \(Simple Bisaya-English\):\s*',k,maxsplit=1)
 prompt,opts=options(p);key=norm(key)
 if key in ['True','False']:
  opts=[('A','True'),('B','False')];letters=['A'if key=='True'else'B']
 elif re.match(r'^([A-E])\.',key):letters=[key[0]]
 elif 'C and E'in key:letters=['C','E']
 elif 'No correct option'in key:
  opts.append(('F',key));letters=['F']
 else:raise Exception(('Unparsed key',c,key))
 assert [a for a,v in opts]==list('ABCDEF')[:len(opts)],('Prefinals options',c,opts)
 answers=[dict(opts)[l]for l in letters]
 records.append({**c,'question':prompt,'choices':[v for a,v in opts],'correctAnswer':answers[0]if len(answers)==1 else answers,
  'originalAnswerLetter':', '.join(letters),'sourceAnswer':key,'explanation':norm(why),'answerOrigin':'source-key','type':'true-false'if[v.lower()for a,v in opts]==['true','false']else'multiple-choice'})
assert len(records)==85,len(records)
banks[6]=records
print('PARSED',6,len(records))
# Color-marked answer PDF.
keys=json.loads((OUT/'working-highlight-keys.json').read_text(encoding='utf8'));records=[]
for c in split_chunks(pages(7)):
 body='\n'.join(c.pop('lines'));body=re.split(r'(?m)^-NOTHING FOLLOWS-',body)[0]
 mark=re.search(r'(?m)^(?:Explanation:|Rationalization:|Solution:|Choice a\.|A time deposit,|A conservative working capital policy|A positive change in net working capital occurs|This statement I|This statement is not true|The opportunity cost|To calculate the net float|Forecasted Inventories)',body)
 promptpart=body[:mark.start()]if mark else body;why=norm(body[mark.start():])if mark else''
 prompt,opts=options(promptpart)
 assert [a for a,v in opts]==list('ABCD'),('Working options',c,opts)
 letters=[k['letter']for k in keys[c['originalNumber']]]
 answers=[dict(opts)[l]for l in letters]
 records.append({**c,'question':prompt,'choices':[v for a,v in opts],'correctAnswer':answers[0]if len(answers)==1 else answers,
  'originalAnswerLetter':', '.join(letters),'sourceAnswer':', '.join(letters),'answerOrigin':'source-highlight','explanation':why,'type':'multiple-choice'})
assert len(records)==39,len(records)
assert set(keys)=={q['originalNumber']for q in records}
banks[7]=records
for i,rs in banks.items():
 for q in rs:
  q.update({'topic':{1:'Financial Management',2:'Financial Management Concepts',3:'Financial Management Applications',4:'Financial Management Applications',5:'Financial Management Practice',6:'Pre-Finals Review',7:'Working Capital and Cash Management'}[i],'sourceDocument':SOURCES[i-1]['filename'],'derived':False,'verificationStatus':'verified'if isinstance(q['correctAnswer'],str)else'review-required'})
 (OUT/f'bank-{i}.json').write_text(json.dumps(rs,ensure_ascii=False,indent=2),encoding='utf8')
 (OUT/f'read-{i}.txt').write_text('\n\n'.join(f'{q["originalNumber"]} [p.{q["sourcePage"]}] {q["question"]}\n'+ ' | '.join(f'{chr(65+n)}. {v}'for n,v in enumerate(q['choices']))+f'\nKEY {q["originalAnswerLetter"]}: {q["correctAnswer"]}'for q in rs),encoding='utf8')
print('TOTAL UNIQUE',sum(len(v)for i,v in banks.items()if i!=4))



