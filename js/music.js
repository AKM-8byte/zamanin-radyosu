// Müzik motoru: yerel tarih + saatten seed üretir, o saate ait formu
// (hangi enstrüman ne zaman çalacak, sessizlikler) seed'den kurar ve
// saatin içindeki konumdan çalmaya başlar. Böylece aynı yerel saatte
// siteyi açan herkes aynı müziği duyar.
import { parts, rng, hash } from './time.js';

const HARM = [0, 2, 3, 5, 7, 8, 11];
const NAT = [0, 2, 3, 5, 7, 8, 10];
const MAJ = [0, 2, 4, 5, 7, 9, 11];
const PENT = [0, 2, 4, 7, 9];
const PMAP = { 0: 0, 1: 1, 2: 2, 3: 4, 4: 3, 5: 4, 6: 4 };
// Minör (arabesk / Hicaz çeşnili) akor yürüyüşleri: kök tona göre yarım ses
const MINOR_PROGS = [
  [[0, 3, 7], [-2, 2, 5], [-4, 0, 3], [-5, -1, 2]], // i VII VI V (Endülüs kadansı)
  [[0, 3, 7], [-7, -4, 0], [-5, -1, 2], [0, 3, 7]], // i iv V i
  [[0, 3, 7], [-4, 0, 3], [-7, -4, 0], [-5, -1, 2]], // i VI iv V
  [[-7, -4, 0], [0, 3, 7], [-4, 0, 3], [-5, -1, 2]], // iv i VI V
];
const RIDX = { 0: 0, '-2': -1, '-4': -2, '-5': -3, '-7': -4 };
// Majör yürüyüşler: dizi derecesi (7'li akorlar)
const MAJOR_PROGS = [[0, 4, 5, 3], [5, 3, 0, 4], [0, 5, 3, 4], [3, 0, 4, 5], [0, 2, 3, 4]];
const U = 32; // form birimi: 32 sekizlik = 2 akor

export const NAMES = {
  piano: 'Piyano', guitar: 'Gitar', harm: 'Harmonika', ney: 'Ney',
  kalimba: 'Kalimba', rhodes: 'Elektrik piyano', flute: 'Flüt',
};

export const PROFILES = {
  night: {
    name: 'Gece', harmony: 'minor', bpm: [56, 62], pool: ['piano', 'guitar', 'harm', 'ney'],
    comp: ['piano', 'guitar'], silence: 0.28, silLens: [1, 1, 2], lens: [1, 1, 2, 2, 3], grow: 0.62,
    drums: null, bassInst: 'acc', birds: 0, wind: -30, wet: 0.5, padCut: 700, swing: 0,
  },
  dawn: {
    name: 'Şafak', harmony: 'major', bpm: [68, 76], pool: ['piano', 'kalimba', 'flute', 'ney'],
    comp: ['piano', 'rhodes'], silence: 0.15, silLens: [1], lens: [1, 2, 2, 3], grow: 0.62,
    drums: 'heart', bassInst: 'synth', birds: 0.02, wind: -36, wet: 0.42, padCut: 1000, swing: 0.1,
  },
  day: {
    name: 'Gündüz', harmony: 'major', bpm: [84, 95], pool: ['kalimba', 'rhodes', 'flute', 'guitar', 'piano'],
    comp: ['rhodes', 'guitar', 'piano', 'rhodes'], silence: 0.07, silLens: [1], lens: [1, 2, 2, 3], grow: 0.7,
    drums: 'full', bassInst: 'synth', birds: 0.025, wind: -60, wet: 0.32, padCut: 1400, swing: 0.22,
  },
  dusk: {
    name: 'Akşam', harmony: 'minor', bpm: [66, 74], pool: ['rhodes', 'guitar', 'harm', 'piano'],
    comp: ['rhodes', 'piano'], silence: 0.15, silLens: [1, 2], lens: [1, 2, 2, 3], grow: 0.65,
    drums: 'soft', bassInst: 'synth', birds: 0, wind: -34, wet: 0.44, padCut: 900, swing: 0.15,
  },
};

export function profileKey(h) {
  if (h >= 22 || h < 5) return 'night';
  if (h < 8) return 'dawn';
  if (h < 17) return 'day';
  return 'dusk';
}

const pickR = (R) => (a) => a[Math.floor(R() * a.length)];

function shuffle(R, a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function genMotif(R, minor) {
  const pick = pickR(R), on = [];
  for (let s = 0; s < 16; s++) {
    const p = s === 0 ? 1 : minor
      ? (s % 4 === 0 ? 0.55 : s % 2 === 0 ? 0.25 : 0.08)
      : (s % 4 === 0 ? 0.8 : s % 2 === 0 ? 0.5 : 0.22);
    if (R() < p) on.push(s);
  }
  let d = pick(minor ? [2, 4] : [0, 2]);
  const out = [];
  on.forEach((s, i) => {
    if (i) d += pick([-1, -1, 1, 1, -2, 2, 0]);
    d = Math.max(-2, Math.min(7, d));
    const nx = i < on.length - 1 ? on[i + 1] : 16;
    out.push({ s, d, len: Math.min(minor ? 5 : 3, nx - s) });
  });
  const last = out[out.length - 1];
  last.d = minor ? [0, 2, 4, 7].reduce((a, b) => (Math.abs(b - last.d) < Math.abs(a - last.d) ? b : a)) : 0;
  return out;
}

function genForm(R, P, minSteps) {
  const pick = pickR(R), minor = P.harmony === 'minor';
  const order = shuffle(R, P.pool);
  let li = 0;
  const nextLead = () => order[li++ % order.length];
  const KS = P.drums ? ['pad', 'bass', 'arp', 'ans', 'drums', 'lead'] : ['pad', 'bass', 'arp', 'ans', 'lead'];
  const maxL = P.drums ? 5 : 4;
  const f = [];
  let sum = 0;
  const push = (x) => { f.push(x); sum += x.len * U; };

  const st = R();
  if (minor) push(st < 0.7 ? { lead: nextLead(), len: pick([1, 2]) } : { pad: true, len: pick([1, 2]) });
  else if (st < 0.45) push({ lead: nextLead(), len: pick([1, 2]) });
  else if (st < 0.75 || !P.drums) push({ arp: true, pad: true, len: 1 });
  else push({ drums: true, bass: true, len: 1 });

  let i = 1;
  while (sum < minSteps) {
    const prev = f[f.length - 1];
    let n = { ...prev };
    delete n.len; delete n.sil;
    if (prev.sil) {
      n = minor ? (R() < 0.65 ? { lead: nextLead() } : { pad: true }) : { lead: nextLead(), arp: true, pad: true };
    } else if (i > 1 && R() < P.silence) {
      push({ sil: true, len: pick(P.silLens) }); i++; continue;
    } else {
      const has = KS.filter((k) => n[k]);
      const miss = KS.filter((k) => !n[k] && (k !== 'ans' || n.lead));
      if (has.length < maxL && miss.length && R() < P.grow) {
        const k = pick(miss);
        if (k === 'lead') n.lead = nextLead();
        else if (k === 'ans') n.ans = pick(P.pool.filter((x) => x !== n.lead));
        else n[k] = true;
      } else {
        const cand = has.filter((k) => minor || k !== 'lead');
        if (has.length > (minor ? 1 : 2) && cand.length) {
          const k = pick(cand);
          if (k === 'lead') { n.lead = null; n.ans = null; } else if (k === 'ans') n.ans = null; else n[k] = false;
        }
        if (R() < 0.3 && n.lead) { n.lead = nextLead(); if (n.ans === n.lead) n.ans = null; }
      }
    }
    if (!KS.some((k) => n[k])) n.pad = true;
    n.len = pick(P.lens);
    push(n); i++;
  }
  const bounds = [];
  let s = 0;
  for (const x of f) { bounds.push(s); s += x.len * U; }
  return { form: f, bounds, total: s };
}

function makeSegment(p) {
  const key = profileKey(p.h), P = PROFILES[key];
  const seed = hash(p.y, p.mo, p.d, p.h, 7);
  const R = rng(seed), pick = pickR(R);
  const bpm = P.bpm[0] + Math.floor(R() * (P.bpm[1] - P.bpm[0] + 1));
  const eighth = 30 / bpm;
  const minor = P.harmony === 'minor';
  const root = minor ? 55 + pick([-3, -2, -1, 0, 1, 2]) : pick([60, 62, 64, 65, 67]);
  const comp = pick(P.comp);
  const cpat = pick([[0, 6, 10], [0, 3, 8, 11], [0, 7, 12], [0, 5, 8, 13]]);
  const kpat = pick([[0, 5], [0, 3, 5], [0, 5, 7]]);
  const hourSteps = Math.ceil(3600 / eighth) + 64;
  const { form, bounds, total } = genForm(R, P, hourSteps);
  const blockSteps = 64 * Math.max(1, Math.round(600 / eighth / 64)); // ~10 dakikalık bloklar
  return { key, P, seed, bpm, eighth, root, comp, cpat, kpat, form, bounds, total, blockSteps, minor, hour: p.h, day: p.d, blocks: new Map() };
}

export class Engine {
  constructor() {
    this.ready = false;
    this.playing = false;
    this.volume = 0.8;
    this.muted = false;
    this.onNote = null;
    this.onSegment = null;
    this.seg = null;
    this.step = 0;
  }

  // Kullanıcı dokunuşunun içinde çağrılmalı.
  async init(audioEl) {
    const Tone = window.Tone;
    try { Tone.setContext(new Tone.Context({ latencyHint: 'playback', lookAhead: 0.25 })); } catch (_) { /* varsayılan bağlam */ }
    await Tone.start();
    this.Tone = Tone;
    this.tp = Tone.getContext().transport;
    this.drawer = Tone.getContext().draw;
    const raw = Tone.getContext().rawContext;

    this.master = new Tone.Gain(0);
    this.limiter = new Tone.Limiter(-1);
    this.master.connect(this.limiter);
    this.analyser = new Tone.Analyser('fft', 128);
    this.limiter.connect(this.analyser);

    // Ekran kapalıyken de çalabilmesi için sesi bir <audio> öğesi üzerinden ver.
    let routed = false;
    if (audioEl && raw.createMediaStreamDestination) {
      try {
        const dest = raw.createMediaStreamDestination();
        Tone.connect(this.limiter, dest);
        audioEl.srcObject = dest.stream;
        await audioEl.play();
        routed = true;
      } catch (_) { routed = false; }
    }
    if (!routed) this.limiter.toDestination();
    this.viaElement = routed;

    this.buildInstruments();
    this.ready = true;
  }

  buildInstruments() {
    const Tone = this.Tone, M = (m) => Tone.Frequency(m, 'midi');
    this.rev = new Tone.Reverb({ decay: 7, wet: 0.45 });
    this.rev.connect(this.master);
    const bus = new Tone.Gain(0.85).connect(this.rev);
    const L = (this.L = {});
    ['piano', 'guitar', 'harm', 'ney', 'kalimba', 'rhodes', 'flute', 'pad', 'bass', 'drums', 'birds', 'wind'].forEach((k) => (L[k] = new Tone.Gain(1)));
    ['harm', 'ney', 'kalimba', 'flute', 'birds', 'wind'].forEach((k) => L[k].connect(bus));
    L.piano.chain(new Tone.Filter(2800, 'lowpass'), new Tone.Vibrato(0.5, 0.025), bus);
    L.guitar.chain(new Tone.Filter(130, 'highpass'), new Tone.Filter({ frequency: 1400, type: 'lowpass', rolloff: -24 }), new Tone.Gain(0.55), bus);
    L.rhodes.chain(new Tone.Tremolo(3.8, 0.3).start(), new Tone.Filter(2600, 'lowpass'), bus);
    this.padFilter = new Tone.Filter(800, 'lowpass');
    L.pad.chain(this.padFilter, bus);
    L.bass.chain(new Tone.Filter(500, 'lowpass'), this.master);
    const dl = new Tone.Filter(6500, 'lowpass');
    L.drums.connect(dl); dl.connect(this.master); dl.connect(new Tone.Gain(0.12).connect(this.rev));

    const I = (this.I = {});

    // Piyano: gerçek kayıtlar (Salamander Grand Piano), yüklenene kadar FM yedeği
    this.fm = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 2.01, modulationIndex: 1.4,
      envelope: { attack: 0.005, decay: 2.4, sustain: 0, release: 2 },
      modulationEnvelope: { attack: 0.005, decay: 0.5, sustain: 0, release: 0.5 }, volume: -12,
    }).connect(L.piano);
    const urls = {};
    ['A', 'C', 'D#', 'F#'].forEach((n) => { for (let o = 1; o <= 7; o++) urls[n + o] = n.replace('#', 's') + o + '.mp3'; });
    this.pianoReady = false;
    this.sampler = new Tone.Sampler({
      urls, baseUrl: 'audio/piano/', release: 2.2, volume: -5,
      onload: () => { this.pianoReady = true; },
    }).connect(L.piano);
    I.piano = (m, d, t, v) => (this.pianoReady ? this.sampler : this.fm).triggerAttackRelease(M(m).toNote(), d, t, v);

    // Naylon telli gitar (yumuşak, kısık)
    const pl = [0, 1, 2, 3, 4, 5].map(() => new Tone.PluckSynth({ attackNoise: 0.35, dampening: 1500, resonance: 0.93, volume: -14 }).connect(L.guitar));
    let pr = 0;
    I.guitar = (m, d, t) => pl[pr++ % pl.length].triggerAttack(M(m).toFrequency(), t);

    // Harmonika (bükerek giriş)
    const hs = new Tone.Synth({ oscillator: { type: 'pulse', width: 0.28 }, envelope: { attack: 0.08, decay: 0.3, sustain: 0.75, release: 0.6 }, volume: -25 });
    hs.chain(new Tone.Filter({ frequency: 1500, type: 'bandpass', Q: 0.6 }), new Tone.Filter(3000, 'lowpass'), new Tone.Vibrato(5.6, 0.07), new Tone.Tremolo(5.6, 0.25).start(), L.harm);
    const hb = new Tone.AmplitudeEnvelope({ attack: 0.05, decay: 0.2, sustain: 0.4, release: 0.4 });
    this.harmNoise = new Tone.Noise('pink');
    this.harmNoise.chain(new Tone.Filter({ frequency: 2200, type: 'bandpass', Q: 1 }), hb, new Tone.Gain(0.025), L.harm);
    I.harm = (m, d, t, v, r) => {
      const f = M(m).toFrequency();
      if (r() < 0.4) { hs.triggerAttack(f * Math.pow(2, -1 / 12), t); hs.frequency.exponentialRampToValueAtTime(f, t + 0.16); } else hs.triggerAttack(f, t);
      hs.triggerRelease(t + d); hb.triggerAttackRelease(d, t);
    };

    // Ney (nefesli, kayan)
    const ns = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.45, decay: 0.2, sustain: 0.85, release: 1.6 }, portamento: 0.14, volume: -20 });
    ns.chain(new Tone.Vibrato(5, 0.09), new Tone.Filter(1900, 'lowpass'), L.ney);
    const nb = new Tone.AmplitudeEnvelope({ attack: 0.4, decay: 0.2, sustain: 0.6, release: 1.4 });
    this.neyNoise = new Tone.Noise('pink');
    this.neyNoise.chain(new Tone.Filter({ frequency: 1400, type: 'bandpass', Q: 1.2 }), nb, new Tone.Gain(0.05), L.ney);
    I.ney = (m, d, t) => { ns.triggerAttackRelease(M(m).toFrequency(), d, t); nb.triggerAttackRelease(d, t); };

    // Kalimba
    const ka = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 5.07, modulationIndex: 5, oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.9, sustain: 0, release: 0.9 },
      modulationEnvelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.04 }, volume: -13,
    }).connect(L.kalimba);
    I.kalimba = (m, d, t, v) => ka.triggerAttackRelease(M(m).toNote(), 0.9, t, v);

    // Elektrik piyano
    const rh = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 1, modulationIndex: 3.2, oscillator: { type: 'sine' },
      envelope: { attack: 0.004, decay: 2.6, sustain: 0.12, release: 1.2 },
      modulationEnvelope: { attack: 0.002, decay: 0.5, sustain: 0.05, release: 0.5 }, volume: -15,
    }).connect(L.rhodes);
    I.rhodes = (m, d, t, v) => rh.triggerAttackRelease(M(m).toNote(), d, t, v);

    // Flüt (denemeye göre kısıldı)
    const fl = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.08, decay: 0.1, sustain: 0.9, release: 0.35 }, portamento: 0.05, volume: -21 });
    fl.chain(new Tone.Vibrato(5, 0.06), L.flute);
    const fb = new Tone.AmplitudeEnvelope({ attack: 0.05, decay: 0.1, sustain: 0.5, release: 0.3 });
    this.fluteNoise = new Tone.Noise('pink');
    this.fluteNoise.chain(new Tone.Filter({ frequency: 2500, type: 'bandpass', Q: 0.9 }), fb, new Tone.Gain(0.02), L.flute);
    I.flute = (m, d, t) => { fl.triggerAttackRelease(M(m).toFrequency(), d * 0.9, t); fb.triggerAttackRelease(d * 0.9, t); };

    this.pad = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'fatsawtooth', count: 3, spread: 22 }, envelope: { attack: 2.5, decay: 1, sustain: 0.75, release: 5 }, volume: -32 }).connect(L.pad);
    this.bassS = new Tone.MonoSynth({
      oscillator: { type: 'triangle' }, filter: { Q: 1, type: 'lowpass' },
      filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.4, baseFrequency: 180, octaves: 2 },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0.6, release: 0.3 }, volume: -11,
    }).connect(L.bass);

    this.kick = new Tone.MembraneSynth({ pitchDecay: 0.04, octaves: 5, envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.1 }, volume: -9 }).connect(L.drums);
    this.snare = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.001, decay: 0.15, sustain: 0 }, volume: -17 });
    this.snare.chain(new Tone.Filter({ frequency: 1700, type: 'bandpass', Q: 0.8 }), L.drums);
    this.hat = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.03, sustain: 0 }, volume: -28 });
    this.hat.chain(new Tone.Filter(7500, 'highpass'), L.drums);

    this.birdPan = new Tone.Panner(0).connect(L.birds);
    this.bird = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.005, decay: 0.07, sustain: 0, release: 0.04 }, volume: -27 }).connect(this.birdPan);

    this.wind = new Tone.Noise('brown');
    this.windGain = new Tone.Gain(0);
    this.wind.chain(new Tone.AutoFilter({ frequency: 0.05, baseFrequency: 180, octaves: 2.5 }).start(), this.windGain, L.wind);

    this.loop = new Tone.Loop((time) => this.tick(time), '8n');
  }

  target() { return this.muted ? 0 : this.volume * 0.9; }

  ramp(v, s) {
    const g = this.master.gain, n = this.Tone.now();
    g.cancelScheduledValues(n);
    g.setValueAtTime(g.value, n);
    g.linearRampToValueAtTime(v, n + s);
  }

  setVolume(v) { this.volume = v; this.muted = v === 0; if (this.playing) this.ramp(this.target(), 0.15); }
  setMuted(m) { this.muted = m; if (this.playing) this.ramp(this.target(), 0.4); }

  setSegment(p) {
    this.seg = makeSegment(p);
    const P = this.seg.P, Tone = this.Tone;
    this.rev.wet.rampTo(P.wet, 3);
    this.padFilter.frequency.rampTo(P.padCut, 3);
    this.windDb = P.wind;
    this.tp.bpm.value = this.seg.bpm;
    this.tp.swing = P.swing;
    this.tp.swingSubdivision = '8n';
    if (this.onSegment) this.onSegment(this.seg);
  }

  block(k) {
    const s = this.seg;
    if (!s.blocks.has(k)) {
      const R = rng(hash(s.seed, 99, k)), pick = pickR(R);
      s.blocks.set(k, { prog: pick(s.minor ? MINOR_PROGS : MAJOR_PROGS), motif: genMotif(R, s.minor) });
    }
    return s.blocks.get(k);
  }

  start(fadeIn = 5) {
    const Tone = this.Tone;
    clearInterval(this.watch);
    clearTimeout(this.stopTimer);
    clearTimeout(this.hourTimer);
    if (this.tp.state !== 'stopped') { this.tp.stop(); this.loop.stop(); }
    const p = parts();
    this.setSegment(p);
    const elapsed = p.mi * 60 + p.s + p.ms / 1000;
    this.step = Math.floor(elapsed / this.seg.eighth);
    this.lastSection = -1;
    if (this.wind.state !== 'started') this.wind.start();
    [this.harmNoise, this.neyNoise, this.fluteNoise].forEach((n) => n.state !== 'started' && n.start());
    this.windGain.gain.rampTo(Math.pow(10, this.windDb / 20), 4);
    this.loop.start(0);
    this.tp.start('+0.1');
    this.playing = true;
    this.ramp(this.target(), fadeIn);
    this.watch = setInterval(() => this.checkHour(), 1000);
  }

  stop(fade = 1.2) {
    this.playing = false;
    clearInterval(this.watch);
    clearTimeout(this.hourTimer);
    this.ramp(0, fade);
    clearTimeout(this.stopTimer);
    this.stopTimer = setTimeout(() => {
      if (this.playing) return;
      const Tone = this.Tone;
      this.tp.stop(); this.loop.stop();
      this.pad.releaseAll();
    }, fade * 1000 + 150);
  }

  checkHour() {
    if (!this.playing || this.changing) return;
    const p = parts();
    if (p.h === this.seg.hour && p.d === this.seg.day) return;
    // Saat değişti: yumuşakça kapat, yeni saatin seed'iyle aç.
    this.changing = true;
    this.ramp(0, 3);
    this.windGain.gain.rampTo(0, 3);
    this.hourTimer = setTimeout(() => {
      this.changing = false;
      if (!this.playing) return;
      this.tp.stop(); this.loop.stop(); this.pad.releaseAll();
      this.start(4);
    }, 3200);
  }

  getBands() {
    if (!this.ready || !this.playing) return null;
    const v = this.analyser.getValue();
    const avg = (a, b) => { let s = 0; for (let i = a; i < b; i++) s += Math.max(0, Math.min(1, (v[i] + 100) / 70)); return s / (b - a); };
    return [avg(0, 5), avg(5, 22), avg(22, 60)];
  }

  sectionAt(p) {
    const b = this.seg.bounds;
    let lo = 0, hi = b.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (b[mid] <= p) lo = mid; else hi = mid - 1; }
    return lo;
  }

  tick(t) {
    const s = this.seg, P = s.P, I = this.I, Tone = this.Tone;
    const step = this.step++;
    const pos = step % s.total;
    const si = this.sectionAt(pos), x = s.form[si];
    const r = rng(hash(s.seed, step)), pick = pickR(r);
    const sec = (n) => n * s.eighth;
    const e = step % 64, ci = e >> 4, w = e & 15;

    if (si !== this.lastSection) {
      this.lastSection = si;
      const base = Math.pow(10, this.windDb / 20);
      this.windGain.gain.rampTo(x.sil ? base * 0.2 : base, 4, t);
    }

    if (P.birds && r() < (x.sil ? P.birds * 3.5 : P.birds)) this.chirp(t, r);
    if (x.sil) return;

    const blk = this.block(Math.floor(step / s.blockSteps));
    const note = () => { if (this.onNote) this.drawer.schedule(this.onNote, t); };

    if (s.minor) {
      const c = blk.prog[ci];
      const scale = c[0] === 0 || c[0] === -5 ? HARM : NAT;
      const mel = (deg, base) => { const idx = RIDX[c[0]] + deg, o = Math.floor(idx / 7), k = ((idx % 7) + 7) % 7; return base + o * 12 + scale[k]; };

      if (x.drums) this.drums(w, s, P, r, t);
      if (x.bass && w === 0) {
        if (P.bassInst === 'acc') I[s.comp](s.comp === 'guitar' ? Math.max(40, s.root - 12 + c[0]) : s.root - 24 + c[0], sec(16), t, 0.4, r);
        else this.bassS.triggerAttackRelease(Tone.Frequency(s.root - 24 + c[0] + (s.root - 24 + c[0] < 31 ? 12 : 0), 'midi').toFrequency(), sec(10), t, 0.8);
      }
      if (x.bass && P.bassInst === 'synth' && w === 10 && r() < 0.5) this.bassS.triggerAttackRelease(Tone.Frequency(s.root - 24 + c[0] + 7, 'midi').toFrequency(), sec(3), t, 0.6);
      if (x.pad && w === 0) this.pad.triggerAttackRelease(c.map((v) => Tone.Frequency(s.root + v, 'midi').toNote()), sec(15), t);
      if (x.arp && [3, 6, 10, 13].includes(w) && r() < 0.6) I[s.comp](s.root - 12 + pick(c) + (r() < 0.3 ? 12 : 0), sec(6), t, 0.16 + r() * 0.1, r);

      const n = blk.motif.find((m) => m.s === w);
      if (x.lead && n && (ci % 2 === 0 || (!x.ans && r() < 0.35)) && r() > 0.12) {
        const d = n.d + (r() < 0.2 ? pick([-1, 1]) : 0);
        I[x.lead](mel(d, x.lead === 'guitar' ? s.root : s.root + 12), sec(n.len + 1), t, 0.32 + r() * 0.2, r);
        note();
      }
      if (x.ans && ci % 2 === 1 && (w === 0 || w === 8) && r() < 0.8) {
        const base = x.ans === 'guitar' ? s.root : s.root + 12 + (x.ans === 'ney' ? 12 : 0);
        I[x.ans](mel(pick([0, 1, 2, 4, -1]), base), sec(w === 0 ? 7 : 6), t, 0.4, r);
        note();
      }
    } else {
      const dg = blk.prog[ci];
      const sm = (i) => s.root + Math.floor(i / 7) * 12 + MAJ[((i % 7) + 7) % 7];
      const mel = (d, base) => { const idx = PMAP[dg] + d, o = Math.floor(idx / 5); return base + o * 12 + PENT[((idx % 5) + 5) % 5] + (s.root - 60); };

      if (x.drums) this.drums(w, s, P, r, t);
      if (x.bass && (w === 0 || w === 7 || (w === 10 && r() < 0.5))) {
        let bm = sm(dg) - 24;
        if (bm > s.root - 17) bm -= 12;
        this.bassS.triggerAttackRelease(Tone.Frequency(w === 10 ? bm + 7 : bm, 'midi').toFrequency(), sec(w === 0 ? 5 : 2), t, 0.8);
      }
      if (x.pad && w === 0) this.pad.triggerAttackRelease([dg, dg + 2, dg + 4].map((i) => Tone.Frequency(sm(i), 'midi').toNote()), sec(15), t);
      if (x.arp && s.cpat.includes(w)) {
        [dg + 2, dg + 4, dg + 6, dg + 8].map((i) => sm(i) - 12).forEach((m, j) =>
          I[s.comp](m, sec(w === 0 ? 5 : 3), t + (s.comp === 'guitar' ? j * 0.025 : 0), 0.22 + r() * 0.08, r));
      }
      const n = blk.motif.find((m) => m.s === w);
      if (x.lead && n && (!x.ans || ci < 2 || r() < 0.3) && r() > 0.08) {
        const d = n.d + (r() < 0.18 ? pick([-1, 1]) : 0);
        I[x.lead](mel(d, x.lead === 'guitar' ? 60 : 72), sec(n.len + 0.5), t, 0.35 + r() * 0.2, r);
        note();
      }
      if (x.ans && ci >= 2 && w % 4 === 0 && r() < 0.6) {
        const base = x.ans === 'guitar' ? 60 : x.ans === 'flute' ? 84 : 72;
        I[x.ans](mel(pick([0, 1, 2, 3, -1]), base), sec(3), t, 0.38, r);
        note();
      }
    }
  }

  drums(w, s, P, r, t) {
    const b = w % 8;
    if (P.drums === 'heart') {
      if (b === 0) this.kick.triggerAttackRelease('C1', '8n', t, 0.5);
      if (b === 1) this.kick.triggerAttackRelease('C1', '8n', t, 0.3);
      return;
    }
    const soft = P.drums === 'soft';
    if (s.kpat.includes(b)) this.kick.triggerAttackRelease('C1', '8n', t, (b === 0 ? 0.9 : 0.7) * (soft ? 0.6 : 1));
    if (b === 2 || b === 6) this.snare.triggerAttackRelease('16n', t, soft ? 0.3 : 0.6);
    if (r() < (soft ? 0.5 : 0.9)) this.hat.triggerAttackRelease('32n', t, (b % 2 ? 0.35 : 0.6) * (soft ? 0.6 : 1));
  }

  chirp(t, r) {
    this.birdPan.pan.setValueAtTime(r() * 1.6 - 0.8, t);
    const n = 2 + Math.floor(r() * 3), f = 2400 + r() * 1800;
    for (let i = 0; i < n; i++) {
      const tt = t + i * (0.1 + r() * 0.06);
      this.bird.triggerAttackRelease(f, 0.07, tt);
      this.bird.frequency.setValueAtTime(f, tt);
      this.bird.frequency.exponentialRampToValueAtTime(f * (1.3 + r() * 0.5), tt + 0.06);
    }
  }
}
