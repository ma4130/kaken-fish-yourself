import { shapeById, H as LH } from './shapes.js';
import { createNet, params, ROOM, LOCAL } from './net.js';

const MAX = Math.max(1, Math.min(80, +params.get('max') || 30)); // うみにいる かずの上限
const SINCE_KEY = 'fish-since-' + ROOM;
const canvas = document.getElementById('sea');
const ctx = canvas.getContext('2d');

let VW = 0, VH = 0, DPR = 1, SAND = 0;
let bg = null;
const fish = [];
const byId = new Map();
const foods = [];
const bubbles = [];
const rings = [];
const sparks = [];
let weeds = [];
let since = 0;
try { since = +localStorage.getItem(SINCE_KEY) || 0; } catch { /* なくてもよい */ }

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
let crowd = 1; // さかなが ふえたら すこし小さく
const K = () => VH * 0.26 / LH * crowd; // えのせかい 1 → がめんの px

// ---------- 大きさ・背景 ----------
function resize() {
  DPR = Math.min(devicePixelRatio || 1, 2);
  VW = innerWidth; VH = innerHeight;
  canvas.width = Math.round(VW * DPR); canvas.height = Math.round(VH * DPR);
  SAND = VH * 0.86;
  bg = document.createElement('canvas');
  bg.width = canvas.width; bg.height = canvas.height;
  const b = bg.getContext('2d');
  b.scale(DPR, DPR);
  const g = b.createLinearGradient(0, 0, 0, VH);
  g.addColorStop(0, '#6fd6f7');
  g.addColorStop(0.45, '#2a9bd6');
  g.addColorStop(1, '#0d5c96');
  b.fillStyle = g; b.fillRect(0, 0, VW, VH);
  // すな
  b.beginPath();
  b.moveTo(0, VH);
  for (let x = 0; x <= VW + 20; x += 20) b.lineTo(x, SAND + Math.sin(x / VW * 9) * VH * 0.012 + Math.sin(x / VW * 23) * VH * 0.005);
  b.lineTo(VW, VH); b.closePath();
  const sg = b.createLinearGradient(0, SAND - 20, 0, VH);
  sg.addColorStop(0, '#f4dda6'); sg.addColorStop(1, '#d9b06a');
  b.fillStyle = sg; b.fill();
  b.fillStyle = 'rgba(160,110,50,.25)';
  for (let i = 0; i < VW / 6; i++) { b.beginPath(); b.arc(rand(0, VW), rand(SAND + 8, VH), rand(1, 2.5), 0, 7); b.fill(); }
  // いわ
  for (let i = 0; i < 5; i++) {
    const x = rand(0.05, 0.95) * VW, r = rand(0.03, 0.06) * VH;
    b.fillStyle = ['#6b8fa8', '#7d9cb3', '#5f7f99'][i % 3];
    b.beginPath(); b.ellipse(x, SAND + r * 0.35, r * 1.4, r, 0, Math.PI, 0); b.fill();
  }
  // かい
  for (let i = 0; i < 6; i++) {
    const x = rand(0, VW), y = rand(SAND + VH * 0.03, VH - 10), r = VH * 0.012;
    b.fillStyle = ['#ffc4d6', '#fff0c9', '#ffd8b0'][i % 3];
    b.beginPath(); b.arc(x, y, r, Math.PI, 0); b.lineTo(x, y + r * 0.6); b.closePath(); b.fill();
  }
  weeds = [];
  const n = Math.max(5, Math.round(VW / 260));
  for (let i = 0; i < n; i++) {
    weeds.push({
      x: (i + rand(0.2, 0.8)) / n * VW,
      h: rand(0.16, 0.32) * VH,
      seed: rand(0, 10),
      color: ['#2fb36b', '#3cc97a', '#1f9a5a', '#58d18a'][i % 4],
      w: rand(0.012, 0.02) * VH,
    });
  }
  for (const f of fish) { f.x = clamp(f.x, 0, VW); f.y = clamp(f.y, VH * 0.1, SAND); }
}

// ---------- さかな ----------
function addFish(doc, dive) {
  if (byId.has(doc.id)) return;
  const shape = shapeById(doc.shape);
  const f = {
    id: doc.id, shape, lw: doc.w || 600, lh: doc.h || 380,
    s: shape.size * rand(0.88, 1.1), img: new Image(), ready: false,
    x: rand(0.15, 0.85) * VW, y: rand(0.2, 0.7) * VH,
    th: Math.random() < 0.5 ? rand(-0.3, 0.3) : Math.PI + rand(-0.3, 0.3),
    sp: 0, goalDir: Math.random() < 0.5 ? 1 : -1, goalTilt: rand(-0.25, 0.25), turnT: rand(2, 5),
    flip: 1, phase: rand(0, 6), vx: 0, vy: 0, pulseT: rand(0, 2),
    state: dive ? 'dive' : 'swim', t: 0, ty: rand(0.3, 0.65) * VH,
    bounce: 0, puffT: rand(6, 14), puff: 0, leaveDir: 1,
  };
  f.flip = Math.cos(f.th) >= 0 ? 1 : -1;
  if (dive) { f.x = rand(0.2, 0.8) * VW; f.goalDir = f.x < VW / 2 ? 1 : -1; f.th = f.goalDir > 0 ? 0.25 : Math.PI - 0.25; f.flip = f.goalDir; }
  f.img.onload = () => { f.ready = true; if (dive) splash(f.x); };
  f.img.src = doc.img;
  byId.set(doc.id, f);
  fish.push(f);
}

function leave(f) {
  if (f.state === 'leave') return;
  f.state = 'leave';
  f.leaveDir = f.x < VW / 2 ? -1 : 1;
}

const dims = (f) => { const k = K() * f.s; return [f.lw * k, f.lh * k]; };
const mouth = (f, w, h) => (f.shape.motion === 'float'
  ? [f.x, f.y + h * 0.05]
  : [f.x + Math.sign(f.flip || 1) * w * 0.42, f.y]);

function nearestFood(f, w, h) {
  const [mx, my] = mouth(f, w, h);
  let best = null, bd = VW * 0.5;
  for (const p of foods) {
    if (p.eaten) continue;
    const d = Math.hypot(p.x - mx, p.y - my);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

function eatCheck(f, w, h) {
  const [mx, my] = mouth(f, w, h);
  for (const p of foods) {
    if (p.eaten) continue;
    if (Math.hypot(p.x - mx, p.y - my) < Math.max(h * 0.3, 16)) {
      p.eaten = true;
      f.bounce = 1;
      if (f.shape.puff && Math.random() < 0.5) f.puff = 1.4;
      for (let i = 0; i < 4; i++) bubble(mx + rand(-6, 6), my, rand(3, 6));
      for (let i = 0; i < 7; i++) sparks.push({ x: mx, y: my, a: rand(0, 7), v: rand(40, 110), t: 0 });
    }
  }
}

function updateFish(f, dt) {
  const [w, h] = dims(f);
  f.bounce = Math.max(0, f.bounce - dt * 1.6);
  if (f.state === 'dive') {
    f.t += dt;
    const p = Math.min(1, f.t / 1.4);
    const e = 1 - Math.pow(1 - p, 3);
    f.y = -h + (f.ty + h) * e;
    f.x += f.goalDir * dt * VW * 0.02;
    f.phase += dt * 8;
    if (Math.random() < dt * 14) bubble(f.x + rand(-w, w) * 0.3, f.y - h * 0.3, rand(3, 7));
    if (p >= 1) { f.state = 'swim'; f.sp = VW * 0.05; f.vy = 0; }
    return;
  }
  const food = f.state === 'swim' ? nearestFood(f, w, h) : null;
  if (f.shape.motion === 'float') updateFloat(f, dt, w, h, food);
  else updateSwim(f, dt, w, h, food);
  if (f.state !== 'leave') eatCheck(f, w, h);
  if (f.shape.puff) {
    f.puffT -= dt;
    if (f.puffT <= 0) { f.puff = 1.6; f.puffT = rand(9, 18); }
    f.puff = Math.max(0, f.puff - dt);
  }
  if (Math.random() < dt * 0.25) { const [mx, my] = mouth(f, w, h); bubble(mx, my - h * 0.1, rand(2, 5)); }
  if (f.state === 'leave' && (f.x < -w * 1.2 || f.x > VW + w * 1.2 || f.y < -h * 1.5)) {
    fish.splice(fish.indexOf(f), 1);
    byId.delete(f.id);
  }
}

function updateSwim(f, dt, w, h, food) {
  const base = VW * 0.045 * f.shape.speed;
  let target = base, goal, rate = 1.5;
  if (f.state === 'leave') {
    goal = f.leaveDir > 0 ? 0 : Math.PI; target = base * 1.6;
  } else if (food) {
    const [mx, my] = mouth(f, w, h);
    goal = Math.atan2(food.y - my, food.x - mx);
    target = base * 2.2; rate = 3.2;
  } else {
    f.turnT -= dt;
    if (f.turnT <= 0) {
      f.turnT = rand(2.5, 7);
      if (Math.random() < 0.3) f.goalDir *= -1;
      f.goalTilt = rand(-0.3, 0.3);
    }
    const m = Math.max(w * 0.55, VW * 0.06);
    if (f.x < m) f.goalDir = 1;
    if (f.x > VW - m) f.goalDir = -1;
    if (f.y < VH * 0.08 + h * 0.5) f.goalTilt = 0.3;
    if (f.y > SAND - h * 0.35) f.goalTilt = -0.3;
    goal = f.goalDir > 0 ? f.goalTilt : Math.PI - f.goalTilt;
  }
  const d = wrap(goal - f.th);
  f.th += clamp(d, -rate * dt, rate * dt);
  f.sp += (target - f.sp) * Math.min(1, dt * 1.5);
  f.x += Math.cos(f.th) * f.sp * dt;
  f.y += Math.sin(f.th) * f.sp * dt;
  if (f.state !== 'leave') f.y = clamp(f.y, h * 0.3, SAND - h * 0.15);
  const face = Math.cos(f.th) >= 0 ? 1 : -1;
  f.flip += clamp(face - f.flip, -dt * 4, dt * 4);
  f.phase += dt * (3 + 4 * f.sp / base);
}

function updateFloat(f, dt, w, h, food) {
  const P = f.shape.pulse;
  f.pulseT += dt;
  if (f.pulseT >= P) {
    f.pulseT = 0;
    let a;
    if (f.state === 'leave') a = f.leaveDir > 0 ? -0.5 : Math.PI + 0.5;
    else if (food) a = Math.atan2(food.y - f.y, food.x - f.x);
    else {
      a = -Math.PI / 2 + rand(-1.1, 1.1);
      if (f.x < VW * 0.12) a = -0.6;
      if (f.x > VW * 0.88) a = -Math.PI + 0.6;
      if (f.y < VH * 0.22) a = Math.random() < 0.5 ? 0.2 : Math.PI - 0.2;
    }
    const imp = VH * 0.16 * f.shape.speed * (food ? 1.4 : 1);
    f.vx += Math.cos(a) * imp; f.vy += Math.sin(a) * imp;
    if (food) f.pulseT = P * 0.4;
  }
  const drag = Math.exp(-1.3 * dt);
  f.vx *= drag; f.vy *= drag;
  f.vy += VH * 0.02 * dt;
  f.x += f.vx * dt; f.y += f.vy * dt;
  if (f.state !== 'leave') {
    f.x = clamp(f.x, w * 0.4, VW - w * 0.4);
    if (f.y > SAND - h * 0.35) { f.y = SAND - h * 0.35; f.vy = Math.min(f.vy, 0); }
    if (f.y < h * 0.4) { f.y = h * 0.4; f.vy = Math.max(f.vy, 0); }
  }
  f.phase += dt * 2.6;
  f.flip = 1;
}

function drawFish(f) {
  if (!f.ready) return;
  const [w, h] = dims(f);
  const img = f.img;
  ctx.save();
  ctx.translate(f.x, f.y);
  const bounce = 1 + 0.15 * Math.sin(f.bounce * Math.PI * 3) * f.bounce;
  if (f.shape.motion === 'float') {
    const P = f.shape.pulse, q = f.pulseT < 0.5 ? Math.sin(f.pulseT / 0.5 * Math.PI) : 0;
    ctx.rotate(clamp(f.vx / (VH * 0.5), -0.35, 0.35));
    ctx.scale((1 + 0.09 * q) * bounce, (1 - 0.13 * q) * bounce);
    const N = 20, iw = img.naturalWidth, ih = img.naturalHeight;
    for (let i = 0; i < N; i++) {
      const v = (i + 0.5) / N;
      const k = Math.pow(Math.max(0, (v - 0.4) / 0.6), 1.3);
      const dx = f.shape.amp * w * Math.sin(f.phase * (P < 3 ? 1.6 : 1.1) - v * 5) * k;
      ctx.drawImage(img, 0, ih * i / N, iw, ih / N + 1, -w / 2 + dx, -h / 2 + h * i / N, w, h / N + 1);
    }
  } else {
    let tilt = Math.atan2(Math.sin(f.th), Math.abs(Math.cos(f.th)));
    if (f.state === 'dive') tilt = 0.9 * (1 - Math.min(1, f.t / 1.4));
    const face = f.flip >= 0 ? 1 : -1;
    ctx.rotate(clamp(tilt, -0.6, 0.9) * face);
    const puff = f.shape.puff ? 1 + 0.22 * Math.sin(Math.min(1, f.puff / 1.6) * Math.PI) : 1;
    ctx.scale(f.flip * bounce * puff, bounce * puff);
    const N = 20, iw = img.naturalWidth, ih = img.naturalHeight;
    for (let i = 0; i < N; i++) {
      const u = (i + 0.5) / N; // 0 = しっぽ, 1 = あたま
      const k = Math.pow(Math.max(0, 1 - u / 0.72), 1.5);
      const dy = f.shape.amp * h * Math.sin(f.phase - u * 4.5) * k;
      ctx.drawImage(img, iw * i / N, 0, iw / N + 1, ih, -w / 2 + w * i / N, -h / 2 + dy, w / N + 1, h);
    }
  }
  ctx.restore();
}

// ---------- あわ・えさ ----------
function bubble(x, y, r) {
  bubbles.push({ x, y, r: r * VH / 900, t: 0, seed: rand(0, 6), vy: rand(0.05, 0.09) * VH });
}
function splash(x) {
  for (let i = 0; i < 14; i++) bubble(x + rand(-50, 50), rand(10, 70), rand(3, 9));
  rings.push({ x, y: 18, t: 0, max: VH * 0.12 });
}
function feed(x, y) {
  if (y > SAND) y = SAND - 10;
  for (let i = 0; i < 6; i++) {
    foods.push({ x: x + rand(-22, 22), y: y + rand(-12, 12), vy: rand(0.03, 0.05) * VH, seed: rand(0, 6), t: 0, ground: 0, eaten: false });
  }
  rings.push({ x, y, t: 0, max: VH * 0.08 });
}

// ---------- うごかす・かく ----------
let T = 0;
function step(dt) {
  T += dt;
  const want = clamp(1.1 - fish.length * 0.016, 0.6, 1);
  crowd += (want - crowd) * Math.min(1, dt * 0.5);
  for (const f of [...fish]) updateFish(f, dt);
  for (let i = foods.length - 1; i >= 0; i--) {
    const p = foods[i];
    p.t += dt;
    if (p.y < SAND - 6) { p.y += p.vy * dt; p.x += Math.sin(p.t * 2 + p.seed) * 12 * dt; } else p.ground += dt;
    if (p.eaten || p.ground > 8) foods.splice(i, 1);
  }
  if (Math.random() < dt * 2.2 && weeds.length) {
    const w = weeds[Math.floor(Math.random() * weeds.length)];
    bubble(w.x + rand(-10, 10), SAND - rand(0, w.h * 0.6), rand(2, 6));
  }
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i];
    b.t += dt; b.y -= b.vy * dt; b.x += Math.sin(b.t * 3 + b.seed) * 14 * dt;
    if (b.y < -10) bubbles.splice(i, 1);
  }
  for (let i = rings.length - 1; i >= 0; i--) { rings[i].t += dt; if (rings[i].t > 0.9) rings.splice(i, 1); }
  for (let i = sparks.length - 1; i >= 0; i--) { sparks[i].t += dt; if (sparks[i].t > 0.6) sparks.splice(i, 1); }
}

function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(bg, 0, 0);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  // ひかり
  ctx.save();
  for (let i = 0; i < 6; i++) {
    const x = (i + 0.5) / 6 * VW + Math.sin(T * 0.15 + i * 1.7) * VW * 0.05;
    const a = 0.07 + 0.04 * Math.sin(T * 0.5 + i * 2.1);
    const g = ctx.createLinearGradient(0, 0, 0, VH * 0.85);
    g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    const sw = VW * 0.035, skew = VW * 0.08 + Math.sin(T * 0.2 + i) * VW * 0.03;
    ctx.beginPath(); ctx.moveTo(x - sw, 0); ctx.lineTo(x + sw, 0);
    ctx.lineTo(x + sw * 2.5 + skew, VH * 0.85); ctx.lineTo(x - sw * 1.5 + skew, VH * 0.85); ctx.closePath(); ctx.fill();
  }
  // すいめん
  ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = 0; x <= VW; x += 16) ctx.lineTo(x, 8 + Math.sin(x / 60 + T * 1.5) * 4 + Math.sin(x / 23 - T) * 2);
  ctx.stroke();
  ctx.restore();
  // かいそう
  ctx.save(); ctx.lineCap = 'round';
  for (const w of weeds) {
    const seg = 10;
    for (let k = 0; k < 2; k++) {
      ctx.strokeStyle = w.color; ctx.globalAlpha = k ? 0.75 : 1;
      ctx.beginPath();
      for (let j = 0; j <= seg; j++) {
        const q = j / seg;
        const x = w.x + (k ? w.w * 1.5 : 0) + Math.sin(T * 1.1 + q * 3 + w.seed + k) * q * q * w.h * 0.18;
        const y = SAND + 4 - q * w.h * (k ? 0.75 : 1);
        if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.lineWidth = w.w; ctx.stroke();
    }
  }
  ctx.restore();
  // えさ
  for (const p of foods) {
    const r = VH * 0.009, a = p.ground > 6 ? 1 - (p.ground - 6) / 2 : 1;
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = '#c96f2a'; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fill();
    ctx.fillStyle = '#f2b36b'; ctx.beginPath(); ctx.arc(p.x - r * 0.3, p.y - r * 0.3, r * 0.4, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const f of fish) drawFish(f);
  // あわ
  ctx.lineWidth = 1.5;
  for (const b of bubbles) {
    ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.fillStyle = 'rgba(255,255,255,.18)';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.8)';
    ctx.beginPath(); ctx.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.25, 0, 7); ctx.fill();
  }
  for (const r of rings) {
    const p = r.t / 0.9;
    ctx.strokeStyle = `rgba(255,255,255,${0.7 * (1 - p)})`; ctx.lineWidth = 4 * (1 - p) + 1;
    ctx.beginPath(); ctx.ellipse(r.x, r.y, r.max * p, r.max * p * 0.45, 0, 0, 7); ctx.stroke();
  }
  for (const s of sparks) {
    const p = s.t / 0.6, d = s.v * s.t;
    ctx.fillStyle = `rgba(255,240,120,${1 - p})`;
    ctx.beginPath(); ctx.arc(s.x + Math.cos(s.a) * d, s.y + Math.sin(s.a) * d, 4 * (1 - p) + 1, 0, 7); ctx.fill();
  }
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  step(dt);
  render();
  requestAnimationFrame(loop);
}

// ---------- つうしん ----------
let first = true;
function sync(list) {
  const shown = list.filter((d) => (d.t || 0) > since && d.img);
  const ids = new Set(shown.map((d) => d.id));
  for (const d of shown.slice().reverse()) if (!byId.has(d.id)) addFish(d, !first);
  for (const f of fish) if (!ids.has(f.id)) leave(f);
  first = false;
}

const msg = document.getElementById('msg');
const showMsg = (t) => { msg.textContent = t; msg.style.display = t ? 'block' : 'none'; };
createNet({ onError: (e) => showMsg('つうしん エラー: ' + e.message) })
  .then((net) => net.onFish(MAX, sync))
  .catch((e) => showMsg(e.message + '（?local をつけると同じパソコンのタブどうしで試せます）'));

// ---------- そうさ ----------
canvas.addEventListener('pointerdown', (e) => { feed(e.clientX, e.clientY); });
const qs = location.search;
document.getElementById('btnDraw').onclick = () => window.open('draw.html' + qs, '_blank');
document.getElementById('btnGallery').onclick = () => window.open('gallery.html' + qs.replace(/([?&])test(&|$)/, '$1').replace(/[?&]$/, ''), '_blank');
document.getElementById('btnEmpty').onclick = () => {
  if (!confirm('いまいる さかなを ぜんぶ うみから かえしますか？（つぎに かいた さかなから でてきます）')) return;
  since = Date.now();
  try { localStorage.setItem(SINCE_KEY, String(since)); } catch { /* なくてもよい */ }
  for (const f of fish) leave(f);
};
const toggleFull = () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.();
};
document.getElementById('btnFull').onclick = toggleFull;
addEventListener('keydown', (e) => { if (e.key === 'f' || e.key === 'F') toggleFull(); });
let idleTimer = 0;
const wake = () => {
  document.body.classList.remove('idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => document.body.classList.add('idle'), 3000);
};
addEventListener('pointermove', wake);
wake();

addEventListener('resize', resize);
resize();
requestAnimationFrame(loop);

if (params.has('test')) {
  window.__fish = {
    fish, foods, bubbles, feed, sync,
    tick: (sec) => { for (let t = 0; t < sec; t += 1 / 30) step(1 / 30); render(); },
    info: () => fish.map((f) => ({ id: f.id, shape: f.shape.id, x: Math.round(f.x), y: Math.round(f.y), state: f.state, ready: f.ready })),
  };
}
if (LOCAL) console.log('ローカルモード: room=' + ROOM);
