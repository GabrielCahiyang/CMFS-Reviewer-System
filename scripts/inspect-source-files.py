import json, pathlib, zipfile, sys, xml.etree.ElementTree as ET
import pdfplumber
from pypdf import PdfReader

root = pathlib.Path(__file__).resolve().parents[1]
out = root / 'seed-output' / 'inspection'
out.mkdir(parents=True, exist_ok=True)
manifest = json.loads((root / 'scripts/source-manifest.json').read_text(encoding='utf-8'))
for source in manifest['sources']:
    source_dir = pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else pathlib.Path.home()/'Downloads'
    file = source_dir / source['filename']
    category = source['categoryId']
    if file.suffix == '.pdf':
        pdf = pdfplumber.open(file)
        reader = PdfReader(file)
        pages = []
        for i, page in enumerate(pdf.pages):
            annotations = [dict(a.get_object()) for a in reader.pages[i].get('/Annots', [])]
            pages.append({'page': i + 1, 'text': page.extract_text(layout=False) or '',
                          'annotations': annotations})
            if source.get('highlightedAnswers'):
                page.to_image(resolution=110).save(out / f'{category}-page-{i+1}.png')
        (out / f'{category}.txt').write_text('\n'.join(f'\n--- PAGE {p["page"]} ---\n{p["text"]}' for p in pages), encoding='utf-8')
        (out / f'{category}.pages.json').write_text(json.dumps(pages, ensure_ascii=False, indent=2, default=str), encoding='utf-8')
        print(f'{category}: {len(pdf.pages)} PDF pages; {sum(len(p["annotations"]) for p in pages)} annotations')
        pdf.close()
    else:
        ns = {'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
        with zipfile.ZipFile(file) as z:
            doc = ET.fromstring(z.read('word/document.xml'))
            paragraphs = []
            for p in doc.findall('.//w:body//w:p', ns):
                text = ''.join((t.text or '') if t.tag == '{'+ns['w']+'}t' else '\n' if t.tag == '{'+ns['w']+'}br' else '\t' if t.tag == '{'+ns['w']+'}tab' else '' for t in p.iter())
                num = p.find('w:pPr/w:numPr/w:numId',ns)
                level = p.find('w:pPr/w:numPr/w:ilvl',ns)
                paragraphs.append({'text':text,'numId':num.attrib.get('{'+ns['w']+'}val') if num is not None else None,
                                   'level':level.attrib.get('{'+ns['w']+'}val') if level is not None else None,
                                   'xml':ET.tostring(p,encoding='unicode')})
            (out / f'{category}.paragraphs.json').write_text(json.dumps(paragraphs,ensure_ascii=False,indent=2),encoding='utf-8')
            (out / f'{category}.txt').write_text('\n'.join(p['text'] for p in paragraphs),encoding='utf-8')
            for name in ['word/numbering.xml','word/styles.xml']:
                if name in z.namelist():
                    (out / f'{category}.{pathlib.Path(name).name}').write_bytes(z.read(name))
            print(f'{category}: {len(paragraphs)} DOCX paragraphs')
