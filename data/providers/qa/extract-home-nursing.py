"""Reproduce both official home-nursing rosters; --check is read-only.
Requires pdfplumber. Public institution data only; never a service-area claim.
"""
import hashlib, json, pathlib, sys
import pdfplumber
ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCES = [('taipei-home-nursing-1150901.pdf', '臺北市', 51), ('ntpc-home-nursing-1151006.pdf', '新北市', 96)]
def extract():
    rows = []
    for filename, city, count in SOURCES:
        current = []
        with pdfplumber.open(ROOT / 'raw' / filename) as doc:
            for page_index, page in enumerate(doc.pages, 1):
                for table in page.extract_tables():
                    for row in table:
                        if not row[0] or not row[0].strip().isdigit(): continue
                        if len(row) != 4 or not row[1] or not row[2]:
                            raise ValueError(f'Malformed source row: {filename}/{page_index}')
                        current.append(dict(city=city, serial=int(row[0]), name=row[1], address=row[2], phone=row[3] or '', page=page_index))
        if [r['serial'] for r in current] != list(range(1, count + 1)):
            raise ValueError(f'Incomplete official source: {filename}')
        rows.extend(current)
    return rows
if __name__ == '__main__':
    if sys.argv[1:] not in [['--write'], ['--check']]: raise SystemExit('Use --write or --check.')
    target = ROOT / 'raw/home-nursing-147-public-extract.json'
    text = json.dumps(extract(), ensure_ascii=False, indent=2) + '\n'
    if sys.argv[1] == '--write': target.write_text(text)
    elif target.read_text() != text: raise SystemExit('Extract differs from official PDF tables.')
    print('PASS: 51 Taipei + 96 New Taipei source rows reproduced exactly.')
