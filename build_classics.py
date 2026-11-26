import json, pathlib, urllib.request, zipfile, io, time
root=pathlib.Path(__file__).resolve().parents[1]; out=root/'assets/books'; out.mkdir(parents=True,exist_ok=True)
books=json.loads((root/'classics.json').read_text()); report={}
for n,title,author in books:
 report[str(n)]={}
 for ext in ('txt','epub','jpg'):
  dest=out/f'{n}.{ext}'
  def valid(data):
   if ext=='jpg': return data.startswith(b'\xff\xd8\xff') and len(data)>1000
   if ext=='epub':
    with zipfile.ZipFile(io.BytesIO(data)) as z: return z.read('mimetype')==b'application/epub+zip'
   return len(data)>3000 and 'PROJECT GUTENBERG' in data[:15000].decode('utf-8-sig').upper()
  try: ok=dest.exists() and valid(dest.read_bytes())
  except Exception: ok=False
  filename=f'pg{n}'+({'jpg':'.cover.medium.jpg','txt':'.txt','epub':'.epub'}[ext]); urls=[f'https://{host}/cache/epub/{n}/{filename}' for host in ('www.gutenberg.org','gutenberg.pglaf.org')]
  if ext=='epub': urls += [f'https://www.gutenberg.org/ebooks/{n}.epub3.images']
  if ext=='txt': urls += [f'https://www.gutenberg.org/ebooks/{n}.txt.utf-8',f'https://www.gutenberg.org/files/{n}/{n}-0.txt']
  for url in urls if not ok else []:
   try:
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'BookVerse public domain library'}),timeout=20) as r: data=r.read(30*1024*1024+1)
    if len(data)>30*1024*1024 or not valid(data): raise ValueError('Invalid file')
    dest.write_bytes(data);ok=True;break
   except Exception as e: print(title,ext,url,e)
  report[str(n)][ext]=bool(ok);time.sleep(.3)
(out/'manifest.json').write_text(json.dumps(report,indent=2));print('Completed:',sum(x['txt'] and x['epub'] for x in report.values()),'/',len(books))
