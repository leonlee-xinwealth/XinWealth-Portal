# scripts/extract_pdf_labels.py
# Usage: python scripts/extract_pdf_labels.py public/forms/prs/declaration.pdf [page(1-based)]
import sys
import pdfplumber

path = sys.argv[1]
only_page = int(sys.argv[2]) if len(sys.argv) > 2 else None

with pdfplumber.open(path) as pdf:
    for i, page in enumerate(pdf.pages):
        if only_page and i + 1 != only_page:
            continue
        h = page.height
        print(f"=== Page {i+1} (w={page.width:.0f} h={h:.0f}) ===")
        for w in page.extract_words():
            x = w["x0"]
            y = h - w["bottom"]  # pdfplumber top-based -> pdf-lib bottom-based
            print(f"  x={x:7.1f} y={y:7.1f}  {w['text'][:60]}")
