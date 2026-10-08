# Normal X-ray gallery

Open `index.html` directly or use the 正常 X 光圖庫 link in the 805_ER sidebar.
The gallery keeps English titles, head-to-foot ordering, full-size viewing, zoom,
and the browser-local hide/restore menu. The default selection shows 71
images, with 5 previously removed images hidden and recoverable.

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
