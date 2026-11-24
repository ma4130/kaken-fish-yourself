import { SHAPES, W, H, shapeById, fillShape, drawOutline, shapeBox, shapeIcon } from './shapes.js';
import { createNet, params, ROOM, LOCAL } from './net.js';

const S = 1.5;            // キャンバスの細かさ（えのせかい × S）
const OUTLINE = 7;        // りんかく線のふとさ
const OUT_MAX = 420;      // おくる絵の いちばん長い辺(px)
const UNDO_MAX = 10;
const COLORS = [
  '#ff3b30', '#ff9500', '#ffd60a', '#a4e33b', '#34c759', '#00c7be',
  '#32ade6', '#2f5bea', '#af52de', '#ff6fb5', '#8e5a3c', '#1d1d1f',
];

const $ = (id) => document.getElementById(id);
const stage = $('stage');
const guide = $('guide'), paint = $('paint'), over = $('over');
for (const c of [guide, paint, over]) { c.width = W * S; c.height = H * S; }
const gctx = guide.getContext('2d');
const pctx = paint.getContext('2d', { willReadFrequently: true });
const octx = over.getContext('2d');
const mask = document.createElement('canvas');
mask.width = W * S; mask.height = H * S;
const mctx = mask.getContext('2d', { willReadFrequently: true });

const st = {
  shape: SHAPES[0],
  color: COLORS[1],
  size: 24,
  tool: 'pen', // pen | fill | eraser
  undo: [],
  painted: false,
  sending: false,
};

let net = null;
const status = (t) => { $('status').textContent = t; };
createNet({ onError: (e) => status('つうしん エラー: ' + e.message) })
  .then((n) => { net = n; status((LOCAL ? 'ローカル' : 'ネット') + ' / ' + ROOM); })
  .catch((e) => status('つうしん できません: ' + e.message));

// ---------- かたち ----------
function setShape(shape, { keepUndo = false } = {}) {
  st.shape = shape;
  mctx.clearRect(0, 0, mask.width, mask.height);
  fillShape(mctx, shape, '#fff', S);
  gctx.clearRect(0, 0, guide.width, guide.height);
  gctx.drawImage(mask, 0, 0);
  octx.clearRect(0, 0, over.width, over.height);
  drawOutline(octx, shape, S, OUTLINE);
  remask(0, 0, paint.width, paint.height);
  if (!keepUndo) st.painted = hasInk();
  document.querySelectorAll('.shape').forEach((b) => b.classList.toggle('on', b.dataset.id === shape.id));
  refresh();
}

function remask(x, y, w, h) {
  x = Math.max(0, Math.floor(x)); y = Math.max(0, Math.floor(y));
  w = Math.min(paint.width - x, Math.ceil(w)); h = Math.min(paint.height - y, Math.ceil(h));
  if (w <= 0 || h <= 0) return;
  pctx.save();
  pctx.beginPath(); pctx.rect(x, y, w, h); pctx.clip(); // destination-in は外がわも消すので、はんいをしぼる
  pctx.globalCompositeOperation = 'destination-in';
  pctx.drawImage(mask, x, y, w, h, x, y, w, h);
  pctx.restore();
}

function hasInk() {
  const d = pctx.getImageData(0, 0, paint.width, paint.height).data;
  for (let i = 3; i < d.length; i += 4 * 7) if (d[i] > 20) return true;
  return false;
}

// ---------- ボタン ----------
for (const s of SHAPES) {
  const b = document.createElement('button');
  b.className = 'shape';
  b.dataset.id = s.id;
  b.appendChild(shapeIcon(s, 110));
  b.append(s.name);
  b.onclick = () => { if (st.shape !== s) { pushUndo(); setShape(s, { keepUndo: true }); st.painted = hasInk(); refresh(); } };
  $('shapes').appendChild(b);
}
for (const c of COLORS) {
  const b = document.createElement('button');
  b.className = 'color';
  b.style.background = c;
  b.dataset.color = c;
  b.onclick = () => { st.color = c; if (st.tool === 'eraser') st.tool = 'pen'; refresh(); };
  $('palette').appendChild(b);
}
document.querySelectorAll('.size').forEach((b) => {
  b.onclick = () => { st.size = +b.dataset.size; st.tool = 'pen'; refresh(); };
});
$('fill').onclick = () => { st.tool = st.tool === 'fill' ? 'pen' : 'fill'; refresh(); };
$('eraser').onclick = () => { st.tool = st.tool === 'eraser' ? 'pen' : 'eraser'; refresh(); };
$('undo').onclick = undo;
$('clear').onclick = () => {
  if (!hasInk()) return;
  pushUndo();
  pctx.clearRect(0, 0, paint.width, paint.height);
  st.painted = false;
  refresh();
};
$('done').onclick = () => send();
$('retry').onclick = (e) => { e.stopPropagation(); send(); };
$('sent').onclick = () => { if ($('sent').classList.contains('fail')) closeSent(); };

function refresh() {
  document.querySelectorAll('.color').forEach((b) => b.classList.toggle('on', b.dataset.color === st.color && st.tool !== 'eraser'));
  document.querySelectorAll('.size').forEach((b) => b.classList.toggle('on', st.tool === 'pen' && +b.dataset.size === st.size));
  document.querySelectorAll('.dot').forEach((d) => { d.style.background = st.color; });
  document.querySelectorAll('.fillc').forEach((p) => { p.style.color = st.color; });
  $('fill').classList.toggle('on', st.tool === 'fill');
  $('eraser').classList.toggle('on', st.tool === 'eraser');
  $('undo').disabled = !st.undo.length;
  $('undo').style.opacity = st.undo.length ? 1 : 0.4;
  $('done').disabled = !st.painted || st.sending;
}

// ---------- もどる ----------
function pushUndo() {
  st.undo.push({ shape: st.shape, img: pctx.getImageData(0, 0, paint.width, paint.height) });
  if (st.undo.length > UNDO_MAX) st.undo.shift();
}
function undo() {
  const u = st.undo.pop();
  if (!u) return;
  if (u.shape !== st.shape) setShape(u.shape, { keepUndo: true });
  pctx.putImageData(u.img, 0, 0);
  st.painted = hasInk();
  refresh();
}

// ---------- かく ----------
let active = null; // { id, x, y }
const toLocal = (e) => {
  const r = over.getBoundingClientRect();
  return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H];
};

over.addEventListener('pointerdown', (e) => {
  if (active || st.sending) return;
  e.preventDefault();
  const [x, y] = toLocal(e);
  if (st.tool === 'fill') { pushUndo(); if (floodFill(x, y, st.color)) st.painted = true; else st.undo.pop(); refresh(); return; }
  over.setPointerCapture(e.pointerId);
  pushUndo();
  active = { id: e.pointerId, x, y };
  line(x, y, x + 0.01, y);
});
over.addEventListener('pointermove', (e) => {
  if (!active || e.pointerId !== active.id) return;
  const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  for (const ev of (evs.length ? evs : [e])) {
    const [x, y] = toLocal(ev);
    line(active.x, active.y, x, y);
    active.x = x; active.y = y;
  }
});
const end = (e) => {
  if (!active || e.pointerId !== active.id) return;
  active = null;
  st.painted = st.tool === 'eraser' ? hasInk() : (st.painted || hasInk());
  refresh();
};
over.addEventListener('pointerup', end);
over.addEventListener('pointercancel', end);

function line(x0, y0, x1, y1) {
  const size = st.tool === 'eraser' ? 44 : st.size;
  pctx.save();
  pctx.setTransform(S, 0, 0, S, 0, 0);
  pctx.lineCap = 'round';
  pctx.lineJoin = 'round';
  pctx.lineWidth = size;
  pctx.strokeStyle = st.color;
  if (st.tool === 'eraser') pctx.globalCompositeOperation = 'destination-out';
  pctx.beginPath(); pctx.moveTo(x0, y0); pctx.lineTo(x1, y1); pctx.stroke();
  pctx.restore();
  if (st.tool !== 'eraser') {
    const r = size / 2 + 2;
    remask((Math.min(x0, x1) - r) * S, (Math.min(y0, y1) - r) * S, (Math.abs(x1 - x0) + r * 2) * S, (Math.abs(y1 - y0) + r * 2) * S);
  }
}

// ぬりつぶし：おなじ色でつながっている所を、かたちの中だけぬる
function floodFill(lx, ly, color) {
  const w = paint.width, h = paint.height;
  const sx = Math.floor(lx * S), sy = Math.floor(ly * S);
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return false;
  const md = mctx.getImageData(0, 0, w, h).data;
  if (md[(sy * w + sx) * 4 + 3] < 128) return false;
  const img = pctx.getImageData(0, 0, w, h);
  const d = img.data;
  const fr = parseInt(color.slice(1, 3), 16), fg = parseInt(color.slice(3, 5), 16), fb = parseInt(color.slice(5, 7), 16);
  const i0 = (sy * w + sx) * 4;
  // 下が白（とうめい）なら白として比べる
  const pix = (i) => {
    const a = d[i + 3] / 255;
    return [d[i] * a + 255 * (1 - a), d[i + 1] * a + 255 * (1 - a), d[i + 2] * a + 255 * (1 - a)];
  };
  const [tr, tg, tb] = pix(i0);
  if (Math.abs(tr - fr) + Math.abs(tg - fg) + Math.abs(tb - fb) < 10 && d[i0 + 3] > 250) return false;
  const TOL = 110;
  const seen = new Uint8Array(w * h);
  const ok = (p) => {
    if (seen[p]) return false;
    const i = p * 4;
    if (md[i + 3] < 128) return false;
    const [r, g, b] = pix(i);
    return Math.abs(r - tr) + Math.abs(g - tg) + Math.abs(b - tb) <= TOL;
  };
  const stack = [sy * w + sx];
  let n = 0;
  while (stack.length) {
    const p = stack.pop();
    let x = p % w;
    const y = (p - x) / w;
    let l = x;
    while (l > 0 && ok(y * w + l - 1)) l--;
    let r = x;
    while (r < w - 1 && ok(y * w + r + 1)) r++;
    let upOpen = false, downOpen = false;
    for (let xx = l; xx <= r; xx++) {
      const q = y * w + xx;
      if (seen[q]) continue;
      seen[q] = 1; n++;
      const i = q * 4;
      d[i] = fr; d[i + 1] = fg; d[i + 2] = fb; d[i + 3] = 255;
      if (y > 0) {
        const u = q - w;
        if (ok(u)) { if (!upOpen) { stack.push(u); upOpen = true; } } else upOpen = false;
      }
      if (y < h - 1) {
        const dn = q + w;
        if (ok(dn)) { if (!downOpen) { stack.push(dn); downOpen = true; } } else downOpen = false;
      }
    }
  }
  if (!n) return false;
  pctx.putImageData(img, 0, 0);
  return true;
}

// ---------- おくる ----------
function makeImage() {
  const b = shapeBox(st.shape, OUTLINE + 3);
  const sc = OUT_MAX / Math.max(b.w, b.h);
  const c = document.createElement('canvas');
  c.width = Math.round(b.w * sc); c.height = Math.round(b.h * sc);
  const ctx = c.getContext('2d');
  for (const src of [mask, paint, over]) {
    ctx.drawImage(src, b.x * S, b.y * S, b.w * S, b.h * S, 0, 0, c.width, c.height);
  }
  return { img: c.toDataURL('image/png'), w: b.w, h: b.h };
}

async function send() {
  if (st.sending || !st.painted) return;
  const sent = $('sent');
  const out = makeImage();
  st.sending = true; refresh();
  $('sentImg').src = out.img;
  $('sentMsg').textContent = 'おくっているよ…';
  sent.className = 'show';
  try {
    if (!net) throw new Error('つうしん できません');
    await Promise.race([
      net.sendFish({ img: out.img, shape: st.shape.id, w: out.w, h: out.h, t: Date.now() }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('じかんぎれ')), 15000)),
    ]);
    $('sentMsg').textContent = 'うみに いったよ！';
    sent.className = 'show go';
    setTimeout(() => {
      st.undo = [];
      pctx.clearRect(0, 0, paint.width, paint.height);
      st.painted = false;
      closeSent();
    }, 2400);
  } catch (e) {
    console.warn(e);
    $('sentMsg').textContent = 'うまく おくれなかったよ';
    sent.className = 'show fail';
    st.sending = false; refresh();
  }
}
function closeSent() {
  $('sent').className = '';
  st.sending = false;
  refresh();
}

// ---------- 大きさあわせ ----------
function fit() {
  const wrap = $('stageWrap');
  const aw = wrap.clientWidth, ah = wrap.clientHeight;
  let w = aw, h = aw * H / W;
  if (h > ah) { h = ah; w = ah * W / H; }
  stage.style.width = Math.floor(w) + 'px';
  stage.style.height = Math.floor(h) + 'px';
}
addEventListener('resize', fit);
new ResizeObserver(fit).observe($('stageWrap'));
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });

setShape(SHAPES[0]);
fit();

if (params.has('test')) {
  window.__draw = {
    st, SHAPES,
    setShape: (id) => setShape(shapeById(id)),
    stroke: (pts, color = st.color, size = st.size) => {
      st.color = color; st.size = size; st.tool = 'pen';
      pushUndo();
      for (let i = 1; i < pts.length; i++) line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
      st.painted = hasInk(); refresh();
    },
    fill: (x, y, color = st.color) => { pushUndo(); const r = floodFill(x, y, color); st.painted = hasInk(); refresh(); return r; },
    send, makeImage,
  };
}
