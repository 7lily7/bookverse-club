import json
import time
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "books"
OUT.mkdir(parents=True, exist_ok=True)

books = json.loads(
    (ROOT / "classics.json").read_text(encoding="utf-8")
)

def download(url, path):
    if path.exists() and path.stat().st_size > 1000:
        return True

    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "BookVerseLibrary/1.0"}
        )

        with urllib.request.urlopen(req, timeout=60) as response:
            data = response.read()

        if len(data) < 1000:
            return False

        if b"<html" in data[:500].lower():
            return False

        if path.suffix == ".epub":
            import io
            if not zipfile.is_zipfile(io.BytesIO(data)):
                return False

        if path.suffix == ".jpg":
            if not data.startswith(b"\xff\xd8"):
                return False

        path.write_bytes(data)
        print(f"Saved: {path.name}")
        return True

    except Exception as error:
        print(f"Failed: {url}: {error}")
        return False

complete = 0

for book_id, title, author in books:
    print(f"\nProcessing: {title}")

    base = (
        "https://www.gutenberg.org/cache/epub/"
        f"{book_id}"
    )

    epub = download(
        f"{base}/pg{book_id}.epub",
        OUT / f"{book_id}.epub"
    )

    txt = download(
        f"{base}/pg{book_id}.txt",
        OUT / f"{book_id}.txt"
    )

    download(
        f"{base}/pg{book_id}.cover.medium.jpg",
        OUT / f"{book_id}.jpg"
    )

    if epub and txt:
        complete += 1

    time.sleep(2)

print(f"\nCompleted: {complete}/{len(books)} books")

if complete == 0:
    raise SystemExit("No books downloaded successfully.")
