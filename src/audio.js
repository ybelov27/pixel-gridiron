// Tiny Web Audio synth for original SFX. Created lazily on first user gesture.
let ac = null, master = null, noiseBuf = null;
export const audio = { enabled: true };
export function unlockAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = 0.35; master.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (_) { ac = null; }
}
function tone(freq, dur, type = 'square', vol = 0.3, slide = 0, delay = 0) {
  if (!ac || !audio.enabled) return;
  const t = ac.currentTime + delay;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol = 0.3, freq = 1000, q = 1, delay = 0, attack = 0.005) {
  if (!ac || !audio.enabled) return;
  const t = ac.currentTime + delay;
  const s = ac.createBufferSource(); s.buffer = noiseBuf;
  const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.05);
}
export const sfx = {
  click() { tone(880, 0.05, 'square', 0.12); },
  snap() { noise(0.06, 0.5, 2500, 2); tone(140, 0.06, 'square', 0.2); },
  hike() { tone(330, 0.08, 'square', 0.15); tone(440, 0.08, 'square', 0.15, 0, 0.1); },
  throw() { noise(0.25, 0.25, 1800, 3, 0, 0.05); tone(500, 0.2, 'triangle', 0.1, 400); },
  catch() { tone(660, 0.06, 'square', 0.2); tone(990, 0.08, 'square', 0.15, 0, 0.06); },
  drop() { tone(300, 0.15, 'square', 0.15, -150); },
  tackle() { noise(0.18, 0.7, 180, 0.8); tone(70, 0.15, 'sine', 0.5, -30); },
  juke() { noise(0.08, 0.2, 3500, 4); },
  whistle() { tone(2100, 0.35, 'square', 0.12); tone(2160, 0.35, 'sine', 0.1); },
  kick() { noise(0.08, 0.6, 400, 1); tone(110, 0.1, 'sine', 0.5, -40); },
  crowd(big = true) { noise(big ? 2.2 : 1.0, big ? 0.5 : 0.25, 900, 0.4, 0, 0.3); noise(big ? 2.0 : 0.8, 0.2, 2200, 0.5, 0.1, 0.4); },
  groan() { noise(1.0, 0.25, 400, 0.6, 0, 0.2); },
  good() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.12, 'square', 0.15, 0, i * 0.09)); },
  bad() { [392, 330, 262].forEach((f, i) => tone(f, 0.16, 'square', 0.15, 0, i * 0.12)); },
  cash() { tone(1200, 0.06, 'square', 0.12); tone(1600, 0.1, 'square', 0.12, 0, 0.06); },
};
