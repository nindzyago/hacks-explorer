#!/usr/bin/env python3
"""Inline the icon sheets into index.html so the prototype is one self-contained file.

Usage: python3 -I build.py <out.html>
"""
import base64, pathlib, sys

here = pathlib.Path(__file__).parent
html = (here / 'index.html').read_text(encoding='utf-8')
for name in ('sheet-a', 'sheet-b', 'sheet-c'):
    ref = f'assets/{name}.jpg'
    if ref not in html:
        sys.exit(f'{ref} is not referenced in index.html')
    data = base64.b64encode((here / ref).read_bytes()).decode()
    html = html.replace(ref, f'data:image/jpeg;base64,{data}')
pathlib.Path(sys.argv[1]).write_text(html, encoding='utf-8')
print(sys.argv[1], len(html))
