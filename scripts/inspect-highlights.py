import pathlib, json, re
import pdfplumber
root=pathlib.Path(__file__).resolve().parents[1]
file=pathlib.Path.home()/'Downloads'/'Working Capital Management and Cash Management Answers (1).pdf'
results=[]
with pdfplumber.open(file) as pdf:
    for pagenum,page in enumerate(pdf.pages,1):
        groups={}
        for ch in page.chars:
            color=ch.get('non_stroking_color')
            if isinstance(color,(tuple,list)) and len(color)>=3 and color[0]>.7 and color[1]<.3 and color[2]<.3:
                k=round(ch['top']/3)*3
                groups.setdefault(k,[]).append(ch)
        lines=[{'page':pagenum,'top':y,'text':''.join(c['text'] for c in sorted(chars,key=lambda c:c['x0']))} for y,chars in sorted(groups.items())]
        results.extend(lines)
        print('PAGE',pagenum)
        for line in lines:
            if re.match(r'^[a-dA-D][.)]',line['text'].strip()):print(line['text'])
(root/'seed-output/inspection/working-capital.highlighted-lines.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
