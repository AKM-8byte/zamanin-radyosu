// Zaman, seed ve rastgelelik yardımcıları.
// Aynı yerel tarih + saat herkes için aynı seed'i üretir.

let offsetMs = 0;
let momentStart = null; // ?an= ile paylaşılan bir anı dinliyorsak o anın tarihi

// ?an=2026-11-12T02:30 paylaşılan bir anı birebir yeniden çalar.
// ?saat=02:30 ise bugünün o saatine gider (test için).
(function readOverride() {
  try {
    const params = new URLSearchParams(location.search);
    const an = params.get('an');
    const am = an && an.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (am) {
      const t = new Date(+am[1], +am[2] - 1, +am[3], +am[4], +am[5], am[6] ? +am[6] : 0, 0);
      if (!isNaN(t)) { offsetMs = t.getTime() - Date.now(); momentStart = t; return; }
    }
    const q = params.get('saat');
    if (!q) return;
    const m = q.match(/^(\d{1,2})(?::(\d{2}))?$/);
    if (!m) return;
    const target = new Date();
    target.setHours(+m[1] % 24, m[2] ? +m[2] : 0, 0, 0);
    offsetMs = target.getTime() - Date.now();
  } catch (_) { /* yoksay */ }
})();

export function now() {
  return new Date(Date.now() + offsetMs);
}

export function sharedMoment() {
  return momentStart;
}

// Şu anın paylaşılabilir bağlantısı (yerel saat, dakika hassasiyetinde).
export function momentLink(d = now()) {
  const p = (n) => String(n).padStart(2, '0');
  const an = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  return `${location.origin}${location.pathname}?an=${an}`;
}

export function parts(d = now()) {
  return {
    y: d.getFullYear(), mo: d.getMonth() + 1, d: d.getDate(),
    h: d.getHours(), mi: d.getMinutes(), s: d.getSeconds(), ms: d.getMilliseconds(),
    date: d,
  };
}

export function hourFloat(d = now()) {
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
}

// 0 = gece 03:00 civarı (en karanlık), 1 = 15:00 civarı (en aydınlık)
export function mood(h) {
  return (1 - Math.cos(((h - 3) / 24) * 2 * Math.PI)) / 2;
}

export function rng(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash(...nums) {
  let h = 2166136261 >>> 0;
  for (const n of nums) {
    h ^= n | 0;
    h = Math.imul(h, 16777619);
    h ^= h >>> 13;
  }
  return h >>> 0;
}

// Gerçek ay evresi: 0 = yeni ay, 0.5 = dolunay
export function moonPhase(d = now()) {
  const days = (d.getTime() - Date.UTC(2000, 0, 6, 18, 14)) / 864e5;
  return ((days % 29.530588) + 29.530588) % 29.530588 / 29.530588;
}
