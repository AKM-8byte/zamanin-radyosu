// Zaman, seed ve rastgelelik yardımcıları.
// Aynı yerel tarih + saat herkes için aynı seed'i üretir.

let offsetMs = 0;

// ?saat=02:30 ile saati test için kaydırmaya izin ver.
(function readOverride() {
  try {
    const q = new URLSearchParams(location.search).get('saat');
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
