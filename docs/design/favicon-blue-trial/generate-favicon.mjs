// Rasterize purpose-built vector artwork, not a scaled WebGL screenshot.
// Run from the repository root: node scripts/generate-favicon.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = new URL('../', import.meta.url);
const app = new URL('apps/web/src/app/', root);
const brand = new URL('apps/web/public/brand/', root);
await mkdir(brand, { recursive: true });
const marks = await Promise.all(['openai.svg', 'claude-official.svg', 'gemini-official.svg', 'deepseek-official.svg'].map(async name => {
  const svg = (await readFile(new URL(`apps/web/public/model-icons/${name}`, root), 'utf8')).replaceAll('currentColor', '#172b45');
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}));

const faces = [
  { origin: [4, 17], u: [39, 5], v: [0, 38], colors: ['#548ee0', '#4581d5', '#3c76c9', '#3268b9'] },
  { origin: [43, 22], u: [17, -12], v: [0, 38], colors: ['#2f60aa', '#244f93', '#27569d', '#204780'] },
  { origin: [4, 17], u: [17, -13], v: [39, 6], colors: ['#a4c8f4', '#86b4ed', '#83b0e9', '#6ea2e2'] },
];
function point(face, x, y) {
  return [face.origin[0] + face.u[0] * x + face.v[0] * y, face.origin[1] + face.u[1] * x + face.v[1] * y];
}
function artwork(detailed = false) {
  const tiles = faces.map((face, faceIndex) => {
    const cells = [];
    for (let row = 0; row < 2; row++) for (let col = 0; col < 2; col++) {
      const gap = 0.033;
      const x = col / 2 + gap, y = row / 2 + gap;
      const w = 0.5 - gap * 2;
      const corners = [[x, y], [x + w, y], [x + w, y + w], [x, y + w]].map(([a, b]) => point(face, a, b).join(','));
      cells.push(`<polygon points="${corners.join(' ')}" fill="${face.colors[row * 2 + col]}"/>`);
      if (detailed && faceIndex === 0) {
        const [px, py] = point(face, x + 0.052, y + 0.052);
        cells.push(`<g transform="matrix(1 ${5 / 39} 0 1 ${px} ${py})"><rect width="12.8" height="12.8" rx="2" fill="#eef5ff"/><image x="1.4" y="1.4" width="10" height="10" href="${marks[row * 2 + col]}"/></g>`);
      }
    }
    return cells.join('');
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><title>PriceAI blue cube</title><path d="M4 17 21 4 60 10 60 48 43 60 4 55Z" fill="#173d73" stroke="#173d73" stroke-width="1.5" stroke-linejoin="round"/>${tiles}</svg>`;
}

await writeFile(new URL('favicon-cube.svg', brand), artwork());
const raster = async size => sharp(Buffer.from(artwork(size >= 128)), { density: 576 }).resize(size, size).png().toBuffer();
await writeFile(new URL('icon.png', app), await raster(512));
await writeFile(new URL('apple-icon.png', app), await raster(180));
// The browser should choose a clean 16/32/48/64 frame, not downsample a logo collage.
const sizes = [256, 128, 64, 48, 32, 16];
const frames = await Promise.all(sizes.map(raster));
const header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
frames.forEach((frame, i) => {
  const p = 6 + i * 16;
  header[p] = sizes[i] === 256 ? 0 : sizes[i];
  header[p + 1] = header[p];
  header.writeUInt16LE(1, p + 4);
  header.writeUInt16LE(32, p + 6);
  header.writeUInt32LE(frame.length, p + 8);
  header.writeUInt32LE(offset, p + 12);
  offset += frame.length;
});
await writeFile(new URL('favicon.ico', app), Buffer.concat([header, ...frames]));
// Explicit small PNGs ensure Chromium doesn't choose the detailed 512px app icon.
for (const size of [16, 32, 48]) await writeFile(new URL(`favicon-${size}.png`, brand), await raster(size));
console.log(`Generated multi-resolution cube favicons in ${fileURLToPath(app)}`);
