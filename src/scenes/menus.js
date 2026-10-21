// All management / menu screens, drawn on the 384x216 canvas.
import { W, H, rect, frame, text, panel, stars, bar, playerSprite, drawSprite, starIcon, wrap, textWidth } from '../gfx.js';
import { UI, fitText } from '../ui.js';
import { app } from '../app.js';
import { sfx } from '../audio.js';
import { TEAM_DATA, CONFS, CONF_ABBR, DIVS } from '../data.js';
import { newCareer, userTeam, teamName, DIFFS, WEEKS, userGameThisWeek, divisionTeams, ROUND_NAMES, teamRatings, diffParams, userEliminated } from '../league.js';
import { ATTRS, ATTR_LABEL, MAX_STARS, displayName, xpForLevel, buildLineup } from '../players.js';
import * as O from '../office.js';
import { startSeason, status, simUserGame, finishUserGame, simRound, opponentOf } from '../flow.js';
import { Match } from '../match.js';
import { GameScene } from './game.js';
import { saveCareer, loadCareer, hasSave, deleteSave, exportCareer, importCareer } from '../save.js';

const C = { bg: '#10121c', panel: '#1a1c2c', gold: '#ffcd34', dim: '#8b93af', good: '#38b764', bad: '#ff004d', blue: '#3b5dc9', white: '#f4f4f4' };
const hub = () => app.go(new HubScene());
const err = (e) => { if (e) { app.toast(e); sfx.bad(); return true; } sfx.cash(); return false; };
function header(title, sub = '', back = hub) {
  rect(0, 0, W, 16, '#000');
  text(title, 6, 5, C.gold);
  if (sub) text(sub, W - 50, 5, C.dim, 1, 'right');
  if (back) UI.button(W - 44, 1, 42, 14, 'BACK', back, { color: '#333c57' });
}
function ccBadge(x, y) { const c = app.career; text(`CC ${c.cc}`, x, y, C.gold); }
function money(v) { return `$${(Math.round(v * 10) / 10).toFixed(1)}M`; }
function pager(state, total, perPage, x, y) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  if (pages <= 1) return;
  UI.button(x, y, 16, 12, '<', () => { state.page = Math.max(0, state.page - 1); }, { color: '#333c57' });
  text(`${state.page + 1}/${pages}`, x + 30, y + 3, C.dim, 1, 'center');
  UI.button(x + 44, y, 16, 12, '>', () => { state.page = Math.min(pages - 1, state.page + 1); }, { color: '#333c57' });
}

// ===================================================================== TITLE
export class TitleScene {
  constructor() { this.t = 0; }
  update(dt) { this.t += dt; }
  draw() {
    // field backdrop
    for (let y = 0; y < H; y += 12) rect(0, y, W, 12, (y / 12) % 2 ? '#2f8f3a' : '#34993f');
    for (let x = (-(this.t * 30) % 36); x < W; x += 36) rect(x, 0, 1, H, 'rgba(255,255,255,0.4)');
    for (let i = 0; i < 6; i++) {
      const d = TEAM_DATA[(i * 5) % 32];
      const x = ((this.t * (40 + i * 6) + i * 70) % (W + 40)) - 20;
      drawSprite(playerSprite(d[3], d[4], Math.floor(this.t * 8 + i) % 2, 1, i), x, 150 + (i % 3) * 14);
    }
    rect(0, 30, W, 52, 'rgba(0,0,0,0.55)');
    text('PIXEL', W / 2 + 2, 36, '#000', 4, 'center'); text('PIXEL', W / 2, 34, C.gold, 4, 'center');
    text('GRIDIRON', W / 2 + 2, 60, '#000', 3, 'center'); text('GRIDIRON', W / 2, 58, '#fff', 3, 'center');
    let y = 92;
    if (hasSave()) {
      UI.button(W / 2 - 60, y, 120, 18, 'CONTINUE', () => {
        const c = loadCareer(); if (!c) return app.toast('SAVE IS CORRUPT');
        app.career = c; hub();
      }, { color: C.good }); y += 22;
    }
    UI.button(W / 2 - 60, y, 120, 18, 'NEW CAREER', () => app.go(new NewCareerScene())); y += 22;
    UI.button(W / 2 - 60, y, 120, 18, 'IMPORT SAVE', () => importCareer().then((c) => { app.career = c; saveCareer(c); app.toast('SAVE IMPORTED'); hub(); }).catch((e) => app.toast(String(e.message || e).toUpperCase())), { color: '#5d275d' });
    text('AN ORIGINAL RETRO FOOTBALL GAME - OFFLINE', W / 2, H - 9, '#fff', 1, 'center');
  }
}

// ===================================================================== NEW CAREER
export class NewCareerScene {
  constructor() { this.team = 0; this.diff = 'MEDIUM'; this.qlen = 2; this.dynamic = true; this.noAutosave = true; }
  draw() {
    header('NEW CAREER', '', () => app.go(new TitleScene()));
    const d = TEAM_DATA[this.team];
    panel(20, 24, W - 40, 70);
    UI.button(28, 46, 20, 24, '<', () => { this.team = (this.team + 31) % 32; });
    UI.button(W - 48, 46, 20, 24, '>', () => { this.team = (this.team + 1) % 32; });
    rect(60, 32, 40, 54, d[3]); frame(60, 32, 40, 54, d[4]);
    drawSprite(playerSprite(d[3], d[4], 0, 1, this.team % 4), 77, 48);
    text(d[2], 80, 70, '#fff', 1, 'center');
    text(d[0], 110, 36, '#fff', 2); text(d[1], 110, 52, d[4] === '#111111' ? '#fff' : d[4], 2);
    const conf = Math.floor(this.team / 16), div = Math.floor(this.team / 4) % 4;
    text(`${CONFS[conf]} CONF. - ${DIVS[div]} DIV.`, 110, 70, C.dim);
    text(`TEAM ${this.team + 1}/32`, 110, 80, C.dim);
    UI.button(W - 150, 76, 96, 14, 'RANDOM TEAM', () => { this.team = Math.floor(Math.random() * 32); }, { color: '#5d275d' });
    text('DIFFICULTY', 24, 102, C.gold);
    DIFFS.forEach((df, i) => UI.button(24 + i * 84, 110, 80, 16, df, () => { this.diff = df; }, { selected: this.diff === df, color: this.diff === df ? C.blue : '#333c57' }));
    text('QUARTER LENGTH', 24, 132, C.gold);
    [1, 2, 3].forEach((q, i) => UI.button(24 + i * 56, 140, 52, 16, `${q} MIN`, () => { this.qlen = q; }, { selected: this.qlen === q, color: this.qlen === q ? C.blue : '#333c57' }));
    text('DYNAMIC DIFFICULTY', 210, 132, C.gold);
    UI.button(210, 140, 80, 16, this.dynamic ? 'ON' : 'OFF', () => { this.dynamic = !this.dynamic; }, { color: this.dynamic ? C.good : '#333c57' });
    UI.button(W / 2 - 70, 172, 140, 22, 'START CAREER', () => {
      const go = () => {
        app.career = newCareer({ teamId: this.team, difficulty: this.diff, qlen: this.qlen, dynamic: this.dynamic });
        saveCareer(app.career); hub();
      };
      if (hasSave()) app.confirm('OVERWRITE SAVE?', ['STARTING A NEW CAREER REPLACES YOUR CURRENT SAVE. EXPORT IT FIRST FROM SETTINGS IF YOU WANT TO KEEP IT.'], go, 'START');
      else go();
    }, { color: C.good, scale: 1 });
  }
}

// ===================================================================== HUB
export class HubScene {
  draw() {
    const c = app.career, t = userTeam(c);
    if (!app.modal && c.pending.length) this.showEvent(c);
    rect(0, 0, W, 16, t.c1); rect(0, 15, W, 1, t.c2);
    text(`${t.city} ${t.name}`, 6, 5, '#fff');
    text(`Y${c.year}  ${t.w}-${t.l}${t.t ? '-' + t.t : ''}   CC ${c.cc}`, W - 6, 5, '#fff', 1, 'right');
    // ---- action panel
    panel(4, 20, 188, 112);
    this.actionPanel(c, t);
    // ---- meters
    panel(4, 136, 188, 76);
    const m = (y, label, v, col) => { text(label, 10, y, C.dim); bar(78, y, 106, 5, v, 100, col); };
    m(142, 'FAN RATING', c.fan, '#29adff');
    m(151, 'JOB SECURITY', c.job, c.job < 25 ? C.bad : c.job < 50 ? '#ffa300' : C.good);
    text('SALARY CAP', 10, 160, C.dim); text(`${money(O.capUsed(c))} / ${money(c.cap)}`, 184, 160, '#fff', 1, 'right');
    text(`STARS ${c.roster.length}/${MAX_STARS}`, 10, 169, C.dim);
    text(`OFF ${t.off.toFixed(1)}  DEF ${t.def.toFixed(1)}`, 184, 169, '#fff', 1, 'right');
    const f = c.facilities;
    text('STADIUM', 10, 179, C.dim); stars(52, 179, f.stadium);
    text('TRAIN', 102, 179, C.dim); stars(130, 179, f.training);
    text('REHAB', 10, 188, C.dim); stars(52, 188, f.rehab);
    text(`OC ${c.coords.oc ? c.coords.oc.stars + '*' : '-'}  DC ${c.coords.dc ? c.coords.dc.stars + '*' : '-'}`, 184, 188, '#fff', 1, 'right');
    text(`${c.settings.difficulty}${c.settings.dynamic ? ' (DYN ' + (c.dyn >= 0 ? '+' : '') + c.dyn.toFixed(2) + ')' : ''}  ${c.settings.qlen} MIN QTRS`, 10, 200, C.dim);
    // ---- nav
    const nav = [['ROSTER', () => app.go(new RosterScene())], ['FRONT OFFICE', () => app.go(new OfficeScene())],
      ['FREE AGENTS', () => app.go(new FAScene())], ['SCHEDULE', () => app.go(new ScheduleScene())],
      ['STANDINGS', () => app.go(new StandingsScene())], ['PLAYOFFS', () => app.go(new PlayoffsScene())],
      ['HISTORY', () => app.go(new HistoryScene())], ['NEWS', () => app.go(new NewsScene())],
      ['SETTINGS', () => app.go(new SettingsScene())], ['SAVE & QUIT', () => { saveCareer(c); app.career = null; app.go(new TitleScene()); }]];
    nav.forEach(([l, fn], i) => UI.button(196 + (i % 2) * 94, 20 + Math.floor(i / 2) * 18, 90, 16, l, fn, { color: i === 9 ? '#333c57' : C.blue }));
    panel(196, 112, 184, 100);
    text('NEWS', 202, 117, C.gold);
    c.news.slice(0, 11).forEach((n, i) => text(fitText(n, 172), 202, 126 + i * 8, i ? '#c2c3c7' : '#fff'));
  }
  showEvent(c) {
    const ev = c.pending[0];
    app.modal = { title: ev.title, lines: [ev.q], buttons: ev.a.map((a, i) => ({ label: a[0], fn: () => {
      const r = O.applyChoice(c, ev, i);
      if (r === 'NOT ENOUGH CC') { app.toast(r); return; }
      if (r) app.toast(r);
      saveCareer(c);
    } })) };
  }
  actionPanel(c, t) {
    const st = status(c);
    const X = 12;
    if (st === 'start') {
      text(`SEASON ${c.year}`, X, 28, C.gold, 2);
      text('PRESEASON. SIGN FREE AGENTS, UPGRADE', X, 48, '#fff'); text('FACILITIES OR HIRE STAFF, THEN KICK OFF.', X, 56, '#fff');
      UI.button(X, 100, 172, 24, 'START SEASON', () => { startSeason(c); }, { color: C.good });
      return;
    }
    if (st === 'play') {
      const g = userGameThisWeek(c), o = opponentOf(c, g), home = g.h === c.userTeamId;
      const lbl = c.phase === 'playoffs' ? ROUND_NAMES[c.playoffs.round] : `WEEK ${c.week + 1} OF ${WEEKS}`;
      text(lbl, X, 26, C.gold);
      text(g.neutral ? 'NEUTRAL SITE' : home ? 'HOME' : 'AWAY', 184, 26, C.dim, 1, 'right');
      rect(X, 36, 30, 30, o.c1); frame(X, 36, 30, 30, o.c2);
      drawSprite(playerSprite(o.c1, o.c2, 0, -1, o.id % 4, '#3a3a3a'), X + 12, 46);
      text((home ? 'VS ' : 'AT ') + o.city, X + 36, 38, '#fff'); text(o.name, X + 36, 46, '#fff', 1);
      text(`${o.w}-${o.l}${o.t ? '-' + o.t : ''}`, X + 36, 56, C.dim);
      const dp = diffParams(c);
      const me = teamRatings(c, c.userTeamId);
      text('THEM OFF', X, 72, C.dim); stars(X + 40, 72, Math.round((o.off + dp.cpu) * 2) / 2);
      text('DEF', X + 92, 72, C.dim); stars(X + 108, 72, Math.round((o.def + dp.cpu) * 2) / 2);
      text('YOU  OFF', X, 81, C.dim); stars(X + 40, 81, Math.round(me.off * 2) / 2);
      text('DEF', X + 92, 81, C.dim); stars(X + 108, 81, Math.round(me.def * 2) / 2);
      const inj = c.roster.filter((p) => p.injury).length;
      if (inj) text(`${inj} STAR(S) INJURED`, X, 90, C.bad);
      UI.button(X, 100, 110, 24, 'PLAY GAME', () => this.play(c, g), { color: C.good });
      UI.button(X + 114, 100, 58, 24, 'SIM', () => { const s = simUserGame(c); saveCareer(c); app.go(new PostGameScene(s)); }, { color: '#a7a7a7', textColor: '#000' });
      return;
    }
    if (st === 'simround') {
      const P = c.playoffs;
      text(`PLAYOFFS - ${ROUND_NAMES[P.round]}`, X, 28, C.gold);
      text(userEliminated(c) ? 'YOUR SEASON IS OVER.' : 'YOU HAVE A BYE THIS ROUND.', X, 44, '#fff');
      UI.button(X, 100, 172, 24, `SIM ${ROUND_NAMES[P.round]}`, () => { simRound(c); }, { color: '#a7a7a7', textColor: '#000' });
      return;
    }
    if (st === 'review') {
      text('SEASON COMPLETE', X, 28, C.gold, 2);
      text(`CHAMPION: ${teamName(c.teams[c.playoffs.champion])}`, X, 48, '#fff');
      UI.button(X, 100, 172, 24, 'SEASON REVIEW', () => { O.startOffseason(c); app.go(new AwardsScene()); }, { color: C.good });
      return;
    }
    // offseason stages
    const stage = c.stage;
    text(`OFFSEASON ${c.year}`, X, 28, C.gold, 2);
    const go = { awards: ['SEASON REVIEW', () => app.go(new AwardsScene())], fired: ['JOB OFFERS', () => app.go(new FiredScene())],
      resign: ['RE-SIGN PLAYERS', () => app.go(new ResignScene())], draft: [`DRAFT - ROUND ${c.draft?.round}`, () => app.go(new DraftScene())],
      fa: ['FREE AGENCY', () => app.go(new FAScene())] }[stage];
    const steps = ['awards', 'resign', 'draft', 'fa'];
    steps.forEach((s, i) => text(`${i + 1}. ${s === 'fa' ? 'FREE AGENCY' : s.toUpperCase()}`, X, 48 + i * 9, s === stage || (stage === 'fired' && s === 'awards') ? C.gold : C.dim));
    if (go) UI.button(X, 100, stage === 'fa' ? 84 : 172, 24, go[0], go[1], { color: C.blue });
    if (stage === 'fa') UI.button(X + 88, 100, 84, 24, `BEGIN Y${c.year + 1}`, () => { O.newSeason(c); app.toast(`WELCOME TO SEASON ${c.year}`); }, { color: C.good });
  }
  play(c, g) {
    if (!c.roster.some((p) => p.pos === 'K')) app.toast('NO STAR KICKER - A REGULAR WILL KICK');
    const m = new Match(c, g);
    app.go(new GameScene(m, (res) => {
      const s = finishUserGame(c, g, res); saveCareer(c); app.go(new PostGameScene(s));
    }));
  }
}

// ===================================================================== POSTGAME
export class PostGameScene {
  constructor(s) { this.s = s; }
  draw() {
    const s = this.s, c = app.career;
    header('GAME SUMMARY', s.round, null);
    const res = s.won ? 'WIN' : s.tie ? 'TIE' : 'LOSS';
    panel(10, 22, W - 20, 50);
    text(res, W / 2, 28, s.won ? C.good : s.tie ? C.gold : C.bad, 3, 'center');
    text(`${userTeam(c).abbr} ${s.us} - ${s.them} ${s.opp}${s.ot ? ' (OT)' : ''}`, W / 2, 50, '#fff', 2, 'center');
    panel(10, 76, 180, 116);
    text(`+${s.cc} COACHING CREDITS`, 18, 82, C.gold);
    text('EXPERIENCE', 18, 94, C.dim);
    s.xp.slice().sort((a, b) => b[1] - a[1]).slice(0, 9).forEach(([n, x], i) => { text(fitText(n, 110), 18, 103 + i * 9, '#fff'); text(`+${x} XP`, 182, 103 + i * 9, C.good, 1, 'right'); });
    panel(194, 76, 180, 116);
    text('LEVEL UPS', 202, 82, C.gold);
    (s.levelUps.length ? s.levelUps : ['NONE']).slice(0, 5).forEach((n, i) => text(n + (s.levelUps.length ? ' +1 SKILL PT' : ''), 202, 92 + i * 8, '#fff'));
    text('INJURIES', 202, 140, C.bad);
    (s.injuries.length ? s.injuries : [['NONE', 0]]).slice(0, 5).forEach(([n, w], i) => text(w ? `${n} - ${w} WK` : n, 202, 150 + i * 8, '#fff'));
    UI.button(W / 2 - 60, 196, 120, 16, 'CONTINUE', hub, { color: C.good });
  }
}

// ===================================================================== ROSTER
const POS_ORDER = ['QB', 'RB', 'WR', 'TE', 'OL', 'K', 'DL', 'LB', 'DB'];
function rosterRows(list, y0, onPick, opts = {}) {
  text('POS NAME', 8, y0, C.dim); text('AGE', 112, y0, C.dim); text('RATING', 132, y0, C.dim);
  text(opts.col4 ?? 'MOR', 196, y0, C.dim); text(opts.col5 ?? 'CND', 228, y0, C.dim); text(opts.salLabel || 'SALARY', 258, y0, C.dim); text('YRS', 300, y0, C.dim);
  list.forEach((p, i) => {
    const y = y0 + 9 + i * 12;
    rect(4, y - 2, W - 8, 11, i % 2 ? '#1a1c2c' : '#22253a');
    UI.zone(4, y - 2, W - 8, 11, () => onPick(p));
    text(p.pos, 8, y, C.gold); text(fitText(displayName(p), 82), 24, y, p.injury ? C.bad : '#fff');
    text(p.age, 112, y, '#fff');
    stars(132, y, opts.scout ? p.scout.stars : p.stars);
    if (opts.c4) opts.c4(p, y); else bar(196, y + 1, 26, 3, p.morale, 100, p.morale < 30 ? C.bad : C.good);
    if (opts.c5) opts.c5(p, y); else if (p.injury) text(`INJ${p.injury}`, 228, y, C.bad); else bar(228, y + 1, 26, 3, p.condition, 100, '#29adff');
    text(money(opts.sal ? opts.sal(p) : p.salary), 258, y, '#fff'); text(p.years, 304, y, p.years <= 1 ? '#ffa300' : '#fff');
    if (p.skillPts > 0) text(`+${p.skillPts}`, 320, y, C.good);
    if (p.tradeReq) text('TRADE!', 336, y, C.bad);
  });
}
export class RosterScene {
  draw() {
    const c = app.career;
    header('ROSTER', `${c.roster.length}/${MAX_STARS} STARS  CAP ${money(O.capRoom(c))} LEFT`);
    const list = c.roster.slice().sort((a, b) => POS_ORDER.indexOf(a.pos) - POS_ORDER.indexOf(b.pos) || b.stars - a.stars);
    rosterRows(list, 22, (p) => app.go(new PlayerScene(p, 'roster', () => app.go(new RosterScene()))));
    const lu = buildLineup(c.roster);
    const empty = POS_ORDER.filter((pos) => lu[pos].some((p) => p.regular)).join(' ');
    text('REGULARS START AT: ' + (empty || '-'), 8, H - 10, C.dim);
  }
}
export class PlayerScene {
  constructor(p, mode, back, action) { this.p = p; this.mode = mode; this.back = back; this.action = action; }
  draw() {
    const c = app.career, p = this.p, t = userTeam(c);
    header(`${p.pos} ${p.first} ${p.last}`, this.mode === 'roster' ? `CC ${c.cc}` : '', this.back);
    panel(4, 20, 120, 100);
    rect(10, 26, 30, 36, t.c1); drawSprite(playerSprite(t.c1, t.c2, 0, 1, p.skin || 0), 22, 38);
    text(`AGE ${p.age}`, 46, 27, '#fff');
    const sc = this.mode === 'draft' ? p.scout : null;
    text('RATING', 46, 37, C.dim); stars(46, 45, sc ? sc.stars : p.stars);
    text('POTENTIAL', 46, 54, C.dim);
    if (sc) text(`${sc.potLo}-${sc.potHi} (SCOUTED)`, 46, 62, '#fff'); else stars(46, 62, p.pot, 5, '#c2c3c7');
    if (this.mode === 'roster') {
      text(`LEVEL ${p.level}`, 10, 74, '#fff'); bar(50, 75, 68, 4, p.xp, xpForLevel(p.level), C.gold);
      text(`SKILL POINTS: ${p.skillPts}`, 10, 84, p.skillPts ? C.good : C.dim);
      text('MORALE', 10, 96, C.dim); bar(50, 97, 68, 4, p.morale, 100, p.morale < 30 ? C.bad : C.good);
      text('CONDITION', 10, 105, C.dim); bar(50, 106, 68, 4, p.condition, 100, '#29adff');
      if (p.injury) text(`INJURED - ${p.injury} WK`, 10, 113, C.bad);
    }
    panel(128, 20, 252, 56);
    text('ATTRIBUTES', 134, 25, C.gold);
    ATTRS[p.pos].forEach((k, i) => {
      const y = 35 + i * 10;
      text(ATTR_LABEL[k], 134, y, '#fff');
      const v = sc ? null : p.attrs[k];
      if (v === null) text('??', 220, y, C.dim);
      else { for (let j = 0; j < 10; j++) rect(220 + j * 11, y, 9, 5, j < v ? (v >= 8 ? C.gold : C.good) : '#333c57'); }
      if (this.mode === 'roster' && p.skillPts > 0 && v < 10) UI.button(334, y - 2, 14, 9, '+', () => err(O.spendPoint(p, k)), { color: C.good });
    });
    // contract & stats
    panel(128, 80, 252, 40);
    text(`CONTRACT ${money(p.salary)} X ${p.years} YR`, 134, 85, '#fff');
    if (this.mode === 'roster') text(`EXTEND ASK ${money(O.askSalary(p))} / ${O.extendCC(p)} CC`, 134, 94, C.dim);
    if (this.mode === 'fa') text(`SIGNING COST ${O.faCC(p)} CC`, 134, 94, C.gold);
    if (p.tradeReq) text('HAS REQUESTED A TRADE', 134, 103, C.bad);
    panel(4, 124, 376, 52);
    text('SEASON', 10, 129, C.gold); text('CAREER', 10, 151, C.gold);
    if (p.season) { text(statLine(p, p.season), 10, 138, '#fff'); text(statLine(p, p.career), 10, 160, '#fff'); }
    // actions
    const y = 182;
    if (this.mode === 'roster') {
      const a = [
        [`MEET +MOR 1CC`, () => err(O.meetPlayer(c, p))],
        [`REST +CND 1CC`, () => err(O.restPlayer(c, p))],
        [`EXTEND 3 YRS`, () => err(O.extendPlayer(c, p, 3)), p.years > 2],
        [`TRADE`, () => app.confirm('TRADE PLAYER?', [`TRADE ${displayName(p)} FOR ROUGHLY ${Math.max(1, Math.round(p.stars * (p.age < 30 ? 1 : 0.6)))} CC?`], () => { O.tradePlayer(c, p); app.go(new RosterScene()); })],
        [`RELEASE`, () => app.confirm('RELEASE PLAYER?', [`${displayName(p)} WILL LEAVE THE TEAM. NO COMPENSATION.`], () => { O.releasePlayer(c, p); app.go(new RosterScene()); }, 'RELEASE')],
      ];
      a.forEach(([l, fn, dis], i) => UI.button(4 + i * 76, y, 72, 18, l, fn, { disabled: dis, color: i >= 3 ? '#b13e53' : C.blue }));
    } else if (this.action) UI.button(W / 2 - 60, y, 120, 18, this.action[0], this.action[1], { color: C.good });
  }
}
function statLine(p, s) {
  const pos = p.pos;
  const gp = `GP ${s.gp}  `;
  if (pos === 'QB') return gp + `CMP ${s.pcmp}/${s.patt}  YDS ${s.pyds}  TD ${s.ptd}  INT ${s.pint}  RUSH ${s.ryds}`;
  if (pos === 'RB') return gp + `ATT ${s.ratt}  YDS ${s.ryds}  TD ${s.rtd}  REC ${s.rec}  REC YDS ${s.recyds}`;
  if (pos === 'WR' || pos === 'TE') return gp + `REC ${s.rec}  YDS ${s.recyds}  TD ${s.rectd}`;
  if (pos === 'K') return gp + `FG ${s.fgm}/${s.fga}  XP ${s.xpm}/${s.xpa}`;
  if (pos === 'OL') return gp + 'BLOCKING FOR THE OFFENSE';
  return gp + `TKL ${s.tkl}  SACKS ${s.sck}  INT ${s.dint}`;
}

// ===================================================================== FRONT OFFICE
export class OfficeScene {
  constructor() { this.tab = 0; }
  draw() {
    const c = app.career;
    header('FRONT OFFICE', `CC ${c.cc}`);
    ['FACILITIES', 'STAFF', 'FINANCE'].forEach((l, i) => UI.button(4 + i * 80, 19, 76, 14, l, () => { this.tab = i; }, { selected: this.tab === i, color: this.tab === i ? C.blue : '#333c57' }));
    if (this.tab === 0) {
      const info = { stadium: 'RAISES FAN RATING AND CC PER GAME', training: 'SPEEDS UP XP GAIN FOR ALL STARS', rehab: 'FASTER INJURY AND CONDITION RECOVERY' };
      Object.keys(info).forEach((k, i) => {
        const y = 40 + i * 44, lvl = c.facilities[k];
        panel(4, y, 376, 40);
        text(k.toUpperCase(), 12, y + 7, C.gold, 2); stars(12, y + 24, lvl);
        text(info[k], 120, y + 9, '#fff');
        text('FACILITIES DECAY 0.5 STARS EACH OFFSEASON', 120, y + 19, C.dim);
        UI.button(270, y + 20, 104, 14, lvl >= 5 ? 'MAXED' : `UPGRADE ${O.facilityCost(lvl)} CC`, () => err(O.upgradeFacility(c, k)), { disabled: lvl >= 5, color: C.good });
      });
    } else if (this.tab === 1) {
      const pool = O.coordPool(c);
      ['oc', 'dc'].forEach((role, i) => {
        const x = 4 + i * 190;
        panel(x, 38, 186, 172);
        text(role === 'oc' ? 'OFFENSIVE COORD.' : 'DEFENSIVE COORD.', x + 6, 44, C.gold);
        const cur = c.coords[role];
        text(cur ? cur.name : 'VACANT', x + 6, 54, '#fff'); if (cur) stars(x + 100, 54, cur.stars);
        text(role === 'oc' ? '+OFF XP, SHARPER ROUTES' : '+DEF XP, STRONGER SIM DEFENSE', x + 6, 63, C.dim);
        if (cur) UI.button(x + 120, 70, 60, 12, 'FIRE', () => app.confirm('FIRE COORDINATOR?', [`${cur.name} WILL BE LET GO.`], () => O.fireCoord(c, role), 'FIRE'), { color: '#b13e53' });
        text('CANDIDATES', x + 6, 88, C.gold);
        pool[role].forEach((cand, j) => {
          const y = 98 + j * 20;
          text(fitText(cand.name, 80), x + 6, y + 3, '#fff'); stars(x + 6, y + 10, cand.stars);
          UI.button(x + 110, y, 70, 16, `HIRE ${cand.cost} CC`, () => {
            const doIt = () => err(O.hireCoord(c, role, cand));
            if (cur) app.confirm('REPLACE?', [`HIRING ${cand.name} REPLACES ${cur.name}.`], doIt, 'HIRE'); else doIt();
          }, { color: C.good });
        });
      });
    } else {
      panel(4, 40, 376, 80);
      text('SALARY CAP', 12, 47, C.gold, 2);
      text(`USED ${money(O.capUsed(c))} OF ${money(c.cap)}  -  ROOM ${money(O.capRoom(c))}`, 12, 66, '#fff');
      text('ONLY STAR PLAYERS COUNT AGAINST THE CAP.', 12, 76, C.dim);
      UI.button(12, 90, 160, 18, `RAISE CAP +$${O.COSTS.capStep}M (${O.COSTS.capRaise} CC)`, () => err(O.raiseCap(c)), { color: C.good });
      panel(4, 124, 376, 86);
      text('COACHING CREDITS', 12, 131, C.gold, 2);
      ['EARNED AFTER EVERY GAME: 3 WIN / 2 TIE / 1 LOSS', 'BONUS FROM FAN RATING (UP TO +2) AND STADIUM (UP TO +2)', 'PLAYOFF GAMES +2, PIXEL BOWL TITLE +5',
        'SPEND ON FACILITIES, STAFF, MEETINGS, REST, CONTRACTS,', 'FREE AGENTS AND THE SALARY CAP.'].forEach((l, i) => text(l, 12, 148 + i * 9, '#fff'));
    }
  }
}

// ===================================================================== FREE AGENTS
export class FAScene {
  draw() {
    const c = app.career;
    header('FREE AGENTS', `CC ${c.cc}  ROOM ${money(O.capRoom(c))}  ${c.roster.length}/${MAX_STARS}`);
    if (!c.freeAgents.length) { text('NO FREE AGENTS AVAILABLE RIGHT NOW.', W / 2, 100, C.dim, 1, 'center'); return; }
    rosterRows(c.freeAgents, 22, (p) => this.open(p), { col4: 'POT', c4: (p, y) => text(p.pot, 198, y, '#c2c3c7'), col5: 'CC', c5: (p, y) => text(O.faCC(p), 230, y, C.gold) });
    c.freeAgents.forEach((p, i) => UI.button(338, 29 + i * 12, 42, 10, 'SIGN', () => this.sign(p), { color: C.good }));
    text('TAP A PLAYER FOR DETAILS. SIGNING COSTS CC + CAP SPACE.', 8, H - 10, C.dim);
  }
  open(p) { app.go(new PlayerScene(p, 'fa', () => app.go(new FAScene()), ['SIGN', () => { if (!this.sign(p)) app.go(new FAScene()); }])); }
  sign(p) { const c = app.career; return err(O.signFA(c, p)); }
}

// ===================================================================== DRAFT
export class DraftScene {
  draw() {
    const c = app.career, d = c.draft;
    if (!d || c.stage !== 'draft') { hub(); return; }
    header(`DRAFT - ROUND ${d.round} OF 3`, `${c.roster.length}/${MAX_STARS} STARS  ROOM ${money(O.capRoom(c))}`);
    rosterRows(d.pool, 22, (p) => this.open(p), { scout: true, col4: 'POT', c4: (p, y) => text(`${p.scout.potLo}-${p.scout.potHi}`, 196, y, '#c2c3c7'), col5: '', c5: () => {} });
    d.pool.forEach((p, i) => UI.button(338, 29 + i * 12, 42, 10, 'PICK', () => this.pick(p), { color: C.good }));
    text('SCOUTED RATINGS ARE ESTIMATES (+-0.5). ROOKIE DEALS: 3 YEARS.', 8, 120, C.dim);
    UI.button(8, 134, 110, 16, 'SKIP THIS PICK', () => { O.nextDraftRound(c); if (c.stage !== 'draft') hub(); }, { color: '#333c57' });
    UI.button(124, 134, 110, 16, 'MANAGE ROSTER', () => app.go(new RosterScene()), { color: C.blue });
    if (d.picks.length) text(`DRAFTED: ${d.picks.map((id) => { const p = c.roster.find((x) => x.id === id); return p ? `${p.pos} ${p.last}` : '?'; }).join(', ')}`, 8, 160, C.good);
  }
  open(p) { app.go(new PlayerScene(p, 'draft', () => app.go(new DraftScene()), ['DRAFT HIM', () => this.pick(p)])); }
  pick(p) {
    const c = app.career;
    if (err(O.draftPick(c, p))) return;
    app.toast(`DRAFTED ${p.pos} ${displayName(p)} - TRUE RATING ${p.stars}`);
    if (c.stage === 'draft') app.go(new DraftScene()); else app.go(new FAScene());
  }
}

// ===================================================================== RESIGN
export class ResignScene {
  draw() {
    const c = app.career;
    if (c.stage !== 'resign') { hub(); return; }
    header('EXPIRING CONTRACTS', `CC ${c.cc}  ROOM ${money(O.capRoom(c))}`);
    const list = c.expiring.map((id) => c.roster.find((p) => p.id === id)).filter(Boolean);
    if (!list.length) text('NO EXPIRING CONTRACTS THIS YEAR.', W / 2, 60, C.dim, 1, 'center');
    else rosterRows(list, 22, (p) => app.go(new PlayerScene(p, 'roster', () => app.go(new ResignScene()))), { col5: 'CC', c5: (p, y) => text(O.extendCC(p), 230, y, C.gold), salLabel: 'ASKING', sal: (p) => O.askSalary(p) });
    list.forEach((p, i) => UI.button(338, 29 + i * 12, 42, 10, 'SIGN', () => err(O.resignPlayer(c, p)), { color: C.good }));
    if (list.length) text('RE-SIGNED PLAYERS GET 3 YEARS AT THEIR ASKING SALARY. UNHAPPY PLAYERS WALK.', 8, 180, C.dim);
    UI.button(W / 2 - 70, 192, 140, 18, list.length ? 'DONE - LET THE REST GO' : 'CONTINUE TO DRAFT', () => {
      const go = () => { O.finishResign(c); app.go(new DraftScene()); };
      if (list.length) app.confirm('LET PLAYERS GO?', [`${list.length} UNSIGNED PLAYER(S) WILL LEAVE IN FREE AGENCY.`], go, 'CONFIRM'); else go();
    }, { color: C.good });
  }
}

// ===================================================================== AWARDS / FIRED
export class AwardsScene {
  draw() {
    const c = app.career, e = c.seasonEnd;
    if (!e) { hub(); return; }
    const t = userTeam(c);
    header(`SEASON ${c.year} REVIEW`, '', null);
    panel(4, 20, 376, 40);
    text(`${t.city} ${t.name}: ${t.w}-${t.l}${t.t ? '-' + t.t : ''}`, 12, 26, '#fff', 1);
    text(e.res.text, 12, 38, e.res.title ? C.gold : e.res.made ? C.good : C.bad, 2);
    text(`PIXEL BOWL CHAMPION: ${e.champ}`, 372, 26, C.dim, 1, 'right');
    panel(4, 64, 376, 70);
    text('AWARDS', 12, 70, C.gold);
    e.awards.forEach(([a, w], i) => { text(a, 12, 80 + i * 9, C.dim); text(w, 110, 80 + i * 9, '#fff'); });
    panel(4, 138, 376, 48);
    text('OWNER REVIEW', 12, 144, C.gold);
    if (c.stage === 'awards') text('THE OWNER WANTS TO SEE YOU...', 12, 156, '#fff');
    else {
      text(`JOB SECURITY ${e.jobDelta >= 0 ? '+' : ''}${e.jobDelta} -> ${Math.round(c.job)}`, 12, 156, e.jobDelta >= 0 ? C.good : C.bad);
      text(c.stage === 'fired' ? 'YOU HAVE BEEN FIRED.' : 'YOUR JOB IS SAFE. FOR NOW.', 12, 166, c.stage === 'fired' ? C.bad : '#fff');
    }
    if (c.stage === 'awards') UI.button(W / 2 - 60, 192, 120, 18, 'MEET THE OWNER', () => { O.jobReview(c); if (c.stage === 'fired') sfx.bad(); }, { color: C.blue });
    else UI.button(W / 2 - 60, 192, 120, 18, 'CONTINUE', () => app.go(c.stage === 'fired' ? new FiredScene() : new ResignScene()), { color: C.good });
  }
}
export class FiredScene {
  draw() {
    const c = app.career;
    if (c.stage !== 'fired') { hub(); return; }
    header('YOU\'RE FIRED', '', null);
    text('THE OWNER HAS LOST PATIENCE. BUT OTHER CLUBS ARE CALLING...', 8, 24, '#fff');
    c.offers.forEach((id, i) => {
      const t = c.teams[id], y = 40 + i * 52;
      panel(8, y, 368, 48);
      rect(16, y + 8, 32, 32, t.c1); frame(16, y + 8, 32, 32, t.c2);
      text(`${t.city} ${t.name}`, 56, y + 8, '#fff', 1);
      text(`LAST SEASON ${t.w}-${t.l}${t.t ? '-' + t.t : ''}`, 56, y + 18, C.dim);
      text('OFF', 56, y + 30, C.dim); stars(74, y + 30, Math.round(t.off * 2) / 2);
      text('DEF', 112, y + 30, C.dim); stars(130, y + 30, Math.round(t.def * 2) / 2);
      UI.button(286, y + 16, 82, 18, 'ACCEPT', () => app.confirm('TAKE THIS JOB?', [`YOU WILL TAKE OVER THE ${t.city} ${t.name} WITH THEIR ROSTER. HALF YOUR CC COMES WITH YOU.`], () => { O.acceptOffer(c, id); app.go(new ResignScene()); }, 'ACCEPT'), { color: C.good });
    });
  }
}

// ===================================================================== SCHEDULE / STANDINGS / PLAYOFFS
export class ScheduleScene {
  draw() {
    const c = app.career, u = c.userTeamId;
    header(`SCHEDULE ${c.year}`);
    c.schedule.forEach((wk, i) => {
      const g = wk.find((x) => x.h === u || x.a === u);
      const x = i < 8 ? 6 : 196, y = 24 + (i % 8) * 22;
      const home = g.h === u, o = c.teams[home ? g.a : g.h];
      rect(x, y, 182, 20, i === c.week && c.phase === 'regular' ? '#333c57' : '#1a1c2c');
      rect(x, y, 4, 20, o.c1);
      text(`WK ${i + 1}`, x + 8, y + 3, C.dim); text(`${home ? 'VS' : 'AT'} ${o.city}`, x + 8, y + 11, '#fff');
      if (g.hs !== null) {
        const us = home ? g.hs : g.as, th = home ? g.as : g.hs;
        text(`${us > th ? 'W' : us < th ? 'L' : 'T'} ${us}-${th}${g.ot ? ' OT' : ''}`, x + 176, y + 7, us > th ? C.good : us < th ? C.bad : C.gold, 1, 'right');
      } else text(`${o.w}-${o.l}`, x + 176, y + 7, C.dim, 1, 'right');
    });
  }
}
export class StandingsScene {
  constructor() { this.conf = userTeam(app.career).conf; }
  draw() {
    const c = app.career;
    header(`STANDINGS - ${CONFS[this.conf]}`);
    UI.button(W - 130, 1, 82, 14, `SHOW ${CONF_ABBR[1 - this.conf]}`, () => { this.conf = 1 - this.conf; }, { color: C.blue });
    for (let d = 0; d < 4; d++) {
      const x = 4 + (d % 2) * 190, y = 20 + Math.floor(d / 2) * 96;
      panel(x, y, 186, 92);
      text(`${CONF_ABBR[this.conf]} ${DIVS[d]}`, x + 6, y + 6, C.gold);
      text('W-L-T', x + 104, y + 6, C.dim); text('PF-PA', x + 140, y + 6, C.dim);
      divisionTeams(c, this.conf, d).forEach((t, i) => {
        const yy = y + 18 + i * 17, me = t.id === c.userTeamId;
        if (me) rect(x + 3, yy - 3, 180, 13, '#333c57');
        rect(x + 6, yy - 2, 3, 11, t.c1);
        text(t.city, x + 12, yy, me ? C.gold : '#fff'); text(t.name, x + 12, yy + 6, C.dim);
        text(`${t.w}-${t.l}-${t.t}`, x + 104, yy + 2, '#fff'); text(`${t.pf}-${t.pa}`, x + 140, yy + 2, '#c2c3c7');
      });
    }
  }
}
export class PlayoffsScene {
  draw() {
    const c = app.career, P = c.playoffs;
    header('PLAYOFFS');
    if (!P) {
      text('PLAYOFF PICTURE (TOP 6 PER CONFERENCE AFTER WEEK 16)', W / 2, 24, C.dim, 1, 'center');
      for (let conf = 0; conf < 2; conf++) {
        const x = 8 + conf * 190;
        text(CONFS[conf], x, 36, C.gold);
        const winners = [0, 1, 2, 3].map((d) => divisionTeams(c, conf, d)[0]);
        winners.forEach((t, i) => text(`DIV  ${t.abbr} ${t.w}-${t.l}-${t.t}`, x, 48 + i * 9, t.id === c.userTeamId ? C.gold : '#fff'));
      }
      return;
    }
    ROUND_NAMES.forEach((rn, r) => {
      const x = 4 + r * 95;
      text(rn, x + 2, 22, C.gold);
      const games = P.rounds[r] || [];
      games.forEach((g, i) => {
        const y = 32 + i * 34 + (r === 1 ? 0 : r === 2 ? 30 : r === 3 ? 60 : 0);
        panel(x, y, 91, 30);
        const line = (id, seed, sc, yy, win) => {
          const t = c.teams[id];
          rect(x + 3, yy, 3, 8, t.c1);
          text(`${seed ? seed + ' ' : ''}${t.abbr}`, x + 9, yy + 1, id === c.userTeamId ? C.gold : win ? '#fff' : C.dim);
          if (sc !== null) text(sc, x + 86, yy + 1, win ? '#fff' : C.dim, 1, 'right');
        };
        const done = g.hs !== null;
        line(g.h, g.hseed, g.hs, y + 4, !done || g.hs > g.as);
        line(g.a, g.aseed, g.as, y + 16, !done || g.as > g.hs);
      });
      if (r === 0) text('SEEDS 1-2 BYE', x + 2, 172, C.dim);
    });
    if (P.champion !== null) text(`CHAMPION: ${teamName(c.teams[P.champion])}`, W / 2, 200, C.gold, 1, 'center');
  }
}

// ===================================================================== HISTORY / NEWS
export class HistoryScene {
  constructor() { this.page = 0; }
  draw() {
    const c = app.career, co = c.coach;
    header('CAREER HISTORY');
    panel(4, 20, 376, 34);
    text(`COACH ${co.name}`, 12, 26, C.gold);
    text(`CAREER ${co.wins}-${co.losses}-${co.ties}   TITLES ${co.titles}   TEAMS ${co.teams.join(' > ')}`, 12, 38, '#fff');
    text('YEAR TEAM  RECORD   RESULT                 TEAM MVP', 8, 60, C.dim);
    const per = 14, list = c.history.slice(this.page * per, this.page * per + per);
    if (!c.history.length) text('NO COMPLETED SEASONS YET.', 8, 72, '#fff');
    list.forEach((h, i) => {
      const y = 70 + i * 9;
      text(`Y${h.year}`, 8, y, '#fff'); text(h.team, 28, y, C.gold); text(`${h.w}-${h.l}-${h.t}`, 52, y, '#fff');
      text(fitText(h.result, 92), 88, y, h.result.includes('CHAMP') ? C.gold : '#fff'); text(fitText(h.mvp, 110), 188, y, '#c2c3c7');
    });
    pager(this, c.history.length, per, 300, 200);
    if (c.seasonEnd) UI.button(8, 198, 120, 14, 'LAST SEASON AWARDS', () => app.go(new AwardsScene()), { color: C.blue });
  }
}
export class NewsScene {
  constructor() { this.page = 0; }
  draw() {
    const c = app.career;
    header('NEWS');
    const per = 20, list = c.news.slice(this.page * per, this.page * per + per);
    list.forEach((n, i) => text(fitText(n, 372), 8, 22 + i * 9, i === 0 && this.page === 0 ? '#fff' : '#c2c3c7'));
    pager(this, c.news.length, per, 300, 200);
  }
}

// ===================================================================== SETTINGS
export class SettingsScene {
  draw() {
    const c = app.career, s = c.settings;
    header('SETTINGS');
    text('QUARTER LENGTH', 12, 26, C.gold);
    [1, 2, 3].forEach((q, i) => UI.button(12 + i * 56, 34, 52, 16, `${q} MIN`, () => { s.qlen = q; }, { selected: s.qlen === q, color: s.qlen === q ? C.blue : '#333c57' }));
    text('DIFFICULTY', 12, 58, C.gold);
    DIFFS.forEach((d, i) => UI.button(12 + i * 84, 66, 80, 16, d, () => { s.difficulty = d; }, { selected: s.difficulty === d, color: s.difficulty === d ? C.blue : '#333c57' }));
    text('DYNAMIC DIFFICULTY', 12, 90, C.gold);
    UI.button(12, 98, 80, 16, s.dynamic ? 'ON' : 'OFF', () => { s.dynamic = !s.dynamic; }, { color: s.dynamic ? C.good : '#333c57' });
    text(`CURRENT OFFSET ${c.dyn >= 0 ? '+' : ''}${c.dyn.toFixed(2)} (RISES WITH WINS)`, 100, 103, C.dim);
    text('SOUND', 12, 122, C.gold);
    UI.button(12, 130, 80, 16, s.sound ? 'ON' : 'OFF', () => { s.sound = !s.sound; }, { color: s.sound ? C.good : '#333c57' });
    text('SAVE DATA (AUTOSAVES AFTER EVERY GAME AND MENU ACTION)', 12, 154, C.gold);
    UI.button(12, 162, 110, 16, 'EXPORT SAVE', () => { exportCareer(c); app.toast('SAVE EXPORTED AS JSON'); }, { color: C.blue });
    UI.button(128, 162, 110, 16, 'IMPORT SAVE', () => importCareer().then((nc) => { app.career = nc; saveCareer(nc); app.toast('SAVE IMPORTED'); hub(); }).catch((e) => app.toast(String(e.message || e).toUpperCase())), { color: '#5d275d' });
    UI.button(244, 162, 110, 16, 'DELETE SAVE', () => app.confirm('DELETE SAVE?', ['THIS ERASES YOUR CAREER FROM THIS BROWSER. THIS CANNOT BE UNDONE.'], () => { deleteSave(); app.career = null; app.go(new TitleScene()); }, 'DELETE'), { color: '#b13e53' });
  }
}
