// Routes are waypoints [forward, lateral] in yards relative to alignment; +lateral = toward the ball (inside).
export const ROUTES = {
  go: { pts: [[40, 0]] }, fade: { pts: [[12, -1], [40, -3]] }, slant: { pts: [[2, 0], [14, 8]] },
  out: { pts: [[7, 0], [7, -14]] }, in: { pts: [[9, 0], [9, 18]] }, post: { pts: [[11, 0], [34, 10]] },
  corner: { pts: [[11, 0], [28, -10]] }, curl: { pts: [[11, 0], [9, 1]], stop: true },
  comeback: { pts: [[14, 0], [11, -3]], stop: true }, hitch: { pts: [[5, 0], [4, 0]], stop: true },
  flat: { pts: [[1, -4], [3, -14]] }, wheel: { pts: [[1, -5], [5, -9], [35, -10]] },
  drag: { pts: [[2, 0], [4, 24]] }, seam: { pts: [[35, 1]] }, screen: { pts: [[-1.5, -3]], stop: true, screen: true },
  swing: { pts: [[-1, -5], [2, -13]] }, check: { pts: [[2, 3], [3, 3]], stop: true }, block: null,
  dig: { pts: [[13, 0], [13, 16]] }, zig: { pts: [[6, 3], [6, -3], [20, -4]] },
};
// formation: shotgun | under | pistol | trips | empty ; rb: route name or {run: lateral gap}
export const PLAYS = [
  { name: 'SLANT FLOOD', type: 'pass', f: 'shotgun', r: { WR1: 'slant', WR2: 'slant', WR3: 'flat', TE: 'curl', RB: 'check' }, tag: 'short' },
  { name: 'FOUR VERTS', type: 'pass', f: 'shotgun', r: { WR1: 'go', WR2: 'go', WR3: 'seam', TE: 'seam', RB: 'check' }, tag: 'deep' },
  { name: 'POST CORNER', type: 'pass', f: 'shotgun', r: { WR1: 'post', WR2: 'corner', WR3: 'drag', TE: 'block', RB: 'swing' }, tag: 'deep' },
  { name: 'CURL FLAT', type: 'pass', f: 'under', r: { WR1: 'curl', WR2: 'curl', WR3: 'flat', TE: 'flat', RB: 'check' }, tag: 'mid' },
  { name: 'OUTS', type: 'pass', f: 'shotgun', r: { WR1: 'out', WR2: 'out', WR3: 'hitch', TE: 'seam', RB: 'check' }, tag: 'mid' },
  { name: 'DIG MESH', type: 'pass', f: 'trips', r: { WR1: 'dig', WR2: 'drag', WR3: 'drag', TE: 'curl', RB: 'swing' }, tag: 'mid' },
  { name: 'SMASH', type: 'pass', f: 'shotgun', r: { WR1: 'hitch', WR2: 'corner', WR3: 'corner', TE: 'flat', RB: 'check' }, tag: 'mid' },
  { name: 'FADES', type: 'pass', f: 'empty', r: { WR1: 'fade', WR2: 'fade', WR3: 'slant', TE: 'fade', RB: 'flat' }, tag: 'redzone' },
  { name: 'HITCH SEAM', type: 'pass', f: 'pistol', r: { WR1: 'hitch', WR2: 'hitch', WR3: 'seam', TE: 'seam', RB: 'check' }, tag: 'short' },
  { name: 'COMEBACKS', type: 'pass', f: 'shotgun', r: { WR1: 'comeback', WR2: 'comeback', WR3: 'in', TE: 'block', RB: 'check' }, tag: 'mid' },
  { name: 'WHEEL ROUTE', type: 'pass', f: 'trips', r: { WR1: 'post', WR2: 'in', WR3: 'out', TE: 'drag', RB: 'wheel' }, tag: 'deep' },
  { name: 'ZIG OUT', type: 'pass', f: 'empty', r: { WR1: 'zig', WR2: 'out', WR3: 'slant', TE: 'curl', RB: 'flat' }, tag: 'short' },
  { name: 'WR SCREEN', type: 'pass', f: 'trips', r: { WR1: 'screen', WR2: 'go', WR3: 'go', TE: 'block', RB: 'check' }, tag: 'short' },
  { name: 'RB SCREEN', type: 'pass', f: 'shotgun', r: { WR1: 'go', WR2: 'go', WR3: 'in', TE: 'block', RB: 'screen' }, tag: 'short' },
  { name: 'HAIL MARY', type: 'pass', f: 'empty', r: { WR1: 'go', WR2: 'go', WR3: 'post', TE: 'post', RB: 'seam' }, tag: 'hail' },
  { name: 'PA BOOT', type: 'pa', f: 'under', r: { WR1: 'drag', WR2: 'corner', WR3: 'flat', TE: 'drag', RB: { run: -2 } }, tag: 'mid' },
  { name: 'PA DEEP POST', type: 'pa', f: 'under', r: { WR1: 'post', WR2: 'go', WR3: 'curl', TE: 'block', RB: { run: 2 } }, tag: 'deep' },
  { name: 'PA SLANTS', type: 'pa', f: 'pistol', r: { WR1: 'slant', WR2: 'slant', WR3: 'seam', TE: 'flat', RB: { run: 0 } }, tag: 'short' },
  { name: 'HB DIVE', type: 'run', f: 'under', r: { WR1: 'go', WR2: 'curl', WR3: 'hitch', TE: 'block', RB: { run: 0 } }, tag: 'run' },
  { name: 'INSIDE ZONE', type: 'run', f: 'pistol', r: { WR1: 'hitch', WR2: 'go', WR3: 'slant', TE: 'block', RB: { run: -2 } }, tag: 'run' },
  { name: 'OFF TACKLE', type: 'run', f: 'under', r: { WR1: 'curl', WR2: 'go', WR3: 'flat', TE: 'block', RB: { run: 4 } }, tag: 'run' },
  { name: 'HB SWEEP', type: 'run', f: 'shotgun', r: { WR1: 'go', WR2: 'go', WR3: 'curl', TE: 'block', RB: { run: 8 } }, tag: 'run' },
  { name: 'STRETCH LEFT', type: 'run', f: 'under', r: { WR1: 'go', WR2: 'hitch', WR3: 'out', TE: 'block', RB: { run: -7 } }, tag: 'run' },
  { name: 'DRAW', type: 'run', f: 'shotgun', r: { WR1: 'go', WR2: 'go', WR3: 'in', TE: 'seam', RB: { run: 1, delay: 0.6 } }, tag: 'run' },
  { name: 'QB SNEAK DIVE', type: 'run', f: 'under', r: { WR1: 'hitch', WR2: 'hitch', WR3: 'flat', TE: 'block', RB: { run: 1 } }, tag: 'goalline' },
  { name: 'GOAL LINE FLAT', type: 'pa', f: 'under', r: { WR1: 'slant', WR2: 'fade', WR3: 'flat', TE: 'flat', RB: { run: 0 } }, tag: 'goalline' },
];
// pick a play weighted by situation (down, distance, field position, clock)
export function choosePlay(rng, s) {
  const { down, toGo, yard, late } = s;
  const w = (p) => {
    const t = p.tag;
    let v = 1;
    if (t === 'hail') return late && yard < 70 ? 6 : 0;
    if (yard >= 95) return t === 'goalline' ? 5 : t === 'redzone' ? 4 : t === 'run' ? 2 : t === 'short' ? 1.5 : 0.1;
    if (yard >= 80) { if (t === 'redzone') v *= 3; if (t === 'deep') v *= 0.3; }
    else if (t === 'redzone' || t === 'goalline') v *= 0.15;
    if (toGo <= 2) { if (t === 'run' || t === 'goalline') v *= 3; if (t === 'deep') v *= 0.4; }
    else if (toGo >= 9 && down >= 2) { if (t === 'deep' || t === 'mid') v *= 2.2; if (t === 'run') v *= 0.4; }
    else if (down === 1) { if (t === 'run') v *= 1.6; if (p.type === 'pa') v *= 1.5; }
    if (late) { if (t === 'run') v *= 0.3; if (t === 'deep') v *= 1.5; }
    if (yard < 8 && t === 'deep') v *= 0.3;
    return v;
  };
  return rng.weighted(PLAYS, w);
}
