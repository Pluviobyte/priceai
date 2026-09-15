// Build a disposable, seekable HyperFrames scene from the actual header logo.
// Usage: node scripts/prepare-readme-logo.mjs /absolute/render-directory light|dark
import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] || '/tmp/priceai-readme-logo');
const theme = process.argv[3] === 'dark' ? 'dark' : 'light';
const sourceDir = path.join(root, 'apps/web/src/app/cube-logo');
let source = await readFile(path.join(sourceDir, 'ice-cube-logo.tsx'), 'utf8');
function between(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  if (a < 0 || b < 0) throw new Error('Logo source changed; update export markers');
  return source.slice(a, b);
}
let helpers = between('type Axis', 'export type IceCubeLogoProps');
helpers = helpers.replace(/function isDarkTheme\(\)[\s\S]*?\n}/, `function isDarkTheme() { return ${theme === 'dark'}; }`);
let scene = between('      const scene = new THREE.Scene();', '      const twistGroup = new THREE.Group();');
const entry = `import * as THREE from '${root}/node_modules/three/build/three.module.js';
import { RoundedBoxGeometry } from '${root}/node_modules/three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { HDRLoader } from '${root}/node_modules/three/examples/jsm/loaders/HDRLoader.js';
import { MODEL_ICON_ENTRIES } from '${root}/apps/web/src/app/model-icons';
import { createIceFlameMaterial, updateIceFlameMaterial } from '${sourceDir}/ice-flame-material';
${helpers}
async function main() {
 const ready = new Promise<void>((resolve,reject) => { THREE.DefaultLoadingManager.onLoad=resolve; THREE.DefaultLoadingManager.onError=()=>reject(new Error('Logo asset failed')); });
 const canvas = document.getElementById('logo') as HTMLCanvasElement;
 const renderer = new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,preserveDrawingBuffer:true});
 renderer.setPixelRatio(1); renderer.setSize(224,224,false);
 renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping;
 renderer.toneMappingExposure=${theme === 'dark' ? '.98' : '.88'};
 let environmentTarget: THREE.WebGLRenderTarget | undefined;
 const disposed=false, iconTextures: THREE.CanvasTexture[]=[], flameMaterials: THREE.ShaderMaterial[]=[];
 const applyTheme=()=>{};
 ${scene}
 const coreLight = new THREE.PointLight(0x7ec8ee,.17,3.2,2); cube.add(coreLight);
 // Return the same upper layer to its initial transform, creating a clean loop.
 const layer = new THREE.Group(); cube.add(layer); cube.updateMatrixWorld(true);
 for (const part of cubelets.filter(part=>part.position.y>0)) layer.attach(part);
 function renderAt(time:number) {
   const phase=(time%12)/12*Math.PI*2;
   cube.rotation.set(-.4,.52+phase,-.06);
   layer.rotation.y=Math.PI/2*Math.pow(Math.sin(phase/2),8);
   const flameTime=2.4+2*(1-Math.cos(phase));
   for (const material of flameMaterials) updateIceFlameMaterial(material,flameTime,.92,${theme === 'dark'});
   renderer.render(scene,camera);
 }
 await ready;
 (window as any).__renderLogo=renderAt;
 renderAt((window as any).__hfThreeTime || 0);
}
(window as any).__logoReady=main();`;
await mkdir(out,{recursive:true});
await writeFile(path.join(out,'scene.ts'),entry);
await build({entryPoints:[path.join(out,'scene.ts')],outfile:path.join(out,'scene.js'),bundle:true,format:'esm',define:{'process.env.NEXT_PUBLIC_ICE_CORE_VARIANT':'"flame"'},minify:true});
await cp(path.join(root,'apps/web/public/model-icons'),path.join(out,'model-icons'),{recursive:true});
await cp(path.join(root,'apps/web/public/env'),path.join(out,'env'),{recursive:true});
const gsapResponse=await fetch('https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js');
if(!gsapResponse.ok) throw new Error('Cannot load pinned GSAP renderer');
await writeFile(path.join(out,'gsap.min.js'),await gsapResponse.text());
await writeFile(path.join(out,'index.html'),`<!doctype html><html data-theme="${theme}"><head><meta charset="UTF-8"><title>PriceAI README logo</title><style>html,body{margin:0;background:${theme === 'dark' ? '#0d1117' : '#ffffff'}}#main{width:224px;height:224px;position:relative;overflow:hidden}canvas{display:block;width:224px;height:224px}</style></head><body><div id="main" data-composition-id="main" data-start="0" data-duration="12" data-width="224" data-height="224"><canvas id="logo" class="clip" data-start="0" data-duration="12"></canvas></div><script src="./gsap.min.js"></script><script type="module">import './scene.js'; await window.__logoReady; const playhead={time:0}; const tl=gsap.timeline({paused:true});tl.to(playhead,{time:12,duration:12,ease:'none',onUpdate:()=>window.__renderLogo(playhead.time)});window.__timelines['main']=tl;</script></body></html>`);
console.log(`Prepared ${theme} logo in ${out}`);
