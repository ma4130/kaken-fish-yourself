// えらべる かたち。座標は 800 x 500 の「えのせかい」。あたまは みぎ向き。
// parts はかさねて「たし算」される（中で重なっていても線は出ない）。
export const W = 800;
export const H = 500;

const ellipse = (cx, cy, rx, ry) => (p) => p.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
const poly = (...pts) => (p) => {
  p.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) p.lineTo(pts[i], pts[i + 1]);
  p.closePath();
};
const draw = (fn) => fn; // fn(p) で自由にかく

function spikes(cx, cy, r0, r1, n, skip) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    if (skip(a)) continue;
    const w = 0.13;
    out.push(poly(
      cx + Math.cos(a - w) * r0, cy + Math.sin(a - w) * r0,
      cx + Math.cos(a) * r1, cy + Math.sin(a) * r1,
      cx + Math.cos(a + w) * r0, cy + Math.sin(a + w) * r0,
    ));
  }
  return out;
}

function octopus(p) {
  p.moveTo(232, 246);
  p.bezierCurveTo(197, 142, 277, 48, 400, 48);
  p.bezierCurveTo(523, 48, 603, 142, 568, 246);

  // まるい先の足を、右から左へ 8 本つなげる。
  p.bezierCurveTo(583, 275, 615, 308, 642, 299);
  p.bezierCurveTo(660, 293, 651, 271, 672, 269);
  p.bezierCurveTo(695, 267, 702, 304, 680, 324);
  p.bezierCurveTo(647, 355, 591, 343, 548, 313);

  p.bezierCurveTo(570, 347, 598, 370, 619, 366);
  p.bezierCurveTo(642, 359, 657, 378, 645, 395);
  p.bezierCurveTo(627, 421, 568, 406, 512, 342);

  p.bezierCurveTo(530, 378, 546, 414, 566, 414);
  p.bezierCurveTo(588, 414, 595, 437, 574, 447);
  p.bezierCurveTo(536, 465, 492, 427, 465, 360);

  p.bezierCurveTo(471, 398, 471, 432, 485, 439);
  p.bezierCurveTo(502, 453, 487, 475, 463, 470);
  p.bezierCurveTo(428, 464, 411, 426, 400, 374);

  p.bezierCurveTo(389, 426, 372, 464, 337, 470);
  p.bezierCurveTo(313, 475, 298, 453, 315, 439);
  p.bezierCurveTo(329, 432, 329, 398, 335, 360);

  p.bezierCurveTo(308, 427, 264, 465, 226, 447);
  p.bezierCurveTo(205, 437, 212, 414, 234, 414);
  p.bezierCurveTo(254, 414, 270, 378, 288, 342);

  p.bezierCurveTo(232, 406, 173, 421, 155, 395);
  p.bezierCurveTo(143, 378, 158, 359, 181, 366);
  p.bezierCurveTo(202, 370, 230, 347, 252, 313);

  p.bezierCurveTo(209, 343, 153, 355, 120, 324);
  p.bezierCurveTo(98, 304, 105, 267, 128, 269);
  p.bezierCurveTo(149, 271, 140, 293, 158, 299);
  p.bezierCurveTo(185, 308, 217, 275, 232, 246);
  p.closePath();
}

function ribbon(x) {
  return draw((p) => {
    p.moveTo(x - 17, 245);
    p.quadraticCurveTo(x - 45, 330, x - 5, 395);
    p.quadraticCurveTo(x + 25, 445, x - 12, 485);
    p.lineTo(x + 18, 485);
    p.quadraticCurveTo(x + 55, 440, x + 25, 395);
    p.quadraticCurveTo(x - 10, 330, x + 17, 245);
    p.closePath();
  });
}

export const SHAPES = [
  {
    id: 'sakana', name: 'さかな', color: '#ffb347',
    motion: 'swim', amp: 0.09, speed: 1, size: 1,
    parts: [
      ellipse(430, 250, 250, 135),
      poly(215, 250, 70, 110, 95, 250, 70, 390),
      draw((p) => { p.moveTo(340, 150); p.quadraticCurveTo(400, 40, 540, 90); p.lineTo(560, 150); p.closePath(); }),
      draw((p) => { p.moveTo(400, 365); p.quadraticCurveTo(430, 455, 520, 440); p.lineTo(500, 365); p.closePath(); }),
    ],
    eyes: [[585, 215, 22]],
  },
  {
    id: 'fugu', name: 'フグ', color: '#ffe066',
    motion: 'swim', amp: 0.035, speed: 0.55, size: 0.85, puff: true,
    parts: [
      ellipse(420, 260, 185, 185),
      poly(265, 260, 105, 175, 135, 260, 105, 345),
      draw((p) => { p.moveTo(370, 95); p.quadraticCurveTo(410, 25, 475, 90); p.closePath(); }),
      ...spikes(420, 260, 178, 222, 18, (a) => Math.abs(a - Math.PI) < 0.55 || a < 0.35 || a > Math.PI * 2 - 0.35),
    ],
    eyes: [[515, 215, 26]],
  },
  {
    id: 'same', name: 'サメ', color: '#9ec9ff',
    motion: 'swim', amp: 0.05, speed: 1.5, size: 1.15,
    parts: [
      ellipse(450, 270, 300, 95),
      poly(380, 200, 450, 60, 530, 190),
      poly(195, 270, 60, 115, 115, 275, 70, 405),
      poly(480, 320, 560, 435, 600, 330),
    ],
    eyes: [[650, 245, 15]],
  },
  {
    id: 'tako', name: 'タコ', color: '#ff8fa3',
    motion: 'float', amp: 0.06, speed: 0.8, size: 0.9, pulse: 2.3,
    parts: [octopus],
    eyes: [[340, 200, 19], [460, 200, 19]],
  },
  {
    id: 'kurage', name: 'クラゲ', color: '#d7b8ff',
    motion: 'float', amp: 0.08, speed: 0.6, size: 0.85, pulse: 3.2,
    parts: [
      draw((p) => {
        p.moveTo(220, 250);
        p.ellipse(400, 250, 180, 175, 0, Math.PI, Math.PI * 2);
        for (let x = 580; x > 220; x -= 90) p.quadraticCurveTo(x - 45, 292, x - 90, 250);
        p.closePath();
      }),
      ribbon(285), ribbon(365), ribbon(445), ribbon(525),
    ],
    eyes: [[345, 185, 16], [455, 185, 16]],
  },
];

export const shapeById = (id) => SHAPES.find((s) => s.id === id) || SHAPES[0];

export function partPaths(shape) {
  return shape.parts.map((fn) => { const p = new Path2D(); fn(p); return p; });
}

// かたちを fillStyle でぬる（S 倍の大きさのキャンバスに）
export function fillShape(ctx, shape, style, S = 1) {
  ctx.save();
  ctx.setTransform(S, 0, 0, S, 0, 0);
  ctx.fillStyle = style;
  for (const p of partPaths(shape)) ctx.fill(p);
  ctx.restore();
}

// 外がわだけの りんかく線 と 目 をかく
export function drawOutline(ctx, shape, S = 1, lineW = 7, color = '#333') {
  const c = ctx.canvas;
  const tmp = document.createElement('canvas');
  tmp.width = c.width; tmp.height = c.height;
  const t = tmp.getContext('2d');
  t.setTransform(S, 0, 0, S, 0, 0);
  t.lineJoin = 'round';
  t.lineWidth = lineW * 2;
  t.strokeStyle = color;
  const paths = partPaths(shape);
  for (const p of paths) t.stroke(p);
  t.globalCompositeOperation = 'destination-out';
  for (const p of paths) t.fill(p);
  ctx.drawImage(tmp, 0, 0);
  drawEyes(ctx, shape, S);
}

export function drawEyes(ctx, shape, S = 1) {
  ctx.save();
  ctx.setTransform(S, 0, 0, S, 0, 0);
  for (const [x, y, r] of shape.eyes) {
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(x + r * 0.18, y + r * 0.05, r * 0.58, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x + r * 0.35, y - r * 0.22, r * 0.2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// かたちのはんい（えのせかいの座標）
const boxCache = new Map();
export function shapeBox(shape, pad = 10) {
  const key = shape.id + ':' + pad;
  if (boxCache.has(key)) return boxCache.get(key);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  fillShape(ctx, shape, '#000');
  const d = ctx.getImageData(0, 0, W, H).data;
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (d[(y * W + x) * 4 + 3] > 10) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  const b = {
    x: Math.max(0, x0 - pad), y: Math.max(0, y0 - pad),
    w: Math.min(W, x1 + pad) - Math.max(0, x0 - pad),
    h: Math.min(H, y1 + pad) - Math.max(0, y0 - pad),
  };
  boxCache.set(key, b);
  return b;
}

// ボタン用の小さな絵
export function shapeIcon(shape, size = 96) {
  const b = shapeBox(shape, 12);
  const s = size / Math.max(b.w, b.h);
  const c = document.createElement('canvas');
  c.width = Math.round(b.w * s); c.height = Math.round(b.h * s);
  const ctx = c.getContext('2d');
  const big = document.createElement('canvas');
  big.width = W * s; big.height = H * s;
  const bctx = big.getContext('2d');
  fillShape(bctx, shape, shape.color, s);
  drawOutline(bctx, shape, s, 9);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(big, -b.x * s, -b.y * s);
  return c;
}
