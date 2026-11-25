// これまでの え：Firestore にのこっている絵を あたらしい順にならべる
import { shapeById } from './shapes.js';
import { createNet, ROOM, LOCAL, params } from './net.js';

const PAGE = 60;
const JSZIP = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
const WEEK = ['日', '月', '火', '水', '木', '金', '土'];

const $ = (id) => document.getElementById(id);
const items = [];        // 読みこんだ絵（あたらしい順）
const days = new Map();  // 'YYYY-MM-DD' → { el, grid, count }
let net = null;
let hasMore = true;
let loading = null;
let viewIndex = -1;

const pad = (n) => String(n).padStart(2, '0');
const dayKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const dayLabel = (t) => { const d = new Date(t); return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${WEEK[d.getDay()]}）`; };
const timeLabel = (t) => { const d = new Date(t); return `${d.getHours()}:${pad(d.getMinutes())}`; };
const fileName = (f) => {
  const d = new Date(f.t);
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `fish_${stamp}_${f.shape || 'sakana'}_${String(f.id).slice(0, 4)}.png`;
};
const toast = (t, ms = 2500) => {
  const el = $('toast'); el.textContent = t; el.style.display = 'block';
  clearTimeout(toast.timer); toast.timer = setTimeout(() => { el.style.display = 'none'; }, ms);
};

// ---------- ならべる ----------
function dayGroup(t) {
  const key = dayKey(t);
  if (days.has(key)) return days.get(key);
  const el = document.createElement('section');
  el.className = 'day';
  el.innerHTML = `<div class="dayHead"><h2></h2><span class="count"></span><button class="btn">この日を ほぞん（zip）</button></div><div class="grid"></div>`;
  el.querySelector('h2').textContent = dayLabel(t);
  const g = { el, grid: el.querySelector('.grid'), count: 0, key };
  el.querySelector('button').onclick = (e) => saveDay(key, e.currentTarget);
  $('list').appendChild(el);
  days.set(key, g);
  return g;
}

function addTile(f) {
  const i = items.length;
  items.push(f);
  const g = dayGroup(f.t);
  const b = document.createElement('button');
  b.className = 'tile';
  b.title = `${timeLabel(f.t)} ${shapeById(f.shape).name}`;
  const img = document.createElement('img');
  img.loading = 'lazy';
  img.alt = `${timeLabel(f.t)} の ${shapeById(f.shape).name}`;
  img.src = f.img;
  const tm = document.createElement('span');
  tm.className = 'time';
  tm.textContent = `${timeLabel(f.t)}・${shapeById(f.shape).name}`;
  b.append(img, tm);
  b.onclick = () => openView(i);
  g.grid.appendChild(b);
  g.count++;
  g.el.querySelector('.count').textContent = `${g.count} まい${hasMore ? '〜' : ''}`;
}

function refreshMeta() {
  $('meta').textContent = `うみ「${ROOM}」${LOCAL ? '（ローカル）' : ''}・${items.length} まい${hasMore ? ' 以上' : ''}`;
  $('more').hidden = !hasMore;
  $('empty').style.display = !items.length && !hasMore ? 'block' : 'none';
  for (const g of days.values()) g.el.querySelector('.count').textContent = `${g.count} まい`;
  // いちばん古い日は、まだ続きがあるかもしれない
  const last = items[items.length - 1];
  if (hasMore && last) {
    const g = days.get(dayKey(last.t));
    g.el.querySelector('.count').textContent = `${g.count} まい〜`;
  }
}

function loadMore() {
  if (loading || !hasMore || !net) return loading;
  $('more').disabled = true;
  const before = items.length ? items[items.length - 1].t : null;
  loading = net.listFish(PAGE, before).then((list) => {
    for (const f of list) if (f.img && f.t) addTile(f);
    if (list.length < PAGE) hasMore = false;
  }).catch((e) => {
    $('err').style.display = 'block';
    $('err').textContent = 'よみこめませんでした: ' + e.message;
    hasMore = false;
  }).finally(() => {
    loading = null;
    $('more').disabled = false;
    refreshMeta();
  });
  return loading;
}

async function loadAll(untilT = -Infinity) {
  while (hasMore && (!items.length || items[items.length - 1].t >= untilT)) {
    await loadMore();
  }
}

// ---------- 大きく見る ----------
function openView(i) {
  viewIndex = i;
  const f = items[i];
  $('viewImg').src = f.img;
  $('viewImg').alt = `${timeLabel(f.t)} の ${shapeById(f.shape).name}`;
  $('viewInfo').textContent = `${dayLabel(f.t)} ${timeLabel(f.t)}・${shapeById(f.shape).name}（${i + 1} / ${items.length}${hasMore ? '〜' : ''}）`;
  $('prev').style.visibility = i > 0 ? 'visible' : 'hidden';
  $('next').style.visibility = i < items.length - 1 || hasMore ? 'visible' : 'hidden';
  $('view').classList.add('show');
}
const closeView = () => { $('view').classList.remove('show'); viewIndex = -1; };
async function step(d) {
  if (viewIndex < 0) return;
  const j = viewIndex + d;
  if (j >= items.length && hasMore) await loadMore();
  if (j >= 0 && j < items.length) openView(j);
}
$('close').onclick = closeView;
$('prev').onclick = () => step(-1);
$('next').onclick = () => step(1);
$('view').addEventListener('click', (e) => { if (e.target === $('view')) closeView(); });
addEventListener('keydown', (e) => {
  if (viewIndex < 0) return;
  if (e.key === 'Escape') closeView();
  if (e.key === 'ArrowLeft') step(-1);
  if (e.key === 'ArrowRight') step(1);
});

// ---------- ほぞん ----------
const toBlob = (dataUrl) => {
  const [head, b64] = dataUrl.split(',');
  const mime = (head.match(/data:([^;]+)/) || [])[1] || 'image/png';
  const bin = atob(b64);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Blob([u], { type: mime });
};
function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
$('viewSave').onclick = () => { const f = items[viewIndex]; if (f) download(toBlob(f.img), fileName(f)); };

let zipLib = null;
function loadZip() {
  if (window.JSZip) return Promise.resolve(window.JSZip);
  zipLib ||= new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = JSZIP;
    s.onload = () => res(window.JSZip);
    s.onerror = () => { zipLib = null; rej(new Error('zip の道具を読みこめませんでした')); };
    document.head.appendChild(s);
  });
  return zipLib;
}
async function saveZip(list, name, btn) {
  if (!list.length) { toast('ほぞんする え がありません'); return; }
  const old = btn.textContent;
  btn.disabled = true; btn.textContent = 'じゅんび中…';
  try {
    const JSZip = await loadZip();
    const zip = new JSZip();
    for (const f of list) zip.file(fileName(f), f.img.split(',')[1], { base64: true });
    const blob = await zip.generateAsync({ type: 'blob' });
    download(blob, name);
    toast(`${list.length} まい ほぞんしました`);
  } catch (e) {
    toast('ほぞんできませんでした: ' + e.message, 5000);
  } finally {
    btn.disabled = false; btn.textContent = old;
  }
}
async function saveDay(key, btn) {
  const [y, m, d] = key.split('-').map(Number);
  const start = new Date(y, m - 1, d).getTime();
  btn.disabled = true; btn.textContent = 'よみこみ中…';
  await loadAll(start);
  saveZip(items.filter((f) => dayKey(f.t) === key), `fish_${ROOM}_${key}.zip`, btn);
}
$('saveAll').onclick = async (e) => {
  const btn = e.currentTarget;
  btn.disabled = true; btn.textContent = 'よみこみ中…';
  await loadAll();
  await saveZip(items, `fish_${ROOM}_all.zip`, btn);
  btn.textContent = 'ぜんぶ ほぞん（zip）';
};

// ---------- うみの名前 ----------
$('roomInput').value = ROOM;
$('roomForm').onsubmit = (e) => {
  e.preventDefault();
  const p = new URLSearchParams(params);
  const v = $('roomInput').value.trim();
  if (v && v !== 'umi') p.set('room', v); else p.delete('room');
  const q = p.toString().replace(/=(?=&|$)/g, '');
  location.search = q ? '?' + q : '';
};

// ---------- はじめ ----------
$('more').onclick = () => loadMore();
new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) loadMore(); }, { rootMargin: '400px' })
  .observe($('more'));

createNet({ onError: (e) => toast('つうしん エラー: ' + e.message, 5000) })
  .then((n) => { net = n; return loadMore(); })
  .catch((e) => {
    $('err').style.display = 'block';
    $('err').textContent = e.message;
    hasMore = false;
    refreshMeta();
  });

if (params.has('test')) window.__gallery = { items, loadMore, loadAll, openView, fileName };
