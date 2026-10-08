"""Re-extract the official 24-page PDF without the personal contact-name column.

Requires pdfplumber. Run with --check for a read-only exact comparison; --write
explicitly regenerates the public extract. The source SHA and serials are fixed.
"""
import hashlib
import json
import pathlib
import sys
import pdfplumber

root = pathlib.Path(__file__).resolve().parent.parent
pdf = root / 'raw/ntpc-home-care-1151007.pdf'
out = root / 'raw/ntpc-home-care-366-public-extract.json'
if sys.argv[1:] not in [['--check'], ['--write']]:
    raise SystemExit('Use --check or --write explicitly.')
if hashlib.sha256(pdf.read_bytes()).hexdigest() != 'dcb780dfe853f176849b366436c8cc3ac742b289759c0a8ec68106854e64cdef':
    raise SystemExit('Official PDF bytes differ; re-review a new source before changing this baseline.')
rows = []
with pdfplumber.open(pdf) as doc:
    if len(doc.pages) != 24:
        raise SystemExit('Expected 24 source pages.')
    for page_index, page in enumerate(doc.pages, 1):
        for table in page.extract_tables():
            for row in table:
                if not row[0] or not row[0].strip().isdigit():
                    continue
                if len(row) != 10 or any(row[i] is None for i in [1, 2, 4, 5, 6, 9]):
                    raise SystemExit(f'Malformed source row on page {page_index}.')
                rows.append(dict(serial=int(row[0]), name=row[1], address=row[2],
                                 phone=row[4], signedAt=row[5], homeCare=row[6],
                                 respite=row[7], shortCare=row[8], serviceAreas=row[9],
                                 page=page_index))
if [x['serial'] for x in rows] != list(range(1, 367)):
    raise SystemExit('Serials 1..366 must appear exactly once in source order.')
text = json.dumps(rows, ensure_ascii=False, indent=2) + '\n'
if sys.argv[1] == '--write':
    out.write_text(text)
elif out.read_text() != text:
    raise SystemExit('Tracked public extract differs from actual PDF tables.')
print('PASS: 366 source rows re-extracted exactly; personal contact-name column omitted.')
