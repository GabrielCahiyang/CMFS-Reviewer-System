import pathlib, json, re, sys
import pdfplumber
root=pathlib.Path(__file__).resolve().parents[1]
source_dir=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else pathlib.Path.home()/'Downloads'
file=source_dir/'Working Capital Management and Cash Management Answers (1).pdf'
keys={}; current=None
with pdfplumber.open(file) as pdf:
 for page in pdf.pages:
    for line in page.extract_text_lines():
        value=line['text'].strip()
        q=re.match(r'^(\d{1,2})[.,]\s+',value)
        if q:current=q[1]
        option=re.match(r'^([a-d])[.)]',value,re.I)
        if option and current:
            colored=[c for c in line['chars'] if isinstance(c.get('non_stroking_color'),(tuple,list)) and len(c['non_stroking_color'])>=3 and c['non_stroking_color'][0]>.7 and c['non_stroking_color'][1]<.3 and c['non_stroking_color'][2]<.3]
            if len(colored)>2:keys.setdefault(current,[]).append(option[1].upper())
(root/'seed-output/inspection/working-capital.highlight-keys.json').write_text(json.dumps(keys,indent=2),encoding='utf-8')
print(json.dumps(keys))
