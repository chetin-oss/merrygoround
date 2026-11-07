// Holiday version: "Silent Night" (Franz Gruber, 1818 — public domain) sung by a formant soprano voice,
// over a 6/8 harp arpeggio, soft sleigh bells and a celesta sparkle, in a large hall reverb.

const KEY = Math.pow(2, 5 / 12);  // written in C, played in F (up a fourth) to sit in the soprano range
// melody: [note, length in eighths]; 12 bars of 6/8
const MELODY = [
  ['G4',3],['A4',1],['G4',2],['E4',6],
  ['G4',3],['A4',1],['G4',2],['E4',6],
  ['D5',4],['D5',2],['B4',6],
  ['C5',4],['C5',2],['G4',6],
  ['A4',4],['A4',2],['C5',3],['B4',1],['A4',2],
  ['G4',3],['A4',1],['G4',2],['E4',6],
  ['A4',4],['A4',2],['C5',3],['B4',1],['A4',2],
  ['G4',3],['A4',1],['G4',2],['E4',6],
  ['D5',4],['D5',2],['F5',3],['D5',1],['B4',2],
  ['C5',6],['E5',6],
  ['C5',3],['G4',1],['E4',2],['G4',3],['F4',1],['D4',2],
  ['C4',12],
];
// chord per dotted-quarter beat (two beats per 6/8 bar); each melody line above spans two bars = four beats
const CH = { C: ['C3','G3','C4','E4'], G7: ['G2','D3','F3','B3'], F: ['F2','C3','F3','A3'] };
const LINES = ['C','C','G7','C','F','C','F','C','G7','C',['C','C','G7','G7'],'C'];
const HARM = LINES.flatMap(l => Array.isArray(l) ? l : [l, l, l, l]);
const LOOP = 144; // eighths: 24 bars
const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function hz(n) {
  const m = n.match(/^([A-G])([#b]?)(\d)$/);
  const midi = 12 * (+m[3] + 1) + SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return 440 * Math.pow(2, (midi - 69) / 12) * KEY;
}
const VOWELS = [
  [[800, 1.0, 6], [1150, 0.5, 8], [2900, 0.14, 11]], // ah
  [[450, 1.0, 6], [800, 0.45, 8], [2830, 0.1, 11]],  // oh
];
// melody start positions, in eighths
const EVENTS = []; { let at = 0; for (const [n, len] of MELODY) { EVENTS.push({ at, n, len }); at += len; } }

let ctx = null, master, wet, noiseBuf, on = false, next = 0, step = 0;
const E = 0.3; // one eighth note

function setup() {
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18; comp.ratio.value = 4;
  master = ctx.createGain(); master.gain.value = 0;
  master.connect(comp).connect(ctx.destination);
  const conv = ctx.createConvolver();
  const len = ctx.sampleRate * 3.2, ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
  }
  conv.buffer = ir;
  wet = ctx.createGain(); wet.gain.value = 0.45;
  wet.connect(conv).connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
}

function harp(f, t, dur, vol) {
  const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), g2 = ctx.createGain();
  o.type = 'triangle'; o.frequency.value = f; o2.type = 'sine'; o2.frequency.value = f * 2; g2.gain.value = 0.25;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); o2.connect(g2).connect(g); g.connect(master); g.connect(wet);
  o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
}

function celesta(f, t) {
  const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.value = f; o2.type = 'sine'; o2.frequency.value = f * 4.01;
  const g2 = ctx.createGain(); g2.gain.value = 0.15;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.07, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
  o.connect(g); o2.connect(g2).connect(g); g.connect(master); g.connect(wet);
  o.start(t); o2.start(t); o.stop(t + 1.5); o2.stop(t + 1.5);
}

function bells(t, vol) {
  // a short shake of sleigh bells: a few bright noise ticks
  for (let k = 0; k < 3; k++) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 7200 + k * 900; bp.Q.value = 6;
    const g = ctx.createGain(), tk = t + k * 0.035;
    g.gain.setValueAtTime(0.0001, tk); g.gain.exponentialRampToValueAtTime(vol, tk + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, tk + 0.16);
    s.connect(bp).connect(g); g.connect(master); g.connect(wet);
    s.start(tk, Math.random() * 0.2); s.stop(tk + 0.2);
  }
}

function voice(f, t, dur, vowel) {
  const out = ctx.createGain(), att = Math.min(0.18, dur * 0.3);
  out.gain.setValueAtTime(0.0001, t);
  out.gain.linearRampToValueAtTime(1.4, t + att);
  out.gain.setValueAtTime(1.4, t + Math.max(att, dur - 0.12));
  out.gain.linearRampToValueAtTime(0.0001, t + dur + 0.22);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3600;
  for (const [fq, gn, q] of VOWELS[vowel]) {
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fq; bp.Q.value = q;
    const g = ctx.createGain(); g.gain.value = gn * 3;
    lp.connect(bp).connect(g).connect(out);
  }
  for (const det of [-5, 6]) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
    const lfo = ctx.createOscillator(), depth = ctx.createGain();
    lfo.frequency.value = 5.3 + det * 0.02;
    depth.gain.setValueAtTime(0, t); depth.gain.linearRampToValueAtTime(f * 0.013, t + Math.min(0.5, dur));
    lfo.connect(depth).connect(o.frequency);
    o.connect(lp);
    o.start(t); lfo.start(t); o.stop(t + dur + 0.3); lfo.stop(t + dur + 0.3);
  }
  out.connect(master); out.connect(wet);
}

function schedule() {
  while (next < ctx.currentTime + 0.4) {
    const pos = step % LOOP, s = pos % 6, half = Math.floor(pos / 3);
    const chord = CH[HARM[half]];
    harp(hz(chord[[0, 1, 2, 3, 2, 1][s]]), next, s === 0 ? 2.2 : 0.9, s === 0 ? 0.16 : 0.1);
    if (s === 0 || s === 3) bells(next, s === 0 ? 0.05 : 0.03);
    if (s === 0 && Math.floor(pos / 6) % 2 === 0) celesta(hz(chord[3]) * 4, next + E * 0.5);
    for (let i = 0; i < EVENTS.length; i++) {
      const ev = EVENTS[i];
      if (ev.at === pos) voice(hz(ev.n), next, ev.len * E, i % 2);
    }
    next += E; step++;
  }
}

// Older iPhones mute web audio on the silent switch unless an <audio> element is playing,
// so loop a silent clip alongside the synth.
let tag = null;
function unlockTag() {
  if (tag) return;
  const n = 4410, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 44100, true); v.setUint32(28, 88200, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  tag = new Audio(URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })));
  tag.loop = true; tag.setAttribute('playsinline', '');
  tag.play().catch(() => {});
}

export const Music = {
  toggle() {
    try {
      // iPhone: let web audio play even with the silent switch on (Safari 16.4+)
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
      if (!ctx) setup();
      ctx.resume();
      // iPhone/Android unlock: start one silent sample inside the tap itself
      const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource();
      s.buffer = b; s.connect(ctx.destination); s.start(0);
      unlockTag();
      on = !on;
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setTargetAtTime(on ? 0.9 : 0, t, 0.3);
      if (on && next < t) { next = t + 0.1; }
      if (tag) { if (on) tag.play().catch(() => {}); else tag.pause(); }
    } catch (e) { on = false; }
    return on;
  },
  update() { if (on && ctx) schedule(); },
};
