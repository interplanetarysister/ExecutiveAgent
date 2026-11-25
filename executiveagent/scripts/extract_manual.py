import sys
import os
from pdfminer.high_level import extract_text

# Paths (relative to project root)
PDF_PATH = os.path.join(os.path.dirname(__file__), '..', '.user_uploaded', 'media_1795499294792_757f9501.pdf')
OUTPUT_TEXT = os.path.join(os.path.dirname(__file__), '..', 'manual.txt')

if not os.path.isfile(PDF_PATH):
    print(f"Error: PDF not found at {PDF_PATH}")
    sys.exit(1)

text = extract_text(PDF_PATH)
with open(OUTPUT_TEXT, 'w', encoding='utf-8') as f:
    f.write(text)

print(f"Extracted text written to {OUTPUT_TEXT}")
