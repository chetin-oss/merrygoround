// Bach–Gounod style "Ave Maria" mood: Bach's Prelude in C (BWV 846, public domain) as the harp/piano bed,
// with an original soprano line sung by a formant "ah / oh" voice synth, all in a large hall reverb.

const PRELUDE = [ // five notes per bar, first 19 bars of BWV 846
  ['C4','E4','G4','C5','E5'], ['C4','D4','A4','D5','F5'], ['B3','D4','G4','D5','F5'], ['C4','E4','G4','C5','E5'],
  ['C4','E4','A4','E5','A5'], ['C4','D4','F#4','A4','D5'], ['B3','D4','G4','D5','G5'], ['B3','C4','E4','G4','C5'],
  ['A3','C4','E4','G4','C5'], ['D3','A3','D4','F#4','C5'], ['G3','B3','D4','G4','B4'], ['G3','Bb3','E4','G4','C#5'],
  ['F3','A3','D4','A4','D5'], ['F3','Ab3','D4','F4','B4'], ['E3','G3','C4','G4','C5'], ['E3','F3','A3','C4','F4'],
  ['D3','F3','A3','C4','F4'], ['G2','D3','G3','B3','F4'], ['C3','E3','G3','C4','E4'],
];
// soprano: [first half, second half]; null second = hold the whole bar
const MELODY = [
  ['E5', null], ['F5', 'D5'], ['D5', 'B4'], ['C5', 'E5'], ['A5', 'E5'], ['F#5', 'D5'], ['G5', 'D5'], ['E5', 'C5'],
  ['E5', 'C5'], ['D5', 'F#5'], ['G5', null], ['G5', 'E5'], ['F5', 'D5'], ['D5', 'B4'], ['C5', 'E5'], ['F5', 'C5'],
  ['F5', 'D5'], ['B4', 'D5'], ['C5', null],
];
const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function hz(n) {
  const m = n.match(/^([A-G])([#b]?)(\d)$/);
  const midi = 12 * (+m[3] + 1) + SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return 440 * Math.pow(2, (midi - 69) / 12);
}
const VOWELS = [
  [[800, 1.0, 6], [1150, 0.5, 8], [2900, 0.14, 11]], // ah
  [[450, 1.0, 6], [800, 0.45, 8], [2830, 0.1, 11]],  // oh
];

let ctx = null, master, wet, on = false, next = 0, step = 0;
const S = 0.2; // one sixteenth note

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
}

function harp(f, t, dur, vol) {
  const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'triangle'; o.frequency.value = f; o2.type = 'sine'; o2.frequency.value = f * 2;
  const g2 = ctx.createGain(); g2.gain.value = 0.25;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); o2.connect(g2).connect(g); g.connect(master); g.connect(wet);
  o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
}

function voice(f, t, dur, vowel) {
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, t);
  out.gain.linearRampToValueAtTime(1.4, t + 0.35);
  out.gain.setValueAtTime(1.4, t + dur - 0.25);
  out.gain.linearRampToValueAtTime(0.0001, t + dur + 0.3);
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
    depth.gain.setValueAtTime(0, t); depth.gain.linearRampToValueAtTime(f * 0.014, t + 0.6);
    lfo.connect(depth).connect(o.frequency);
    o.connect(lp);
    o.start(t); lfo.start(t); o.stop(t + dur + 0.4); lfo.stop(t + dur + 0.4);
  }
  out.connect(master); out.connect(wet);
}

function schedule() {
  while (next < ctx.currentTime + 0.4) {
    const bar = Math.floor(step / 16) % PRELUDE.length, s = step % 16;
    const notes = PRELUDE[bar];
    const idx = [0, 1, 2, 3, 4, 2, 3, 4][s % 8];
    harp(hz(notes[idx]), next, idx < 2 ? 2.6 : 0.9, idx < 2 ? 0.16 : 0.11);
    if (s === 0 || s === 8) {
      const [a, b] = MELODY[bar];
      if (s === 0) voice(hz(a), next, b ? S * 8 : S * 16, bar % 2);
      else if (b) voice(hz(b), next, S * 8, (bar + 1) % 2);
    }
    next += S; step++;
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
