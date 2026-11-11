// Tanılama paneli: adrese ?tani eklenince açılır.
// Telefonda ses takılmasının kaynağını bulmak için şüphelileri tek tek kapatır.

export function mount(engine, scene) {
  const box = document.createElement('div');
  box.id = 'diag';
  box.innerHTML = `
    <div class="h">Tanılama</div>
    <div id="dg-info"></div>
    <label><input type="checkbox" id="dg-rev" checked> Yankı (reverb)</label>
    <label><input type="checkbox" id="dg-sus" checked> Rüzgâr ve nefes sesleri</label>
    <label><input type="checkbox" id="dg-vis" checked> Görsel animasyon</label>
    <label><input type="checkbox" id="dg-dpr" checked> Yüksek çözünürlük</label>
    <a id="dg-route"></a>`;
  document.body.appendChild(box);
  box.addEventListener('click', (e) => e.stopPropagation());

  const css = document.createElement('style');
  css.textContent = `#diag{position:fixed;top:12px;right:12px;z-index:9;background:rgba(0,0,0,.72);color:#f0eee8;
    font:12px/1.5 system-ui,sans-serif;padding:10px 12px;border-radius:10px;max-width:250px}
    #diag .h{font-weight:600;margin-bottom:4px}#diag label{display:block;margin-top:4px}
    #diag a{display:block;margin-top:8px;color:#ffb347}`;
  document.head.appendChild(css);

  const q = new URLSearchParams(location.search);
  const direct = q.get('yol') === 'direkt';
  const route = box.querySelector('#dg-route');
  q.set('yol', direct ? 'oge' : 'direkt');
  route.href = '?' + q.toString();
  route.textContent = direct ? 'Ses yolunu <audio> öğesine çevir (yeniden yükler)' : 'Sesi doğrudan çıkışa ver (yeniden yükler)';

  const on = (id, fn) => box.querySelector(id).addEventListener('change', (e) => fn(e.target.checked));
  on('#dg-rev', (v) => engine.ready && engine.setReverb(v));
  on('#dg-sus', (v) => engine.ready && engine.setSustained(v));
  on('#dg-vis', (v) => { scene.frozen = !v; });
  on('#dg-dpr', (v) => { scene.maxDpr = v ? 2 : 1; scene.resize(); });

  // Kare süresi ölçümü
  let frames = 0, t0 = performance.now(), fps = 0, worst = 0, prev = t0;
  (function tick(t) {
    frames++; worst = Math.max(worst, t - prev); prev = t;
    if (t - t0 > 1000) { fps = Math.round((frames * 1000) / (t - t0)); frames = 0; t0 = t; }
    requestAnimationFrame(tick);
  })(t0);

  const info = box.querySelector('#dg-info');
  setInterval(() => {
    const ctx = engine.ready ? window.Tone.getContext().rawContext : null;
    const st = ctx && ctx.playoutStats;
    const lines = [
      `Çekirdek: ${navigator.hardwareConcurrency || '?'} · Bellek: ${navigator.deviceMemory || '?'} GB`,
      ctx ? `Örnekleme: ${ctx.sampleRate} Hz · Gecikme: ${Math.round((ctx.baseLatency || 0) * 1000)}/${Math.round((ctx.outputLatency || 0) * 1000)} ms` : 'Ses henüz başlamadı',
      `Ses yolu: ${engine.ready ? (engine.viaElement ? 'audio öğesi' : 'doğrudan') : '-'}`,
      `Görsel: ${fps} kare/sn · en kötü kare ${Math.round(worst)} ms`,
    ];
    if (st) lines.push(`Ses kesintisi: ${st.fallbackFramesEvents ?? '?'} kez`);
    info.innerHTML = lines.join('<br>');
    worst = 0;
  }, 1000);
}
