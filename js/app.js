// Uygulama: giriş, durdurma, ses kontrolü, imza, kilit ekranı kontrolleri,
// uygulama olarak yükleme.
import { Scene } from './scene.js';
import { Engine } from './music.js';
import { now, sharedMoment, momentLink } from './time.js';
import { mountFlow } from './flow.js';

const cv = document.getElementById('scene');
const audioEl = document.getElementById('out');
const credit = document.getElementById('credit');
const controls = document.getElementById('controls');
const range = document.getElementById('volume');
const muteBtn = document.getElementById('mute');
const installBtn = document.getElementById('install');

const engine = new Engine();
const scene = new Scene(cv, () => engine.getBands());
engine.onNote = () => scene.note();
window.radyo = { engine, scene }; // tarayıcı konsolundan inceleme için

// --- Ortak dinleme: açıklama satırı ve paylaşılan anlar -------------------

const shared = sharedMoment();
const fmtMoment = (d) => d.toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
if (shared) {
  scene.subtitle = `${fmtMoment(shared)} anını dinliyorsun`;
  const m = document.getElementById('moment');
  m.innerHTML = `${fmtMoment(shared)} anı · <span>canlıya dön</span>`;
  m.hidden = false;
} else {
  scene.subtitle = 'bu saatte dinleyen herkes aynı müziği duyuyor';
}

const toast = document.getElementById('toast');
let toastTimer = 0;
function showToast(text) {
  toast.textContent = text;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

// Panoya kopyala: önce Clipboard API, olmazsa eski execCommand yolu.
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (_) { /* yedek yola geç */ }
  const ta = document.createElement('textarea');
  ta.value = text; ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:-100px;opacity:0';
  document.body.appendChild(ta); ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
  ta.remove();
  return ok;
}

const linkbox = document.getElementById('linkbox');
const linkInput = linkbox.querySelector('input');
function showLinkbox(url) {
  linkInput.value = url;
  linkbox.hidden = false;
  linkInput.focus(); linkInput.select();
}
linkbox.querySelector('button').addEventListener('click', () => { linkbox.hidden = true; });

// Telefonda paylaşım menüsü; bilgisayarda doğrudan kopyala
// (Windows'ta paylaşım menüsü açılıp kafa karıştırıyordu).
const touchDevice = matchMedia('(pointer: coarse)').matches;
document.getElementById('share').addEventListener('click', async () => {
  const url = momentLink(now());
  if (touchDevice && navigator.share) {
    try { await navigator.share({ title: 'Zamanın Radyosu', text: 'Şu an bunu dinliyorum', url }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  if (await copyText(url)) showToast('Bağlantı kopyalandı');
  else showLinkbox(url);
});
if (new URLSearchParams(location.search).has('tani')) import('./diag.js').then((m) => m.mount(engine, scene));

let state = 'idle'; // idle | starting | playing | paused

const flow = mountFlow(document.getElementById('flowbtn'), document.getElementById('flow'), (open) => {
  if (!open) { clearTimeout(hideTimer); hideTimer = setTimeout(() => hideUI(), 2500); }
});
let hideTimer = 0;

// --- Başlat / durdur ------------------------------------------------------

async function begin() {
  if (state !== 'idle') return;
  if (!window.Tone) { alert('Ses kütüphanesi yüklenemedi. İnternet bağlantını kontrol edip sayfayı yenile.'); return; }
  state = 'starting';
  scene.begin();
  credit.classList.remove('idle');
  hideUI(true);
  try {
    if (!engine.ready) await engine.init(audioEl);
    engine.start(5);
    state = 'playing';
    setMediaState('playing');
  } catch (err) {
    console.error(err);
    state = 'idle';
    scene.reset();
    credit.classList.add('idle', 'show');
  }
}

function pause() {
  if (state !== 'playing') return;
  state = 'paused';
  engine.stop(1.2);
  scene.setPaused(true);
  setMediaState('paused');
  setTimeout(() => { if (state === 'paused' && engine.viaElement) audioEl.pause(); }, 1400);
}

async function resume() {
  if (state !== 'paused') return;
  state = 'playing';
  scene.setPaused(false);
  try { await window.Tone.getContext().resume(); } catch (_) { /* yoksay */ }
  if (engine.viaElement) { try { await audioEl.play(); } catch (_) { /* yoksay */ } }
  engine.start(1.5);
  setMediaState('playing');
}

function tap() {
  if (state === 'idle') return begin();
  if (!scene.introDone) return;
  if (state === 'playing') pause();
  else if (state === 'paused') resume();
}

cv.addEventListener('click', tap);
addEventListener('keydown', (e) => {
  if (e.target.closest && e.target.closest('a, button, input')) return;
  if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); tap(); }
  else if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
    range.value = Math.max(0, Math.min(100, +range.value + (e.code === 'ArrowUp' ? 5 : -5)));
    onVolume(); showUI();
  } else if (e.key === 'm' || e.key === 'M') { toggleMute(); showUI(); }
});

// --- Ses kontrolü ve imza: fare hareket edince belirir ---------------------

function showUI() {
  if (state === 'idle' || !scene.introDone) return;
  credit.classList.add('show');
  controls.classList.add('show');
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => hideUI(), 2500);
}

function hideUI(force) {
  const busy = flow.isOpen() || !document.getElementById('linkbox').hidden;
  if (!force && (busy || credit.matches(':hover') || controls.matches(':hover') || controls.contains(document.activeElement))) {
    hideTimer = setTimeout(() => hideUI(), 1500);
    return;
  }
  credit.classList.remove('show');
  controls.classList.remove('show');
}

addEventListener('pointermove', showUI);
addEventListener('touchstart', showUI, { passive: true });

function onVolume() {
  const v = range.value / 100;
  engine.volume = v;
  engine.setVolume(v);
  setMuteIcon();
}

function toggleMute() {
  if (engine.muted && engine.volume === 0) { range.value = 50; engine.volume = 0.5; }
  engine.setMuted(!engine.muted);
  setMuteIcon();
}

function setMuteIcon() {
  const off = engine.muted || +range.value === 0;
  muteBtn.classList.toggle('off', off);
  muteBtn.classList.toggle('low', !off && +range.value < 40);
  muteBtn.setAttribute('aria-label', off ? 'Sesi aç' : 'Sesi kapat');
}

range.addEventListener('input', onVolume);
muteBtn.addEventListener('click', toggleMute);

// --- Kilit ekranı / bildirim kontrolleri -----------------------------------

function setMediaState(s) {
  if (!('mediaSession' in navigator)) return;
  try { navigator.mediaSession.playbackState = s; } catch (_) { /* yoksay */ }
}

engine.onSegment = (seg) => {
  if (!('mediaSession' in navigator)) return;
  const hh = String(seg.hour).padStart(2, '0');
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: `${seg.P.name} · ${hh}:00`,
      artist: 'Ahmet Kayra',
      album: 'Zamanın Radyosu',
      artwork: [
        { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    });
    navigator.mediaSession.setActionHandler('play', () => resume());
    navigator.mediaSession.setActionHandler('pause', () => pause());
  } catch (_) { /* yoksay */ }
};

// Arka plandan dönünce ses bağlamı askıya alınmışsa uyandır.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state === 'playing' && window.Tone) {
    window.Tone.getContext().resume().catch(() => {});
  }
});

// --- Uygulama olarak yükle --------------------------------------------------

let deferredPrompt = null;
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.hidden = false;
});
installBtn.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice.catch(() => {});
  deferredPrompt = null;
  installBtn.hidden = true;
});
addEventListener('appinstalled', () => { installBtn.hidden = true; });

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

// Belge başlığı saatle birlikte güncellensin.
setInterval(() => {
  const d = now();
  document.title = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} · Zamanın Radyosu`;
}, 1000);
