
import json
import time
import io
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "books"
OUT.mkdir(parents=True, exist_ok=True)

books = json.loads(
    (ROOT / "classics.json").read_text(encoding="utf-8")
)

SOURCES = [
    "https://www.gutenberg.org/cache/epub",
    "https://gutenberg.pglaf.org/cache/epub",
    "https://www.gutenberg.org/ebooks"
]

def download(urls, path):
    if path.exists() and path.stat().st_size > 1000:
        return True

    for url in urls:
        try:
            print(f"Trying: {url}")

            req = urllib.request.Request(
                url,
                headers={
                    "User-Agent": "BookVerseLibrary/1.0"
                }
            )

            with urllib.request.urlopen(
                req, timeout=30
            ) as response:
                data = response.read()

            if len(data) < 1000:
                continue

            if b"<html" in data[:1000].lower():
                continue

            if path.suffix == ".epub":
                if not zipfile.is_zipfile(
                    io.BytesIO(data)
                ):
                    continue

            if path.suffix == ".jpg":
                if not data.startswith(b"\xff\xd8"):
                    continue

            path.write_bytes(data)
            print(f"Saved: {path.name}")
            return True

        except Exception as error:
            print(f"Failed: {error}")

    return False

complete = 0

for n, title, author in books:
    print(f"\nProcessing: {title}")

    epub_urls = [
        f"{s}/{n}/pg{n}.epub"
        for s in SOURCES[:2]
    ] + [
        f"{SOURCES[2]}/{n}.epub3.images",
        f"{SOURCES[2]}/{n}.epub.images"
    ]

    txt_urls = [
        f"{s}/{n}/pg{n}.txt"
        for s in SOURCES[:2]
    ] + [
        f"{SOURCES[2]}/{n}.txt.utf-8"
    ]

    cover_urls = [
        f"{s}/{n}/pg{n}.cover.medium.jpg"
        for s in SOURCES[:2]
    ]

    epub = download(
        epub_urls, OUT / f"{n}.epub"
    )

    txt = download(
        txt_urls, OUT / f"{n}.txt"
    )

    download(
        cover_urls, OUT / f"{n}.jpg"
    )

    if epub and txt:
        complete += 1

    time.sleep(2)

print(f"\nCompleted: {complete}/{len(books)} books")

if complete == 0:
    raise SystemExit("All download sources failed.")
