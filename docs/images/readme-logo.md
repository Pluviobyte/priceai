# README animated logo

The Chinese and English README headers use the same ice-cube scene as the website, exported as GIFs. No website rendering code is changed.

- Display: 112 × 112 CSS pixels; encoded: 168 × 168 pixels.
- Loop: 12 seconds, 12 fps, 144 frames, infinite repeat.
- Light background: GitHub light (`#ffffff`); dark background: GitHub dark (`#0d1117`).
- `<picture>` selects the theme and provides PNGs for reduced-motion preferences.
- The site's random layer twists are replaced only in the export with a deterministic upper-layer turn and return. Rotation and shader time return to their initial states at the loop boundary.
- Geometry, materials, model-icon decals and HDR environment come from the actual website source/assets. The export script fails if its source extraction markers change.

## Regenerate

Requires the repository's installed dependencies (including esbuild), FFmpeg, and Node.js 22+. Run from the repository root. Temporary compositions and bundles stay outside the repository.

```sh
node scripts/prepare-readme-logo.mjs /tmp/priceai-readme-light light
node scripts/prepare-readme-logo.mjs /tmp/priceai-readme-dark dark
npx hyperframes@0.8.40 check /tmp/priceai-readme-light --snapshots
npx hyperframes@0.8.40 check /tmp/priceai-readme-dark --snapshots
npx hyperframes@0.8.40 render /tmp/priceai-readme-light --format gif --fps 15 --workers 1 --output /tmp/priceai-light-full.gif
npx hyperframes@0.8.40 render /tmp/priceai-readme-dark --format gif --fps 15 --workers 1 --output /tmp/priceai-dark-full.gif
```

For each theme, replace `THEME` below with `light` or `dark`:

```sh
ffmpeg -y -v error -i /tmp/priceai-THEME-full.gif -filter_complex '[0:v]fps=12,scale=168:168:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=3' -loop 0 docs/images/logo-THEME.gif
ffmpeg -y -v error -i docs/images/logo-THEME.gif -frames:v 1 docs/images/logo-THEME.png
```

Verify both animations, their loop boundaries and the resulting README at the intended 112px size before committing. Initial export: HyperFrames 0.8.40, GSAP 3.14.2 (pinned download in the preparation script), Three.js from the repository lockfile. Both compositions passed HyperFrames checks; both final GIFs decoded to 144 frames and 12 seconds.
