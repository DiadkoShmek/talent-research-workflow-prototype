"""Check the released phone PDF against the pinned public archive."""

from json import loads
from pathlib import Path

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
archive = loads((ROOT / "data/poolday-public-pass-2026-09-28.json").read_text())
reader = PdfReader(ROOT / "docs/meeting-brief.uk.pdf")
assert len(reader.pages) == 3
assert not reader.is_encrypted
root = reader.trailer["/Root"]
assert not root.get("/OpenAction")
assert not root.get("/AcroForm")
assert not root.get("/Names")

pages = [page.extract_text() for page in reader.pages]
text = "\n".join(pages)
report = archive["report"]
assert "GitHub ID 1629785" in text
assert "поточний GitHub" in text
assert "не схвалює контакт" in text
for lane in report["lanes"]:
    assert lane["repo"] in pages[2], lane["repo"]
for inspection in archive["inspections"]:
    number = inspection["evidenceId"].rsplit(":", 1)[1]
    assert f"PR #{number}" in pages[1]
    for item in inspection["files"]:
        assert item["filename"] in pages[1], item["filename"]

links = []
for page in reader.pages:
    for ref in page.get("/Annots", []):
        annotation = ref.get_object()
        assert annotation.get("/Subtype") == "/Link"
        action = annotation.get("/A")
        assert action and action.get("/S") == "/URI"
        uri = action.get("/URI")
        assert isinstance(uri, str) and uri.startswith("https://")
        links.append(uri)
assert report["role"]["url"] in links
for inspection in archive["inspections"]:
    assert inspection["sourceUrl"] in links
print(f"PDF: {len(pages)} pages, {len(links)} HTTPS links, pinned lanes and files")
