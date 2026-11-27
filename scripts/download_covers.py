import json, io, time, unicodedata, re
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.parse import urlencode
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
def get(url):
    for i in range(3):
        try:
            with urlopen(Request(url,headers={'User-Agent':'BookVerse reading club cover cache (GitHub Actions)'}),timeout=20) as r: return r.read(8_000_000)
        except Exception:
            if i==2: raise
            time.sleep(3*(i+1))
def norm(s): return re.sub('[^a-z0-9]','',unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower())
def save(url,p):
    try:
        with Image.open(io.BytesIO(get(url))) as im:
            if min(im.size)<60: return False
            im=im.convert('RGB'); im.thumbnail((500,750)); p.parent.mkdir(parents=True,exist_ok=True); im.save(p,'JPEG',quality=82,optimize=True)
        return True
    except Exception: return False
rows=json.loads((ROOT/'scripts/cover_catalog.json').read_text()); missing=[]
for b in rows:
    p=ROOT/b['path']; ok=False
    if p.exists():
        try:
            with Image.open(p) as im: ok=min(im.size)>=60; im.verify()
        except Exception: ok=False
    if not ok and b['isbn']: ok=save(f"https://covers.openlibrary.org/b/isbn/{b['isbn']}-M.jpg?default=false",p)
    if not ok:
        try:
            q=urlencode(dict(title=b['title'],author=b['author'],fields='title,author_name,cover_i',limit=10)); docs=json.loads(get('https://openlibrary.org/search.json?'+q)).get('docs',[])
            for d in docs:
                if d.get('cover_i') and norm(d.get('title',''))==norm(b['title']) and any(norm(a)==norm(b['author']) for a in d.get('author_name',[])):
                    if save(f"https://covers.openlibrary.org/b/id/{d['cover_i']}-M.jpg?default=false",p): ok=True; break
        except Exception: pass
    print(('OK ' if ok else 'MISSING ')+b['path']+' '+b['title'],flush=True)
    if not ok: missing.append(b['title'])
    time.sleep(1.2)
report=f'Available: {len(rows)-len(missing)}/{len(rows)}\nMissing:\n'+'\n'.join(missing)
print(report); (ROOT/'cover-download-report.txt').write_text(report)
