# SpAItial Worlds (DisplayXR)

SpAItial's public Echo-3 gallery rooms as glasses-free 3D dollhouses on DisplayXR (2D elsewhere), plus an
About page on SpAItial's models, API, exports and pricing. Linked from DisplayXR HQ (AI wing, room `spaitial`).

- `index.html` + `app.js` + `worlds.json`: the 3D viewer. Restored from the HQ repo's removed
  `displayxr-demos/apps/echo-worlds` (commit a48b131^), which passed woven on the Leia panel.
  Import map pins playcanvas 2.22.3 and `@displayxr/inline3d` 1.46.0; keep the pins exact.
- `about/index.html`: static showcase page (no SDK, 2D). `thumbs/` are SpAItial gallery thumbnails for it.
- No build, no keys. GitHub Pages serves `main` from the root.

## Content and terms
- Worlds are **streamed from SpAItial's CDN** (`echodot.spaitial.io`, Streamed SOG, CORS *), never copied here.
  Credit SpAItial on every page.
- SpAItial has not confirmed terms for public use. Joe chose to post this on 2026-11-25 anyway (David had asked
  on 2026-10-29 to hold it). If SpAItial or David asks, take it down.

## Rules learned on the panel (don't undo)
- Echo-3 worlds are **Y-up**: keep `flipY: false`.
- Frame with `viewer.fitTo(frame.center, frame.extent)` + `setFocus` on the baked cut-room box; the `frame`
  option alone mis-centres a Streamed SOG.
- Woven-canvas rules: one persistent canvas, cover until `firstWoven` and remove it as a cut (no fade),
  no CSS transforms/filters/opacity on the canvas or its ancestors, mid-tone background.
- Page depth 100 % = 0.75 × the display rig default (`?depthBase=` overrides).
- `worlds.json` comes from `tools/echo3_frame.py` (Python + NumPy + Pillow, offline); regenerate, don't hand-edit.

## Testing (no Node or Python on the demo PC)
- 2D: headless Edge screenshot against a PowerShell HttpListener server.
- Panel: `displayxr-compat/scripts/run-demo.ps1 -Demo <url>`. Pass = `firstWoven woven=true confirmed=true`
  in the log; screenshots of the woven panel come out blank.
