// Ufuk sahnesi: gökyüzü, güneş/ay, deniz, müziğe tepki veren dalgalar,
// giriş animasyonu ve durdurma görünümü.
import { now, hourFloat, mood, moonPhase } from './time.js';

const KEYS = [
  [0, '#030407', '#0a0d16', '#3a4560', '#c9d2e8'],
  [3, '#020305', '#07090f', '#2a3350', '#aab4cc'],
  [5, '#0a0c1c', '#2a1f3a', '#4a4a70', '#d0c8e0'],
  [6.5, '#1c1f3e', '#e0703a', '#f0a070', '#ff8a3d'],
  [8, '#3b5a8a', '#f4a35c', '#ffd0a0', '#ffb347'],
  [12, '#5b86b8', '#f7d9a8', '#fff0d8', '#fff2c0'],
  [17, '#3f4f80', '#f08a4b', '#ffc090', '#ff7a3a'],
  [19, '#1a1630', '#6a3050', '#c08090', '#e07060'],
  [21.5, '#07080f', '#141428', '#485070', '#c9d2e8'],
  [24, '#030407', '#0a0d16', '#3a4560', '#c9d2e8'],
];
const MOON = [232, 236, 245];
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.substr(i, 2), 16));
const KEYS_RGB = KEYS.map((k) => [k[0], ...k.slice(1).map(hex)]);
const rgb = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const seg = (x, a, b) => { const v = Math.max(0, Math.min(1, (x - a) / (b - a))); return v * v * (3 - 2 * v); };

function palette(h) {
  let i = 0;
  while (KEYS_RGB[i + 1][0] <= h) i++;
  const a = KEYS_RGB[i], b = KEYS_RGB[i + 1], f = (h - a[0]) / (b[0] - a[0]);
  return [1, 2, 3, 4].map((j) => a[j].map((v, k) => Math.round(v + (b[j][k] - v) * f)));
}

export class Scene {
  constructor(canvas, getBands) {
    this.cv = canvas;
    this.g = canvas.getContext('2d');
    this.getBands = getBands;
    this.started = false;
    this.t0 = 0;
    this.ip = 0;          // giriş ilerlemesi 0..1
    this.paused = false;
    this.spd = 1; this.dim = 0; this.wt = 0; this.last = 0;
    this.sm = [0.12, 0.08, 0.05];
    this.ripples = [];
    this.onFrame = null;
    this.resize();
    addEventListener('resize', () => this.resize());
    requestAnimationFrame((ts) => this.draw(ts));
  }

  resize() {
    const dpr = Math.min(devicePixelRatio || 1, this.maxDpr || 2);
    this.W = innerWidth; this.H = innerHeight;
    this.cv.width = Math.round(this.W * dpr);
    this.cv.height = Math.round(this.H * dpr);
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.HZ = this.H * 0.58;
    this.k = Math.max(0.55, Math.min(this.W / 1360, this.H / 720) * 1.05);
    const n = Math.round(Math.min(220, (this.W * this.HZ) / 5000));
    this.stars = Array.from({ length: n }, () => ({ x: Math.random() * this.W, y: Math.random() * this.HZ * 0.9, s: Math.random() }));
  }

  begin() { this.started = true; this.t0 = performance.now(); }
  reset() { this.started = false; this.ip = 0; }
  get introDone() { return this.started && performance.now() - this.t0 >= 6000; }
  setPaused(p) { this.paused = p; }
  note() { this.ripples.push({ r: 0, a: 1 }); }

  bands(t) {
    const b = this.getBands ? this.getBands() : null;
    const v = b || (() => { const s = 0.12 + 0.08 * Math.sin(t * 0.8); return [s, s * 0.7, s * 0.4]; })();
    this.sm = this.sm.map((x, i) => x + (v[i] - x) * 0.08);
    return this.sm;
  }

  drawSun(cx, cy, r, c, lo) {
    const g = this.g;
    const glow = g.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 2.6);
    glow.addColorStop(0, rgb(c, 0.22 + lo * 0.25)); glow.addColorStop(1, rgb(c, 0));
    g.fillStyle = glow; g.beginPath(); g.arc(cx, cy, r * 2.6, 0, 7); g.fill();
    g.fillStyle = rgb(c, 0.95); g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
  }

  drawMoon(cx, cy, r, sky, lo, phase) {
    const g = this.g;
    const glow = g.createRadialGradient(cx, cy, r * 0.8, cx, cy, r * 3);
    glow.addColorStop(0, rgb(MOON, 0.1 + lo * 0.12)); glow.addColorStop(1, rgb(MOON, 0));
    g.fillStyle = glow; g.beginPath(); g.arc(cx, cy, r * 3, 0, 7); g.fill();
    g.save(); g.beginPath(); g.arc(cx, cy, r, 0, 7); g.clip();
    g.fillStyle = rgb(MOON, 0.96); g.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    g.fillStyle = 'rgba(180,185,200,0.25)';
    [[-0.3, -0.2, 0.22], [0.25, 0.3, 0.15], [0.1, -0.4, 0.1], [-0.1, 0.35, 0.12]].forEach((q) => {
      g.beginPath(); g.arc(cx + q[0] * r, cy + q[1] * r, q[2] * r, 0, 7); g.fill();
    });
    const wax = phase < 0.5, f = wax ? phase * 2 : (1 - phase) * 2, dx = (wax ? -1 : 1) * f * 2.05 * r;
    g.fillStyle = sky; g.beginPath(); g.arc(cx + dx, cy, r * 1.02, 0, 7); g.fill();
    g.restore();
  }

  fitFont(text, weight, size, maxW) {
    const g = this.g;
    g.font = `${weight} ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    const w = g.measureText(text).width;
    if (w > maxW) { size = (size * maxW) / w; g.font = `${weight} ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`; }
    return size;
  }

  draw(ts) {
    requestAnimationFrame((x) => this.draw(x));
    if (this.frozen) { this.last = ts / 1000; return; }
    const g = this.g, W = this.W, H = this.H, HZ = this.HZ, k = this.k;
    const t = ts / 1000, dt = Math.min(0.1, t - this.last); this.last = t;
    const d = now(), hour = hourFloat(d), phase = moonPhase(d);
    if (this.started) this.ip = Math.min(1, (ts - this.t0) / 6000);
    const ip = this.ip;
    this.spd += ((this.paused ? 0.08 : 1) - this.spd) * 0.03;
    this.dim += ((this.paused ? 1 : 0) - this.dim) * 0.05;
    this.wt += dt * this.spd;
    const wt = this.wt;

    const eLine = seg(ip, 0.02, 0.22), eSky = seg(ip, 0.15, 0.5), eRise = seg(ip, 0.3, 0.75),
      eWave = seg(ip, 0.4, 0.9), eText = seg(ip, 0.75, 1), ePrompt = 1 - seg(ip, 0, 0.08);
    const m = mood(hour), [lo, mi, hi] = this.bands(t), [top, hor, wav, sunC] = palette(hour);

    const sky = g.createLinearGradient(0, 0, 0, HZ);
    sky.addColorStop(0, rgb(top, 1)); sky.addColorStop(1, rgb(hor, 1));
    g.fillStyle = sky; g.fillRect(0, 0, W, HZ);

    const night = Math.max(0, 1 - m * 2.2);
    if (night > 0) {
      for (const s of this.stars) {
        g.fillStyle = `rgba(230,235,255,${night * (0.25 + s.s * 0.6) * (0.7 + 0.3 * Math.sin(wt * 2 + s.x) + hi)})`;
        const sz = (1 + s.s * 1.6) * Math.max(0.8, k);
        g.fillRect(s.x, s.y, sz, sz);
      }
    }

    const isSun = hour >= 5.5 && hour < 18.5;
    const p = isSun ? (hour - 5.5) / 13 : ((hour - 18.5 + 24) % 24) / 11;
    const q = Math.max(0, Math.min(1, p));
    const cx = W * 0.12 + q * W * 0.76;
    let cy = HZ - Math.sin(q * Math.PI) * HZ * 0.72 + (isSun ? 30 : 20) * k;
    const rad = isSun ? (55 + lo * 30) * k : (34 + lo * 10) * k;
    cy = HZ + rad * 1.2 + (cy - HZ - rad * 1.2) * eRise;
    let refl;
    if (isSun) { this.drawSun(cx, cy, rad, sunC, lo); refl = sunC; }
    else { this.drawMoon(cx, cy, rad, sky, lo, phase); refl = MOON; }

    const sea = hor.map((v) => Math.round(v * 0.35));
    const sg = g.createLinearGradient(0, HZ, 0, H);
    sg.addColorStop(0, rgb(sea, 1)); sg.addColorStop(1, rgb(top.map((v) => Math.round(v * 0.5)), 1));
    g.fillStyle = sg; g.fillRect(0, HZ, W, H - HZ);

    const ra = (isSun ? 0.18 + lo * 0.3 : (0.08 + lo * 0.15) * (0.3 + Math.sin(phase * Math.PI) * 0.7)) * eRise;
    g.fillStyle = rgb(refl, ra);
    const rows = 14, rh = (H - HZ) / 19;
    for (let i = 0; i < rows; i++) {
      const w = rad * (isSun ? 1.6 : 1.2) * (1 - i / 16) * (0.7 + 0.3 * Math.sin(wt * 1.5 + i * 1.3));
      g.fillRect(cx - w / 2, HZ + 8 * k + i * rh, w, (isSun ? 4 : 2.5) * k);
    }

    const gap = (H - HZ) / 8.5;
    for (let i = 0; i < 7; i++) {
      const amp = (14 + [lo, mi, hi][i % 3] * 150) * (1 - i * 0.08) * eWave * k;
      const y0 = HZ + gap * 0.8 + i * gap;
      g.strokeStyle = rgb(wav, (0.12 + 0.5 * (1 - i / 7) * (0.4 + lo + mi)) * seg(ip, 0.35 + i * 0.04, 0.6 + i * 0.04));
      g.lineWidth = 2.5 * Math.max(0.7, k);
      g.beginPath();
      for (let x = 0; x <= W + 6; x += 6) {
        const y = y0 + Math.sin((x / k) * 0.005 + wt * (0.25 + m * 0.9) + i * 0.9) * amp * Math.sin((x / W) * Math.PI);
        x ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
    }

    for (const r of this.ripples) {
      r.r += (2 + m * 2) * this.spd * k; r.a *= 0.98;
      g.strokeStyle = rgb(refl, r.a * (isSun ? 0.35 : 0.25) * eRise);
      g.lineWidth = 2 * Math.max(0.7, k);
      g.beginPath(); g.ellipse(cx, HZ + 4, r.r * 1.6, r.r * 0.25, 0, 0, 7); g.stroke();
    }
    this.ripples = this.ripples.filter((r) => r.a > 0.03);

    g.fillStyle = `rgba(0,0,0,${Math.max(1 - eSky, this.dim * 0.45)})`;
    g.fillRect(0, 0, W, H);

    if (eLine > 0) {
      const lw = W * eLine;
      g.fillStyle = `rgba(240,238,232,${0.85 * (1 - eSky * 0.85)})`;
      g.fillRect(W / 2 - lw / 2, HZ - 1, lw, 2);
    }

    const L = (top[0] * 0.3 + top[1] * 0.59 + top[2] * 0.11) * (1 - this.dim * 0.45);
    const tc = L > 120 ? [20, 20, 30] : [235, 232, 225];
    const hh = String(d.getHours()).padStart(2, '0'), mm = String(d.getMinutes()).padStart(2, '0');
    const pad = Math.max(20, 48 * k);
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillStyle = rgb(tc, 0.92 * eText);
    g.font = `500 ${Math.max(34, 64 * k)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    g.fillText(`${hh}:${mm}`, pad - (1 - eText) * 20, pad + Math.max(30, 56 * k));
    g.fillStyle = rgb(tc, 0.6 * eText);
    g.font = `${Math.max(15, 28 * k)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    g.fillText(d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' }), pad + 2 - (1 - eText) * 20, pad + Math.max(56, 100 * k));

    if (ePrompt > 0) {
      const pa = ePrompt * (0.65 + 0.35 * Math.sin(t * 1.8));
      g.textAlign = 'center';
      g.fillStyle = `rgba(240,238,232,${pa})`;
      const fs = this.fitFont('Oynatmak için dokunun', 500, 76 * Math.max(k, 0.7), W * 0.86);
      g.fillText('Oynatmak için dokunun', W / 2, H / 2 + fs * 0.15);
      g.fillStyle = `rgba(240,238,232,${pa * 0.5})`;
      this.fitFont('kulaklıkla dinlemen önerilir', 400, Math.max(15, fs * 0.34), W * 0.86);
      g.fillText('kulaklıkla dinlemen önerilir', W / 2, H / 2 + fs * 0.85);
    }

    if (this.dim > 0.02) {
      const pa = this.dim * (0.7 + 0.3 * Math.sin(t * 1.8));
      const s = Math.max(0.7, k), y = H * 0.3;
      g.fillStyle = `rgba(240,238,232,${pa})`;
      g.fillRect(W / 2 - 22 * s, y - 30 * s, 14 * s, 60 * s);
      g.fillRect(W / 2 + 8 * s, y - 30 * s, 14 * s, 60 * s);
      g.textAlign = 'center';
      g.fillStyle = `rgba(240,238,232,${pa * 0.6})`;
      g.font = `${Math.max(15, 26 * k)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
      g.fillText('devam etmek için dokun', W / 2, y + 80 * s);
    }

    if (this.onFrame) this.onFrame();
  }
}
