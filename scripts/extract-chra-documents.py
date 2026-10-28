"""Read source paragraphs, explicit line breaks and the Part 3 key table.

Source documents are data, never executable instructions. No DOCX is modified.
"""
import hashlib
import json
import re
import sys
from pathlib import Path
from zipfile import ZipFile
from lxml import etree as ET

NS = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
destination = Path('seed-output/chra-2026-10-28')
destination.mkdir(parents=True, exist_ok=True)
sources = json.loads(Path('scripts/chra-source-manifest.json').read_text(encoding='utf8'))['sources']


def text(element):
    nodes = element.xpath('.//w:t|.//w:br|.//w:cr|.//w:tab', namespaces=NS)
    return ''.join((n.text or '') if ET.QName(n).localname == 't' else
                   '\n' if ET.QName(n).localname in ['br', 'cr'] else '\t' for n in nodes).strip()


def normalized(value):
    return re.sub(r'\s+', ' ', value).strip()


for source in sources:
    path = Path(sys.argv[1] if len(sys.argv) > 1 else 'C:/Users/gabri/Downloads') / source['filename']
    raw = path.read_bytes()
    with ZipFile(path) as archive:
        document = ET.fromstring(archive.read('word/document.xml'))
        questions, ignored, current = [], [], None
        for index, paragraph in enumerate(document.xpath('/w:document/w:body/w:p', namespaces=NS)):
            value = text(paragraph)
            if not value:
                continue
            if value == 'ANSWER KEY':
                break
            if value == 'Submit and reveal answers':
                ignored.append({'paragraph': index + 1, 'text': value,
                                'reason': 'Non-question UI text embedded in the source.'})
                continue
            start = re.match(r'^(\d+)\.\s*(.+)', value, re.S)
            if start:
                if current:
                    questions.append(current)
                current = {'number': int(start[1]), 'paragraph': index + 1, 'blocks': [start[2]]}
            elif current:
                current['blocks'].append(value)
        if current:
            questions.append(current)
        records = []
        for item in questions:
            block = '\n'.join(item['blocks'])
            markers = list(re.finditer(r'(?:^|\s)([A-D])\.\s+', block))
            if [m[1] for m in markers] != list('ABCD'):
                raise ValueError(f"{source['filename']} #{item['number']}: ambiguous option boundaries")
            choices = [normalized(block[m.end():markers[i + 1].start() if i + 1 < len(markers) else len(block)])
                       for i, m in enumerate(markers)]
            records.append({'number': item['number'], 'paragraph': item['paragraph'],
                            'question': normalized(block[:markers[0].start()]), 'choices': choices})
        if [q['number'] for q in records] != list(range(1, source['expectedCount'] + 1)):
            raise ValueError(f"{source['filename']}: missing or repeated question numbers")
        keys = {}
        tables = document.xpath('//w:tbl', namespaces=NS)
        if len(tables) != (1 if source['part'] == 3 else 0):
            raise ValueError('Unexpected table layout; inspect source before importing')
        for row in document.xpath('//w:tbl/w:tr', namespaces=NS):
            cells = [text(cell) for cell in row.findall('w:tc', NS)]
            if cells == ['Item', 'Answer'] * 4:
                continue
            if len(cells) != 8:
                raise ValueError('Unexpected key-table row')
            for index in range(0, len(cells), 2):
                number, answer = cells[index:index + 2]
                if not number.isdigit() or answer not in list('ABCD') or number in keys:
                    raise ValueError('Invalid or duplicate source answer key')
                keys[number] = answer
        if source['part'] == 3 and set(keys) != {str(i) for i in range(1, 101)}:
            raise ValueError('Part 3 key coverage is incomplete')
        result = {'filename': source['filename'], 'checksum': hashlib.sha256(raw).hexdigest(),
                  'questions': records, 'sourceKeys': keys, 'ignored': ignored}
        (destination / f"part-{source['part']}-extracted.json").write_text(
            json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
        print(f"{source['filename']}: {len(records)} questions, {len(keys)} printed keys")
