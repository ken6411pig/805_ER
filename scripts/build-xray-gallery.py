"""Sync the selected offline gallery into the static GitHub Pages site.
Run manually after changing the local selection. No network calls are made.
"""
from pathlib import Path
import hashlib
import html
import json
import shutil

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "local-xray-gallery"
DESTINATION = ROOT / "pages/tools/xray-gallery"


def main():
    manifest = json.loads((SOURCE / "selected-gallery.json").read_text(encoding="utf-8"))
    items = manifest["items"]
    for item in items:
        image = (SOURCE / item["image"]).resolve()
        if not image.is_relative_to((SOURCE / "images").resolve()):
            raise ValueError(f"Image outside gallery: {item['id']}")
        if hashlib.sha256(image.read_bytes()).hexdigest() != item["imageSha256"]:
            raise ValueError(f"Image changed: {item['id']}")
    DESTINATION.mkdir(parents=True, exist_ok=True)
    for name in ["index.html", "gallery.css", "gallery.js", "gallery-state.js", "display-data.js", "selected-gallery.json"]:
        shutil.copy2(SOURCE / name, DESTINATION / name)
    for item in items:
        destination = DESTINATION / item["image"]
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(SOURCE / item["image"], destination)

    page = (DESTINATION / "index.html").read_text(encoding="utf-8")
    page = page.replace("正常 X 光離線圖庫", "正常 X 光圖庫")
    page = page.replace('<div class="gallery-toolbar">', '<div class="gallery-toolbar"><nav class="gallery-links" aria-label="圖庫導覽"><a href="../../../index.html">805_ER</a><a href="sources.html">圖片來源</a></nav>', 1)
    (DESTINATION / "index.html").write_text(page, encoding="utf-8")
    with (DESTINATION / "gallery.css").open("a", encoding="utf-8") as stream:
        stream.write("\n.gallery-toolbar{justify-content:space-between;align-items:center;gap:16px}.gallery-links{display:flex;gap:18px;font-size:13px}.gallery-links a{color:#cfd8de;text-decoration:none}.gallery-links a:hover{text-decoration:underline}.gallery-links a:focus-visible{outline:2px solid #dde5e9;outline-offset:4px}\n")

    escape = lambda value: html.escape(str(value), quote=True)
    hidden = set(manifest["hiddenIds"])
    rows = []
    for item in items:
        licence = ''
        if item.get("rightsUrl"):
            licence = f'<a href="{escape(item["rightsUrl"])}">使用條款</a>'
        if item["source"] == "Radiopaedia":
            licence = f'<a href="{escape(item["rightsUrl"])}">CC BY-NC-SA 3.0</a>'
        status = '預設隱藏' if item['id'] in hidden else '顯示'
        note = ''
        if item.get('sourceView'):
            note = '<small>圖庫名稱依使用者指定；原來源投照標籤：'+escape(item['sourceView'])+'</small>'
        rows.append(f'<tr><td><a href="{escape(item["image"])}">{escape(item["title"])}</a>{note}</td><td>{escape(item.get("author",item["source"]))}</td><td><a href="{escape(item["sourcePage"])}">{escape(item["source"])}</a><br>{licence}</td><td>{status}</td></tr>')
    credits = '''<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>圖片來源｜正常 X 光圖庫</title><style>body{margin:0;background:#0b0e11;color:#e3e9ef;font:15px/1.7 system-ui,sans-serif}main{max-width:1200px;margin:auto;padding:24px}a{color:#a9ccef}h1{font-size:24px}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse}th,td{text-align:left;vertical-align:top;padding:13px;border-bottom:1px solid #303841}th{white-space:nowrap}small{display:block;color:#acb8c3;margin-top:6px}p{color:#b9c5cf}</style></head><body><main><a href="index.html">返回圖庫</a><h1>圖片來源</h1><p>圖片版權屬各原作者；個別圖片的使用條件請參閱來源網站。圖檔保留原始標示與浮水印，未進行影像增強。部分雙狀態圖片以 CSS 顯示標示區域，原始檔案保持完整。</p><div class="table-wrap"><table><thead><tr><th>圖庫標題</th><th>作者</th><th>來源與使用條件</th><th>顯示設定</th></tr></thead><tbody>'''+''.join(rows)+'''</tbody></table></div></main></body></html>'''
    (DESTINATION / "sources.html").write_text(credits, encoding="utf-8")
    readme = """# Normal X-ray gallery

Open `index.html` directly or use the 正常 X 光圖庫 link in the 805_ER sidebar.
The gallery keeps English titles, head-to-foot ordering, full-size viewing, zoom,
and the browser-local hide/restore menu. The default selection shows {visible}
images, with {hidden} previously removed images hidden and recoverable.

`sources.html` lists every image's author and source. `selected-gallery.json`
preserves provenance, original file hashes, source notes, and the saved selection.
Image rights remain with their respective authors; the site code does not grant
additional image reuse rights. The RAO display title for Candidate A is a user
label; the original source's Oblique label remains recorded in its metadata.

To refresh from the personal offline gallery, run:

```sh
python scripts/build-xray-gallery.py
```

This requires the local, Git-ignored `local-xray-gallery` source folder.
It copies only selected gallery assets and metadata; research downloads,
unselected candidates, selection exports, and backups remain local.
""".format(visible=manifest['visibleCount'], hidden=len(hidden))
    (DESTINATION / "README.md").write_text(readme, encoding="utf-8")
    print(f"Built gallery: {manifest['visibleCount']} visible, {len(items)} preserved images.")


if __name__ == "__main__":
    main()
