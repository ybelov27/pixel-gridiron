// Touchdown songs: short original chiptune jingles bought in the Front Office store.
// Each track: [note, beats] pairs ('R' = rest). drums: one char per eighth note (k kick, s snare, h hat, . rest).
export const SONGS = [
  { id: 'fanfare', name: 'STADIUM FANFARE', price: 0, bpm: 150, wave: 'square',
    lead: [['C5', .5], ['E5', .5], ['G5', .5], ['C6', 1], ['G5', .5], ['C6', 2]],
    bass: [['C3', 1], ['G2', 1], ['C3', 2]], drums: 'k.s.k.s.k...' },
  { id: 'horns', name: 'BRASS ATTACK', price: 6, bpm: 140, wave: 'sawtooth',
    lead: [['A4', .5], ['D5', .5], ['F#5', .5], ['A5', 1], ['F#5', .5], ['B5', 2]],
    bass: [['D3', 1], ['A2', 1], ['G2', 1], ['D3', 1]], drums: 'k.k.s.k.k.s.' },
  { id: 'party', name: 'PIXEL PARTY', price: 10, bpm: 190, wave: 'square',
    lead: [['E5', .5], ['G#5', .5], ['B5', .5], ['E6', .5], ['B5', .5], ['G#5', .5], ['E5', .5], ['B5', .5], ['C#6', .5], ['E6', 1.5]],
    bass: [['E3', .5], ['E3', .5], ['B2', .5], ['B2', .5], ['C#3', .5], ['C#3', .5], ['A2', .5], ['B2', 1.5]], drums: 'khkhskhkkhskhkh.' },
  { id: 'funk', name: 'END ZONE FUNK', price: 14, bpm: 120, wave: 'square',
    lead: [['D5', .5], ['R', .25], ['F5', .25], ['G5', .5], ['R', .25], ['A5', .25], ['C6', .5], ['A5', .5], ['G5', .25], ['F5', .25], ['D5', 1]],
    bass: [['D2', .25], ['D3', .25], ['R', .25], ['D2', .25], ['F2', .5], ['G2', .5], ['A2', .25], ['A2', .25], ['C3', .5], ['D3', 1]], drums: 'k.hsk.hs.khsk...' },
  { id: 'march', name: 'VICTORY MARCH', price: 18, bpm: 128, wave: 'triangle',
    lead: [['F4', .5], ['A4', .5], ['C5', .5], ['F5', 1], ['E5', .5], ['D5', .5], ['C5', 1], ['A4', .5], ['C5', .5], ['F5', 1.5]],
    bass: [['F2', 1], ['C3', 1], ['F2', 1], ['C3', 1], ['F2', 1.5]], drums: 'kss.kss.kss.ks..' },
  { id: 'rocket', name: 'ROCKET LAUNCH', price: 24, bpm: 200, wave: 'square',
    lead: [['C4', .25], ['D4', .25], ['E4', .25], ['F#4', .25], ['G#4', .25], ['A#4', .25], ['C5', .25], ['D5', .25], ['E5', .25], ['F#5', .25], ['G#5', .25], ['A#5', .25], ['C6', 2]],
    bass: [['C2', 1], ['C2', 1], ['C3', 2]], drums: 'hhhhhhhhk.s.k...' },
  { id: 'anthem', name: '8-BIT ANTHEM', price: 30, bpm: 132, wave: 'square',
    lead: [['B4', .5], ['D5', .5], ['F#5', .5], ['B5', 1], ['A5', .5], ['F#5', .5], ['G5', 1], ['E5', .5], ['F#5', 2]],
    bass: [['B2', 1], ['F#2', 1], ['G2', 1], ['E2', 1], ['F#2', 2]], drums: 'k.s.k.s.k.s.k.ss' },
];
export const songById = (id) => SONGS.find((s) => s.id === id) || SONGS[0];
const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
export function noteFreq(n) {
  const m = n.match(/^([A-G]#?)(\d)$/); if (!m) return 0;
  return 440 * Math.pow(2, (NOTE[m[1]] + (+m[2] + 1) * 12 - 69) / 12);
}
// flatten a song into timed events: {t, f, d, wave, vol} for notes, {t, drum} for hits
export function songEvents(song) {
  const beat = 60 / song.bpm, ev = [];
  for (const [track, wave, vol] of [[song.lead, song.wave, 0.16], [song.bass, 'triangle', 0.22]]) {
    let t = 0;
    for (const [n, b] of track) { if (n !== 'R') ev.push({ t, f: noteFreq(n), d: b * beat * 0.92, wave, vol }); t += b * beat; }
  }
  [...song.drums].forEach((ch, i) => { if (ch !== '.') ev.push({ t: i * beat / 2, drum: ch }); });
  return ev;
}
export function songLength(song) { return song.lead.reduce((s, [, b]) => s + b, 0) * 60 / song.bpm; }
