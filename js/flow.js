// Akış paneli: bu saatin seed'inden gelen formu gösterir.
// Şu an ne çaldığı, saatin haritası ve sıradaki giriş/çıkışlar.
import { parts } from './time.js';
import { makeSegment, NAMES } from './music.js';

const NN = ['Do', 'Do#', 'Re', 'Mi♭', 'Mi', 'Fa', 'Fa#', 'Sol', 'La♭', 'La', 'Si♭', 'Si'];
const pad2 = (n) => String(n).padStart(2, '0');

function items(x, minor) {
  if (!x || x.sil) return [];
  const out = [];
  if (x.lead) out.push(`${NAMES[x.lead]} solo`);
  if (x.ans) out.push(`${NAMES[x.ans]} cevap`);
  if (x.drums) out.push('davul');
  if (x.bass) out.push('bas');
  if (x.arp) out.push(minor ? 'eşlik' : 'akorlar');
  if (x.pad) out.push('pad');
  return out;
}

function silenceLabel(seg) {
  return seg.P.birds ? 'Nefes (sadece kuşlar)' : 'Sessizlik';
}

function describeChange(prev, x, seg) {
  if (x.sil) return silenceLabel(seg);
  const now = items(x, seg.minor), before = items(prev, seg.minor);
  if (!prev || prev.sil) return (prev ? 'Yeniden başlıyor: ' : '') + now.join(' · ');
  const add = now.filter((i) => !before.includes(i)).map((i) => `${i} girer`);
  const rem = before.filter((i) => !now.includes(i)).map((i) => `${i} çıkar`);
  return [...add, ...rem].join(' · ') || 'devam';
}

const cap = (t) => t.charAt(0).toLocaleUpperCase('tr-TR') + t.slice(1);
const fmtDur =(s) => `${Math.floor(s / 60)}:${pad2(Math.floor(s % 60))}`;

export function mountFlow(btn, panel, onToggle) {
  let seg = null, timer = 0;
  const body = panel.querySelector('.body');

  function currentSegment(p) {
    if (!seg || seg.hour !== p.h || seg.day !== p.d) seg = makeSegment(p);
    return seg;
  }

  function render() {
    const p = parts();
    const s = currentSegment(p);
    const elapsed = p.mi * 60 + p.s + p.ms / 1000;
    const step = Math.floor(elapsed / s.eighth);
    let si = 0;
    while (si < s.form.length - 1 && s.bounds[si + 1] <= step) si++;
    const x = s.form[si];
    const secStart = s.bounds[si] * s.eighth, secEnd = (s.bounds[si] + x.len * 32) * s.eighth;
    const left = Math.max(0, secEnd - elapsed), prog = Math.min(1, (elapsed - secStart) / (secEnd - secStart));
    const scale = s.minor ? `${NN[s.root % 12]} armonik minör (Hicaz çeşnili)` : `${NN[s.root % 12]} majör`;
    const hh = pad2(p.h), hn = pad2((p.h + 1) % 24);

    // Saatin haritası: her bölüm, katman sayısına göre koyuluk
    const hourEnd = 3600 / s.eighth;
    let strip = '';
    for (let i = 0; i < s.form.length && s.bounds[i] < hourEnd; i++) {
      const f = s.form[i], w = (Math.min(f.len * 32, hourEnd - s.bounds[i]) / hourEnd) * 100;
      const n = items(f, s.minor).length;
      const a = f.sil ? 0 : 0.18 + n * 0.14;
      strip += `<i style="width:${w}%;background:rgba(255,190,130,${a})${i === si ? ';outline:1px solid #f0eee8' : ''}"></i>`;
    }
    const head = `<b style="left:${(elapsed / 3600) * 100}%"></b>`;

    // Sıradaki değişiklikler
    let next = '';
    for (let i = si + 1, c = 0; i < s.form.length && c < 8; i++, c++) {
      const t = s.bounds[i] * s.eighth;
      if (t >= 3600) break;
      const mm = Math.floor(t / 60), ss = Math.floor(t % 60);
      const f = s.form[i];
      const dur = f.sil ? ` (${Math.round(f.len * 32 * s.eighth)} sn)` : '';
      next += `<li><span>${hh}:${pad2(mm)}:${pad2(ss)}</span>${cap(describeChange(s.form[i - 1], f, s))}${dur}</li>`;
    }

    body.innerHTML = `
      <div class="t">${s.P.name} · ${hh}:00–${hn}:00</div>
      <div class="m">${scale} · ${s.bpm} bpm · akorlar: ${NAMES[s.comp]}</div>
      <div class="now">
        <div class="lbl">Şimdi</div>
        <div>${x.sil ? silenceLabel(s) : cap(items(x, s.minor).join(' · '))}</div>
        <div class="bar"><i style="width:${prog * 100}%"></i></div>
        <div class="m">${fmtDur(left)} sonra değişiyor</div>
      </div>
      <div class="lbl">Bu saatin haritası</div>
      <div class="strip">${strip}${head}</div>
      <div class="lbl">Sıradakiler</div>
      <ul>${next || '<li>Bu saatin sonuna geldik, yeni saatle yeni bir form başlayacak.</li>'}</ul>`;
  }

  function open(v) {
    panel.hidden = !v;
    btn.setAttribute('aria-expanded', String(v));
    clearInterval(timer);
    if (v) { render(); timer = setInterval(render, 500); }
    if (onToggle) onToggle(v);
  }

  btn.addEventListener('click', () => open(panel.hidden));
  panel.querySelector('.close').addEventListener('click', () => open(false));
  return { isOpen: () => !panel.hidden };
}
