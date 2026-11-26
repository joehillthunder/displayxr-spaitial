// SpAItial Worlds, walk mode: stand inside an Echo-3 room in glasses-free 3D.
//
// The page owns the camera (`controls: 'page'`): every adapter frame, onBeforeFrame integrates the
// walk and calls setCameraPose, so the pose drawn is this frame's (the attach pattern). The SDK keeps
// the eye math and the mono fallback.
//
// Comfort inside a room: the convergence is FIXED at 2 m (a re-estimated convergence locks onto the
// nearest wall and pulls the room through the glass), comfortDepth stays at the SDK default 0.3, and
// the depth control only lowers or restores it (≤ 100 %).
//
// Echo-3 worlds are Y-up with the origin at the first capture camera; worlds.json carries each
// room's floor height (floorY) and footprint (clip box), baked by tools/echo3_frame.py.

import { createInline3D } from '@displayxr/inline3d';
import { addSplat } from '@displayxr/inline3d/splat/playcanvas';

const $ = (id) => document.getElementById(id);
const canvas = $('tile');
const cover = $('cover');
const titleEl = $('title');
const params = new URLSearchParams(location.search);

const { worlds } = await fetch(new URL('../worlds.json', import.meta.url)).then((r) => r.json());
let world = worlds.find((w) => w.id === params.get('world')) ?? worlds[0];

const EYE = 1.55;            // m above the floor
const CONVERGENCE = 2;       // m, on the glass
const FOV = 60;              // vertical, degrees
const SPEED = 1.2;           // m/s walking
const TURN = 70;             // deg/s with the arrow keys
const MARGIN = 0.35;         // m kept from the footprint's edge
const DEPTH_STEPS = [0.5, 0.75, 1];
let depthIdx = 2;

// ── pose ─────────────────────────────────────────────────────────────────────────────────
const pose = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
const glide = { to: null }; // double-click target, eased toward
function start(w) {
  // The origin is the first capture camera: inside the room. Face the room's centre.
  const [cx, , cz] = w.frame.center;
  pose.x = 0; pose.z = 0;
  pose.y = w.floorY + EYE;
  pose.yaw = Math.hypot(cx, cz) > 0.3 ? Math.atan2(-cx, -cz) : 0;
  pose.pitch = -0.08;
  glide.to = null;
  clamp();
}
function clamp() {
  const { min, max } = world.clip;
  pose.x = Math.max(min[0] + MARGIN, Math.min(max[0] - MARGIN, pose.x));
  pose.z = Math.max(min[2] + MARGIN, Math.min(max[2] - MARGIN, pose.z));
  pose.pitch = Math.max(-1.2, Math.min(1.2, pose.pitch));
}
// Column-major world matrix, three.js convention (looks down −Z, +Y up): T · Ry(yaw) · Rx(pitch).
const m = new Float32Array(16);
function matrix() {
  const cy = Math.cos(pose.yaw), sy = Math.sin(pose.yaw), cp = Math.cos(pose.pitch), sp = Math.sin(pose.pitch);
  m.set([cy, 0, -sy, 0, sy * sp, cp, cy * sp, 0, sy * cp, -sp, cy * cp, 0, pose.x, pose.y, pose.z, 1]);
  return m;
}

// ── input ────────────────────────────────────────────────────────────────────────────────
const keys = new Set();
const hold = { fwd: 0, turn: 0 }; // on-screen buttons
addEventListener('keydown', (e) => {
  if (e.target.closest?.('input, textarea')) return;
  const k = e.key.toLowerCase();
  if (['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
    keys.add(k);
    glide.to = null;
    e.preventDefault();
  }
  if (k === 'r') start(world);
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());

let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  drag = { x: e.clientX, y: e.clientY, yaw: pose.yaw, pitch: pose.pitch };
  canvas.setPointerCapture(e.pointerId);
  canvas.focus();
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  pose.yaw = drag.yaw + (e.clientX - drag.x) * 0.005;
  pose.pitch = drag.pitch + (e.clientY - drag.y) * 0.005;
  glide.to = null;
  clamp();
});
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  step(-e.deltaY * 0.002, 0);
  glide.to = null;
}, { passive: false });
canvas.addEventListener('dblclick', (e) => {
  const p = handle.pick(e.clientX, e.clientY);
  if (!p) return;
  // Walk to just short of the picked point, at eye height.
  const dx = p[0] - pose.x, dz = p[2] - pose.z, d = Math.hypot(dx, dz);
  if (d < 0.2) return;
  const k = Math.max(0, d - 0.6) / d;
  glide.to = { x: pose.x + dx * k, z: pose.z + dz * k };
});
function bindHold(id, prop, val) {
  const b = $(id);
  const on = (e) => { e.preventDefault(); hold[prop] = val; glide.to = null; };
  const off = () => { hold[prop] = 0; };
  b.addEventListener('pointerdown', on);
  b.addEventListener('pointerup', off);
  b.addEventListener('pointerleave', off);
}
bindHold('fwd', 'fwd', 1);
bindHold('back', 'fwd', -1);
bindHold('left', 'turn', 1);
bindHold('right', 'turn', -1);

function step(fwd, strafe) {
  const sy = Math.sin(pose.yaw), cy = Math.cos(pose.yaw);
  pose.x += -sy * fwd + cy * strafe;
  pose.z += -cy * fwd - sy * strafe;
  clamp();
}
function advance(dt) {
  const has = (...k) => k.some((x) => keys.has(x));
  const fwd = (has('w', 'arrowup') ? 1 : 0) - (has('s', 'arrowdown') ? 1 : 0) + hold.fwd;
  const strafe = (has('d', 'e') ? 1 : 0) - (has('a', 'q') ? 1 : 0);
  const turn = (has('arrowleft') ? 1 : 0) - (has('arrowright') ? 1 : 0) + hold.turn;
  if (fwd || strafe) step(fwd * SPEED * dt, strafe * SPEED * dt);
  if (turn) pose.yaw += turn * TURN * (Math.PI / 180) * dt;
  if (glide.to) {
    const k = 1 - Math.exp(-dt * 2.5);
    pose.x += (glide.to.x - pose.x) * k;
    pose.z += (glide.to.z - pose.z) * k;
    if (Math.hypot(glide.to.x - pose.x, glide.to.z - pose.z) < 0.02) glide.to = null;
    clamp();
  }
}

// ── the tile ─────────────────────────────────────────────────────────────────────────────
start(world);
const wall = await createInline3D({ lazy: false });
const handle = addSplat(wall, canvas, world.url, {
  engine: 'playcanvas',
  controls: 'page',
  flipY: false,
  comfortDepth: 0.3,
  feather: 16,
  renderScale: 0.7,
  rectCover: 'auto',
  onBeforeFrame: ({ dt }) => {
    advance(dt);
    handle.setCameraPose(matrix(), { verticalFovDeg: FOV, near: 0.05, far: 60, convergence: CONVERGENCE });
  },
});

function showTitle() {
  titleEl.textContent = `${world.title} · ${world.size[0].toFixed(1)} × ${world.size[1].toFixed(1)} m`;
  $('dollhouse').href = `../?world=${world.id}`;
  for (const b of document.querySelectorAll('.world')) b.setAttribute('aria-current', String(b.dataset.id === world.id));
}
function setDepth(i) {
  depthIdx = Math.max(0, Math.min(DEPTH_STEPS.length - 1, i));
  const s = DEPTH_STEPS[depthIdx];
  handle.setStereo({ ipdScale: s, parallaxScale: s });
  $('depthOut').textContent = `${Math.round(s * 100)} %`;
}

await handle.ready.catch((err) => {
  cover.textContent = `Couldn't load the room: ${err.message}`;
  throw err;
});
setDepth(depthIdx);
showTitle();
const woven = await handle.firstWoven;
cover.remove(); // a cut, never a fade (woven-canvas rule 5)
console.info('[spaitial-walk] firstWoven', woven);

// ── world picker ─────────────────────────────────────────────────────────────────────────
const list = $('worlds');
for (const w of worlds) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'world';
  b.dataset.id = w.id;
  b.innerHTML = `<img alt="" loading="lazy" src="${w.thumb}"><span></span>`;
  b.querySelector('span').textContent = w.name;
  b.addEventListener('click', () => switchTo(w));
  list.append(b);
}
showTitle();

let switching = null;
async function switchTo(w) {
  if (w.id === world.id) return;
  world = w;
  start(w);
  showTitle();
  const job = (switching = handle.setSource(w.url, { transition: 'cut' }));
  try { await job; } catch { titleEl.textContent = `Couldn't load ${w.name}`; return; }
  if (switching !== job) return;
  const u = new URL(location.href);
  u.searchParams.set('world', w.id);
  history.replaceState(null, '', u);
}

// ── controls ─────────────────────────────────────────────────────────────────────────────
$('depthDown').addEventListener('click', () => setDepth(depthIdx - 1));
$('depthUp').addEventListener('click', () => setDepth(depthIdx + 1));
$('reset').addEventListener('click', () => { start(world); setDepth(2); });
// Full panel: a resize is a fresh-canvas moment (woven-canvas rule 11): cover until woven again.
$('full').addEventListener('click', async () => {
  const stage = $('stage');
  const veil = document.createElement('div');
  veil.id = 'cover';
  stage.append(veil);
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await stage.requestFullscreen();
  } catch { /* refused: the tile stays as it was */ }
  await (handle.rewoven?.() ?? Promise.resolve());
  veil.remove();
  canvas.focus();
});

// For scripted checks (CDP): read or set the pose.
window.spaitialWalk = {
  handle, worlds,
  pose: () => ({ ...pose, world: world.id }),
  set: (p) => { Object.assign(pose, p); clamp(); return { ...pose }; },
};
