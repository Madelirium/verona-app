"""Read official pharmacy tables; stdout is machine-readable JSON, no PDF is modified."""
import json
import sys
import pdfplumber

with pdfplumber.open(sys.argv[1]) as document:
    print(json.dumps({"text": "\n".join(page.extract_text() or "" for page in document.pages),
                      "tables": [table for page in document.pages for table in page.extract_tables()]}, ensure_ascii=False))
