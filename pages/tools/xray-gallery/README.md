# Normal X-ray gallery

Open `index.html` directly or use the 正常 X 光圖庫 link in the 805_ER sidebar.
The default selection shows 71 images, with 5 previously removed
images hidden and recoverable from the browser-local management menu.

The grid loads WebP previews capped at 480 pixels on the long edge. Only the
first four visible previews load eagerly; remaining previews load near the
viewport. Full images are requested only when opened or explicitly navigated to
in the viewer. A preview remains visible while its original downloads. No full
images or adjacent originals are prefetched. Original files retain their hashes.

The 71 visible previews total 1,054,270 bytes, compared with
11,099,067 bytes for their originals. The first four previews total
86,246 bytes; browsers may also load nearby lazy images.

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
