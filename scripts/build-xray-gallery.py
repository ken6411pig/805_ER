"""Build lightweight gallery previews from the selected offline collection."""
from pathlib import Path
from io import BytesIO
import hashlib
import html
import json
import re
import shutil
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "local-xray-gallery"
DESTINATION = ROOT / "pages/tools/xray-gallery"
VERSION = "thumbnails-20261008"
PREVIEW_SIZE = (480, 480)


def make_thumbnail(item):
    with Image.open(SOURCE / item["image"]) as original:
        preview = ImageOps.exif_transpose(original)
        # Match the labelled half already displayed by the gallery's sprite CSS.
        if item.get("sprite"):
            preview = preview.crop((preview.width // 2, 0, preview.width, preview.height))
        if preview.mode not in ("RGB", "RGBA"):
            preview = preview.convert("RGB")
        preview.thumbnail(PREVIEW_SIZE, Image.Resampling.LANCZOS)
        output = BytesIO()
        preview.save(output, format="WEBP", quality=80, method=6)
        content = output.getvalue()
        digest = hashlib.sha256(content).hexdigest()
        item["thumbnail"] = f"thumbnails/{item['id']}-{digest[:10]}.webp"
        item["thumbnailSize"] = list(preview.size)
        item["thumbnailSha256"] = digest
        item["thumbnailBytes"] = len(content)
        destination = DESTINATION / item["thumbnail"]
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(content)


def make_cards(items, hidden):
    escape = lambda value: html.escape(str(value), quote=True)
    cards = []
    visible_index = 0
    for index, item in enumerate(items):
        identity, title = escape(item["id"]), escape(item["title"])
        is_hidden = item["id"] in hidden
        hidden_attribute = " hidden" if is_hidden else ""
        loading = "eager" if not is_hidden and visible_index < 4 else "lazy"
        priority = ' fetchpriority="high"' if not is_hidden and visible_index == 0 else ""
        if not is_hidden:
            visible_index += 1
        width, height = item["thumbnailSize"]
        ratio = item["displaySize"][0] / item["displaySize"][1]
        cards.append(f'<article class="tile" data-image-id="{identity}"{hidden_attribute}><label class="pick-control"><input type="checkbox" data-remove-id="{identity}" aria-label="移除 {title}"><span class="sr-only">移除 {title}</span></label><a class="tile-open" href="{escape(item["image"])}" target="_blank" rel="noopener" data-index="{index}" data-image-id="{identity}" aria-label="{title}"><span class="tile-image"><span class="radiograph" style="--ratio:{ratio:.9f}"><img src="{escape(item["thumbnail"])}" width="{width}" height="{height}" alt="{title}" loading="{loading}" decoding="async"{priority}></span></span><span class="tile-title" lang="en">{title}</span></a></article>')
    return '\n'.join(cards)


def main():
    manifest = json.loads((SOURCE / "selected-gallery.json").read_text(encoding="utf-8"))
    items = manifest["items"]
    hidden = set(manifest["hiddenIds"])
    for item in items:
        image = (SOURCE / item["image"]).resolve()
        if not image.is_relative_to((SOURCE / "images").resolve()):
            raise ValueError(f"Image outside gallery: {item['id']}")
        if hashlib.sha256(image.read_bytes()).hexdigest() != item["imageSha256"]:
            raise ValueError(f"Image changed: {item['id']}")
    DESTINATION.mkdir(parents=True, exist_ok=True)
    for item in items:
        destination = DESTINATION / item["image"]
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(SOURCE / item["image"], destination)
        make_thumbnail(item)

    # Runtime JS/CSS are maintained in the tracked website directory.
    page = (SOURCE / "index.html").read_text(encoding="utf-8")
    page = page.replace("正常 X 光離線圖庫", "正常 X 光圖庫")
    page = page.replace('<div class="gallery-toolbar">', '<div class="gallery-toolbar"><nav class="gallery-links" aria-label="圖庫導覽"><a href="../../../index.html">805_ER</a><a href="sources.html">圖片來源</a></nav>', 1)
    page, count = re.subn(r'(<main id="gallery"[^>]*>).*?(</main>)', lambda match: match[1]+'\n'+make_cards(items, hidden)+'\n'+match[2], page, count=1, flags=re.S)
    if count != 1:
        raise ValueError("Gallery template must contain one main gallery element")
    page = page.replace('<span id="position"', '<span id="image-status" class="image-status" role="status" aria-live="polite" hidden></span>\n  <span id="position"', 1)
    for asset in ["display-data.js", "gallery-state.js", "gallery.js", "gallery.css"]:
        page = re.sub(re.escape(asset)+r'(?:\?[^\"]*)?(?=\")', asset+'?v='+VERSION, page)
    (DESTINATION / "index.html").write_text(page, encoding="utf-8")
    keys = ["id", "title", "part", "view", "image", "displaySize", "source", "sourcePage", "thumbnail", "thumbnailSize"]
    display = {"hiddenIds": manifest["hiddenIds"], "visibilityExportedAt": manifest["visibilityExportedAt"], "items": [{key: item[key] for key in keys} | {"sprite": bool(item.get("sprite"))} for item in items]}
    (DESTINATION / "display-data.js").write_text('window.XRAY_SELECTION = '+json.dumps(display, ensure_ascii=False, separators=(',', ':'))+';\n', encoding="utf-8")
    visible = [item for item in items if item["id"] not in hidden]
    manifest["previewStats"] = {"visibleThumbnailBytes": sum(item["thumbnailBytes"] for item in visible), "visibleOriginalBytes": sum((SOURCE / item["image"]).stat().st_size for item in visible), "eagerThumbnailBytes": sum(item["thumbnailBytes"] for item in visible[:4]), "maxEdge": PREVIEW_SIZE[0]}
    (DESTINATION / "selected-gallery.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding="utf-8")

    escape = lambda value: html.escape(str(value), quote=True)
    rows = []
    for item in items:
        licence = ''
        if item.get("rightsUrl"):
            label = 'CC BY-NC-SA 3.0' if item["source"] == "Radiopaedia" else '使用條款'
            licence = f'<a href="{escape(item["rightsUrl"])}">{label}</a>'
        status = '預設隱藏' if item['id'] in hidden else '顯示'
        note = ''
        if item.get('sourceView'):
            note = '<small>圖庫名稱依使用者指定；原來源投照標籤：'+escape(item['sourceView'])+'</small>'
        rows.append(f'<tr><td><a href="{escape(item["image"])}">{escape(item["title"])}</a>{note}</td><td>{escape(item.get("author",item["source"]))}</td><td><a href="{escape(item["sourcePage"])}">{escape(item["source"])}</a><br>{licence}</td><td>{status}</td></tr>')
    credits = '''<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>圖片來源｜正常 X 光圖庫</title><style>body{margin:0;background:#0b0e11;color:#e3e9ef;font:15px/1.7 system-ui,sans-serif}main{max-width:1200px;margin:auto;padding:24px}a{color:#a9ccef}h1{font-size:24px}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse}th,td{text-align:left;vertical-align:top;padding:13px;border-bottom:1px solid #303841}th{white-space:nowrap}small{display:block;color:#acb8c3;margin-top:6px}p{color:#b9c5cf}</style></head><body><main><a href="index.html">返回圖庫</a><h1>圖片來源</h1><p>圖片版權屬各原作者；個別圖片的使用條件請參閱來源網站。列表使用縮小的 WebP 快照，雙狀態圖片的快照與原本相同，只顯示標示區域。點開後載入未修改的原始圖檔，保留原始標示與浮水印。</p><div class="table-wrap"><table><thead><tr><th>圖庫標題</th><th>作者</th><th>來源與使用條件</th><th>顯示設定</th></tr></thead><tbody>'''+''.join(rows)+'''</tbody></table></div></main></body></html>'''
    (DESTINATION / "sources.html").write_text(credits, encoding="utf-8")
    readme = """# Normal X-ray gallery

Open `index.html` directly or use the 正常 X 光圖庫 link in the 805_ER sidebar.
The default selection shows {visible} images, with {hidden} previously removed
images hidden and recoverable from the browser-local management menu.

The grid loads WebP previews capped at 480 pixels on the long edge. Only the
first four visible previews load eagerly; remaining previews load near the
viewport. Full images are requested only when opened or explicitly navigated to
in the viewer. A preview remains visible while its original downloads. No full
images or adjacent originals are prefetched. Original files retain their hashes.

The {visible} visible previews total {preview_bytes:,} bytes, compared with
{original_bytes:,} bytes for their originals. The first four previews total
{eager_bytes:,} bytes; browsers may also load nearby lazy images.

`sources.html` lists every image's author and source. `selected-gallery.json`
preserves provenance, file hashes, source notes, and the saved selection.
Image rights remain with their respective authors. The RAO display title for
Candidate A is a user label; the source's Oblique label remains in its metadata.

To refresh the selected content (requires Pillow and the Git-ignored
`local-xray-gallery` source folder), run:

```sh
python scripts/build-xray-gallery.py
```

The tracked `gallery.js`, `gallery-state.js`, and `gallery.css` are the website
runtime and are not overwritten by the builder. Research downloads, unselected
candidates, selection exports, and backups remain local.
""".format(visible=manifest['visibleCount'], hidden=len(hidden), preview_bytes=manifest['previewStats']['visibleThumbnailBytes'], original_bytes=manifest['previewStats']['visibleOriginalBytes'], eager_bytes=manifest['previewStats']['eagerThumbnailBytes'])
    (DESTINATION / "README.md").write_text(readme, encoding="utf-8")
    print(json.dumps(manifest['previewStats']))


if __name__ == "__main__":
    main()