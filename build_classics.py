import json, pathlib, urllib.request, zipfile, io, time
root=pathlib.Path(__file__).resolve().parents[1]; out=root/'assets/books'; out.mkdir(parents=True,exist_ok=True)
for n,title,author in json.loads((root/'classics.json').read_text()):
 for ext,url in [('jpg',f'https://www.gutenberg.org/cache/epub/{n}/pg{n}.cover.medium.jpg'),('txt',f'https://www.gutenberg.org/cache/epub/{n}/pg{n}.txt'),('epub',f'https://www.gutenberg.org/ebooks/{n}.epub3.images')]:
  dest=out/f'{n}.{ext}'
  if dest.exists(): continue
  for attempt in range(3):
   try:
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'BookVerse public domain library (GitHub Actions)'}),timeout=60) as r: data=r.read(25*1024*1024)
    if ext=='jpg':
     assert data.startswith(b'\xff\xd8\xff') and len(data)>1000
    elif ext=='epub':
     with zipfile.ZipFile(io.BytesIO(data)) as z: assert z.read('mimetype')==b'application/epub+zip'
    else:
     t=data.decode('utf-8-sig'); assert 'PROJECT GUTENBERG' in t[:15000].upper() and len(t)>3000
    dest.write_bytes(data); print(title,ext,len(data)); time.sleep(2); break
   except Exception as e:
    if attempt==2 and ext=='jpg':
     print(f'Cover unavailable: {title}: {e}'); break
    if attempt==2: raise RuntimeError(f'{title} {ext}: {e}') from e
    time.sleep(5)
