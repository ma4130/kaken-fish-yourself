// かく画面（タブレット）と うつす画面をつなぐ通信。
//   ふつう      : Firestore  fish_seas/{room}/fish/{id}
//   ?local つき : 同じブラウザのタブどうしだけ（BroadcastChannel）。テスト用。
import { firebaseConfig } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';

export const params = new URLSearchParams(location.search);
export const ROOM = (params.get('room') || 'umi').replace(/[^\w-]/g, '').slice(0, 40) || 'umi';
export const LOCAL = params.has('local');

export async function createNet({ onError = () => {} } = {}) {
  if (LOCAL) return localNet(ROOM);
  if (!firebaseConfig) throw new Error('firebase-config.js がまだ設定されていません');
  return firestoreNet(ROOM, onError);
}

async function firestoreNet(room, onError) {
  const [{ initializeApp }, fs] = await Promise.all([
    import(`${SDK}/firebase-app.js`),
    import(`${SDK}/firebase-firestore.js`),
  ]);
  const db = fs.getFirestore(initializeApp(firebaseConfig));
  const fish = fs.collection(db, 'fish_seas', room, 'fish');
  return {
    sendFish: (data) => fs.addDoc(fish, data),
    // あたらしい順に max ひき
    onFish: (max, cb) => fs.onSnapshot(
      fs.query(fish, fs.orderBy('t', 'desc'), fs.limit(max)),
      (s) => { const list = []; s.forEach((d) => list.push({ id: d.id, ...d.data() })); cb(list); },
      onError,
    ),
    // これまでの絵：あたらしい順に n まい。before（t の値）より前から
    listFish: async (n, before = null) => {
      const q = before == null
        ? fs.query(fish, fs.orderBy('t', 'desc'), fs.limit(n))
        : fs.query(fish, fs.orderBy('t', 'desc'), fs.startAfter(before), fs.limit(n));
      const s = await fs.getDocs(q);
      const list = [];
      s.forEach((d) => list.push({ id: d.id, ...d.data() }));
      return list;
    },
  };
}

function localNet(room) {
  const ch = new BroadcastChannel('fish-' + room);
  const KEY = 'fish-local-' + room;
  const KEEP = 12; // localStorage は小さいので少しだけ
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
  const cbs = [];
  const fire = () => {
    const all = read();
    for (const { max, cb } of cbs) cb(all.slice(0, max));
  };
  ch.onmessage = fire;
  return {
    sendFish: async (data) => {
      const all = read();
      const doc = { id: 'L' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ...data };
      all.unshift(doc);
      try { localStorage.setItem(KEY, JSON.stringify(all.slice(0, KEEP))); }
      catch { localStorage.setItem(KEY, JSON.stringify(all.slice(0, 3))); }
      ch.postMessage('fish');
      setTimeout(fire, 0);
      return doc;
    },
    onFish: (max, cb) => { cbs.push({ max, cb }); setTimeout(fire, 0); return () => {}; },
    listFish: async (n, before = null) => read().filter((d) => before == null || d.t < before).slice(0, n),
  };
}
