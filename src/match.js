// Game rules: clock, downs, scoring, kicks, punts, simulated opponent drives, overtime.
import { RNG, clamp } from './rng.js';
import { buildLineup, eff, makeRegular, displayName } from './players.js';
import { PlaySim, FW } from './play.js';
import { choosePlay } from './playbook.js';
import { diffParams, driveOutcome, userDefRating, userTeam } from './league.js';

const HASH_L = 23.6, HASH_R = 29.7;
export const RUNOFF = 6; // game seconds between plays while the clock runs (ASSUMED)

export class KickGame {
  constructor({ dist, kicker, wind, kind }) {
    this.dist = dist; this.kind = kind; this.wind = wind;
    this.acc = eff(kicker, 'ACC'); this.leg = eff(kicker, 'LEG'); this.cmp = eff(kicker, 'CMP');
    this.maxRange = 38 + this.leg * 3;
    this.stage = 'aim'; this.t = 0; this.ang = 0; this.power = 0; this.pdir = 1; this.u = 0; this.done = false; this.good = false;
    this.omega = 1.6 + (10 - this.acc) * 0.25 + (10 - this.cmp) * 0.06;
    this.A = 9;
  }
  update(dt) {
    this.t += dt;
    if (this.stage === 'aim') this.ang = Math.sin(this.t * this.omega) * this.A;
    else if (this.stage === 'power') {
      this.power += this.pdir * dt * 1.15;
      if (this.power >= 1) { this.power = 1; this.pdir = -1; } else if (this.power <= 0) { this.power = 0; this.pdir = 1; }
    } else if (this.stage === 'flight') {
      this.u += dt / 1.4;
      if (this.u >= 1.5) this.done = true;
    }
  }
  tap() {
    if (this.stage === 'aim') { this.lockAng = this.ang; this.stage = 'power'; return 'aim'; }
    if (this.stage === 'power') {
      this.lockPow = this.power; this.stage = 'flight';
      this.range = this.lockPow * this.maxRange;
      let lat = Math.tan(this.lockAng * Math.PI / 180) * this.dist + this.wind * this.dist * 0.012;
      if (this.lockPow > 0.92) lat += (this.lockPow - 0.92) * 30 * (this.lockAng >= 0 ? 1 : -1);
      this.lateral = lat;
      const short = this.range < this.dist;
      this.good = !short && Math.abs(lat) <= 3.08;
      this.why = short ? 'SHORT' : this.good ? 'GOOD' : lat < 0 ? 'WIDE LEFT' : 'WIDE RIGHT';
      return 'kick';
    }
    if (this.stage === 'flight' && this.u > 1) this.done = true;
    return null;
  }
}

export class Match {
  constructor(c, game) {
    this.c = c; this.g = game;
    this.userHome = game.h === c.userTeamId;
    this.me = userTeam(c); this.opp = c.teams[this.userHome ? game.a : game.h];
    this.playoff = c.phase === 'playoffs';
    this.qlen = c.settings.qlen * 60; this.q = 1; this.clock = this.qlen;
    this.score = { u: 0, o: 0 }; this.to = { u: 3, o: 3 };
    this.rng = new RNG((c.rng ^ (c.week * 7919 + c.year * 104729 + this.opp.id * 31)) >>> 0);
    this.dp = diffParams(c);
    this.lineup = buildLineup(c.roster);
    this.oppOff = this.opp.off + this.dp.cpu; this.oppDef = this.opp.def + this.dp.cpu;
    this.userDef = userDefRating(c);
    this.stats = {}; this.team = { pyds: 0, ryds: 0, oppYds: 0, plays: 0 };
    this.wind = Math.round(this.rng.range(-12, 12));
    // weather & kickoff time: cold-weather home teams get snow late in the season
    const home = c.teams[game.h];
    const cold = ['IRONPORT', 'NORTHVALE', 'STORMRIDGE', 'FROSTBURG', 'KINGSBRIDGE', 'MAPLE RIDGE', 'YELLOWROCK', 'SILVERTON', 'CRESTWOOD'].includes(home.city);
    const late = c.phase === 'playoffs' || c.week >= 10;
    this.weather = cold && late && this.rng.chance(0.55) ? 'snow' : this.rng.chance(0.14) ? 'rain' : 'clear';
    this.night = this.rng.chance(c.phase === 'playoffs' ? 0.6 : 0.33);
    this.phase = 'msg'; this.msg = ''; this.timer = 0; this.next_ = null;
    this.ot = null; this.runoff = 0; this.conv = false; this.play = null; this.kick = null;
    this.ballYard = 25; this.ballY = 26.67; this.down = 1; this.toGo = 10; this.fd = 35;
    this.feed = []; this.sfx = [];
    this.over = false;
    this.coin();
  }
  get K() { return this.lineup.K[0]; }
  st(p) { if (!p || !p.id) return null; return (this.stats[p.id] ||= {}); }
  inc(p, k, n = 1) { const s = this.st(p); if (s) s[k] = (s[k] || 0) + n; }
  say(text, next, dur = 1.4) { this.phase = 'msg'; this.msg = text; this.timer = dur; this.next_ = next; this.log(text); }
  log(t) { this.feed.unshift(t); if (this.feed.length > 6) this.feed.length = 6; }
  choice(title, options) { this.phase = 'choice'; this.choiceTitle = title; this.options = options; }
  skip() { if (this.phase === 'msg') this.timer = 0; if (this.phase === 'opp') this.oppFast = true; }
  update(dt) {
    if (this.phase === 'msg') {
      this.timer -= dt;
      if (this.timer <= 0) { const n = this.next_; this.next_ = null; if (n) n(); }
    } else if (this.phase === 'presnap') {
      if (this.runoff > 0) {
        const d = Math.min(this.runoff, dt * 3); this.runoff -= d; this.clock = Math.max(0, this.clock - d);
        if (this.clock <= 0) { this.runoff = 0; this.play = null; return this.next(() => this.toPresnap()); }
      }
    } else if (this.phase === 'live') {
      if (!this.conv) this.clock = Math.max(0, this.clock - dt);
      this.play.update(dt);
      for (const e of this.play.events) this.sfx.push(e);
      this.play.events.length = 0;
      if (this.play.done) this.afterPlay(this.play.result);
    } else if (this.phase === 'kick') {
      this.kick.update(dt);
      if (this.kick.done) this.afterKick();
    } else if (this.phase === 'opp') this.oppUpdate(dt);
  }
  // ---------- flow helpers ----------
  next(fn) { if (this.clock <= 0 && !this.conv) return this.endQuarter(fn); fn(); }
  coin() {
    const win = this.rng.chance(0.5);
    const recv = win ? 'u' : 'o';
    if (this.q === 1) this.firstRecv = recv;
    this.sfx.push('whistle');
    this.say(`COIN TOSS: ${win ? 'YOU WIN' : this.opp.abbr + ' WIN'}. ${win ? 'YOU' : 'THEY'} RECEIVE`, () => this.kickoff(recv), 2);
  }
  kickoff(recv) {
    this.sfx.push('kick'); this.play = null;
    const rng = this.rng;
    if (recv === 'u') {
      if (rng.chance(0.35)) return this.say('KICKED THROUGH THE END ZONE - TOUCHBACK', () => this.startDrive(25));
      return this.startReturn();
    } else {
      const y = rng.chance(0.55) ? 25 : rng.int(15, 40);
      this.say(y === 25 ? 'YOU KICK OFF - TOUCHBACK' : `YOU KICK OFF - RETURNED TO THEIR ${y}`, () => this.oppDrive(y));
    }
  }
  startReturn() {
    this.play = new PlaySim({ mode: 'return', lineup: this.lineup, defRating: this.oppDef, diff: this.dp, rng: this.rng, weather: this.weather });
    this.phase = 'live';
    this.log(`${this.opp.abbr} KICK OFF`);
  }
  afterReturn(r) {
    this.play.done = false;
    if (r.kind === 'td') { this.score.u += 6; this.sfx.push('td'); return this.say('KICK RETURN TOUCHDOWN!', () => this.afterTD('u'), 2.2); }
    if (r.kind === 'fumble') {
      const oy = clamp(Math.round(100 - (r.x - 10)), 1, 99);
      return this.say('FUMBLE ON THE RETURN!', () => this.next(() => this.oppDrive(oy)), 1.6);
    }
    if (r.kind === 'touchback') return this.say('TOUCHBACK', () => this.startDrive(25), 1.0);
    const y = clamp(Math.round(r.x - 10), 1, 99);
    this.say(`RETURNED TO ${yardText(y)}`, () => this.next(() => this.startDrive(y)), 1.2);
  }
  startDrive(yard) {
    this.ballYard = yard; this.ballY = 26.67; this.down = 1; this.toGo = Math.min(10, 100 - yard); this.fd = yard + this.toGo; this.runoff = 0;
    this.toPresnap();
  }
  toPresnap() {
    if (this.clock <= 0 && !this.conv) return this.endQuarter(() => this.toPresnap());
    if (this.down === 4 && !this.conv && !this.goForIt) {
      const fgDist = Math.round(100 - this.ballYard + 17);
      return this.choice('4TH & ' + this.toGoText(), [
        { label: 'GO FOR IT', fn: () => { this.goForIt = true; this.toPresnap(); } },
        { label: 'PUNT', fn: () => this.punt(), disabled: this.ballYard > 92 },
        { label: `FIELD GOAL ${fgDist}Y`, fn: () => this.startKick('fg', fgDist), disabled: fgDist > 70 },
      ]);
    }
    const late = (this.q >= 4 || this.q === 2) && this.clock < 30 && this.score.u <= this.score.o;
    const pl = choosePlay(this.rng, { down: this.down, toGo: this.toGo, yard: this.ballYard, late });
    this.play = new PlaySim({ play: pl, lineup: this.lineup, defRating: this.oppDef, losX: 10 + this.ballYard, ballY: this.ballY,
      diff: this.dp, rng: this.rng, ocStars: this.c.coords.oc?.stars || 0, weather: this.weather });
    this.phase = 'presnap';
  }
  toGoText() { return this.ballYard + this.toGo >= 100 ? 'GOAL' : String(Math.max(1, Math.round(this.toGo))); }
  snap() {
    if (this.phase !== 'presnap') return;
    this.runoff = 0; this.goForIt = false;
    this.play.snap(); this.phase = 'live'; this.team.plays++;
  }
  timeout() {
    if (this.phase !== 'presnap' || this.to.u <= 0 || this.runoff <= 0) return false;
    this.to.u--; this.runoff = 0; this.log('TIMEOUT'); this.sfx.push('whistle'); return true;
  }
  // ---------- our plays ----------
  recordPlay(r) {
    const y = Math.round(r.yards);
    if (r.thrown) {
      this.inc(r.passer, 'patt');
      if (r.receiver) {
        this.inc(r.passer, 'pcmp'); this.inc(r.passer, 'pyds', y); this.inc(r.receiver, 'rec'); this.inc(r.receiver, 'recyds', y);
        this.team.pyds += y;
        if (r.kind === 'td') { this.inc(r.passer, 'ptd'); this.inc(r.receiver, 'rectd'); }
      }
      if (r.kind === 'int') this.inc(r.passer, 'pint');
    } else if (r.carrier && !r.sack) {
      this.inc(r.carrier, 'ratt'); this.inc(r.carrier, 'ryds', y); this.team.ryds += y;
      if (r.kind === 'td') this.inc(r.carrier, 'rtd');
    }
  }
  afterPlay(r) {
    if (this.play.mode === 'return') return this.afterReturn(r);
    this.play.done = false; // consumed
    const wasConv = this.conv;
    if (!wasConv) this.recordPlay(r);
    const endYard = r.x - 10;
    if (wasConv) {
      this.conv = false;
      if (r.kind === 'td') { this.score.u += 2; this.sfx.push('td'); return this.say('2-POINT CONVERSION GOOD!', () => this.afterScore('u')); }
      return this.say('2-POINT TRY FAILS', () => this.afterScore('u'));
    }
    if (r.kind === 'td') {
      this.score.u += 6;
      return this.say('TOUCHDOWN!', () => this.afterTD('u'), 2);
    }
    if (r.kind === 'safety') {
      this.score.o += 2;
      return this.say('SAFETY! +2 ' + this.opp.abbr, () => { if (this.possEnded('u')) return; this.next(() => this.oppDrive(this.rng.int(35, 45))); }, 2);
    }
    if (r.kind === 'int' || r.kind === 'fumble') {
      let oy = endYard >= 100 ? 20 : clamp(100 - endYard + (r.ret || 0), 1, 99);
      return this.say(r.msg, () => { if (this.possEnded('u')) return; this.next(() => this.oppDrive(Math.round(oy))); }, 1.6);
    }
    // regular down
    const newYard = r.kind === 'incomplete' ? this.ballYard : clamp(endYard, 0.5, 99.5);
    if (r.kind !== 'incomplete') this.ballY = clamp(r.y, HASH_L, HASH_R);
    let msg = r.msg;
    if (r.kind !== 'incomplete') {
      const g = Math.round(r.yards);
      msg = r.sack ? `SACKED FOR ${-g}` : g > 0 ? `GAIN OF ${g}` : g === 0 ? 'NO GAIN' : `LOSS OF ${-g}`;
      if (r.kind === 'oob') msg += ' (OUT)';
      if (r.fumble) msg = 'FUMBLE! RECOVERED. ' + msg;
    }
    this.ballYard = newYard;
    if (newYard >= this.fd) {
      this.down = 1; this.toGo = Math.min(10, 100 - newYard); this.fd = newYard + this.toGo; msg += ' - FIRST DOWN!';
    } else {
      this.down++; this.toGo = this.fd - newYard;
      if (this.down > 4) {
        return this.say(msg + ' - TURNOVER ON DOWNS', () => { if (this.possEnded('u')) return; this.next(() => this.oppDrive(Math.round(clamp(100 - newYard, 1, 99)))); }, 1.6);
      }
    }
    this.runoff = r.stop || r.kind === 'incomplete' ? 0 : RUNOFF;
    this.say(msg, () => this.next(() => this.toPresnap()), 1.0);
  }
  afterTD(side) {
    if (this.q >= 5) { this.possEnded(side, true); return; }
    if (side === 'u') {
      this.choice('TOUCHDOWN! CONVERSION', [
        { label: 'KICK PAT (1)', fn: () => this.startKick('pat', 33) },
        { label: 'GO FOR 2', fn: () => { this.conv = true; this.ballYard = 98; this.ballY = 26.67; this.down = 1; this.toGo = 2; this.fd = 100; this.toPresnap(); } },
      ]);
    }
  }
  afterScore(side) {
    if (this.possEnded(side)) return;
    if (side === 'u') {
      const trailing = this.score.u < this.score.o;
      if (this.q >= 4 && trailing) {
        return this.choice('KICKOFF', [
          { label: 'KICK DEEP', fn: () => this.next(() => this.kickoff('o')) },
          { label: 'ONSIDE KICK', fn: () => this.onside() },
        ]);
      }
      return this.next(() => this.kickoff('o'));
    }
    this.next(() => this.kickoff('u'));
  }
  onside() {
    this.sfx.push('kick');
    if (this.rng.chance(0.2)) this.say('ONSIDE KICK RECOVERED!', () => this.next(() => this.startDrive(45)), 1.8);
    else this.say('ONSIDE KICK - THEY RECOVER', () => this.next(() => this.oppDrive(55)), 1.8);
  }
  punt() {
    const leg = eff(this.K, 'LEG');
    const d = Math.round(35 + leg * 2 + this.rng.range(-6, 8));
    const land = this.ballYard + d;
    let oy, txt;
    if (land >= 100) { oy = 20; txt = `PUNT ${d} YDS - TOUCHBACK`; }
    else { const ret = this.rng.int(0, 12); oy = clamp(Math.round(100 - land + ret), 1, 99); txt = `PUNT ${d} YDS, RETURNED ${ret}`; }
    this.sfx.push('kick');
    if (this.clock > 0) this.clock = Math.max(0, this.clock - 4);
    this.say(txt, () => { if (this.possEnded('u')) return; this.next(() => this.oppDrive(oy)); }, 1.6);
  }
  startKick(kind, dist) {
    this.kick = new KickGame({ dist, kicker: this.K, wind: this.wind, kind });
    this.phase = 'kick';
  }
  afterKick() {
    const k = this.kick; this.kick = null;
    if (k.kind === 'pat') {
      this.inc(this.K, 'xpa'); if (k.good) { this.inc(this.K, 'xpm'); this.score.u += 1; }
      return this.say(k.good ? 'EXTRA POINT GOOD' : 'PAT ' + k.why, () => this.afterScore('u'), 1.2);
    }
    this.inc(this.K, 'fga');
    if (this.clock > 0) this.clock = Math.max(0, this.clock - 4);
    if (k.good) {
      this.inc(this.K, 'fgm'); this.score.u += 3;
      return this.say(`${k.dist} YD FIELD GOAL IS GOOD!`, () => this.afterScore('u'), 1.6);
    }
    const oy = Math.round(clamp(100 - (this.ballYard - 7), 20, 99));
    this.say(`FIELD GOAL ${k.why}`, () => { if (this.possEnded('u')) return; this.next(() => this.oppDrive(oy)); }, 1.6);
  }
  // ---------- quarters & OT ----------
  endQuarter(cont) {
    this.sfx.push('whistle');
    this.play = null;
    if (this.q === 1 || this.q === 3) { this.q++; this.clock = this.qlen; return this.say(`END OF QUARTER ${this.q - 1}`, cont, 1.6); }
    if (this.q === 2) {
      this.q = 3; this.clock = this.qlen; this.to = { u: 3, o: 3 };
      return this.say(`HALFTIME  ${this.me.abbr} ${this.score.u} - ${this.opp.abbr} ${this.score.o}`, () => this.kickoff(this.firstRecv === 'u' ? 'o' : 'u'), 2.4);
    }
    if (this.score.u !== this.score.o) return this.finish();
    if (this.q === 4) {
      this.q = 5; this.clock = this.qlen; this.to = { u: 2, o: 2 }; this.ot = { poss: { u: 0, o: 0 } };
      return this.say('END OF REGULATION - OVERTIME!', () => this.coin(), 2);
    }
    if (!this.playoff) return this.finish();
    this.q++; this.clock = this.qlen;
    return this.say('END OF OT PERIOD', cont, 1.6);
  }
  // returns true if the game ended
  possEnded(side, td = false) {
    if (!this.ot) return false;
    this.ot.poss[side]++;
    const n = this.ot.poss.u + this.ot.poss.o;
    if (td) { this.finish(); return true; }
    if (this.ot.poss.u >= 1 && this.ot.poss.o >= 1 && this.score.u !== this.score.o) { this.finish(); return true; }
    // a safety by the first possession team's opponent also ends it
    if (n === 1 && this.score.u !== this.score.o && ((side === 'u' && this.score.o > this.score.u) || (side === 'o' && this.score.u > this.score.o))) { this.finish(); return true; }
    return false;
  }
  finish() {
    this.phase = 'final'; this.over = true; this.sfx.push('whistle');
    this.sfx.push(this.score.u > this.score.o ? 'good' : this.score.u < this.score.o ? 'bad' : 'whistle');
    this.msg = 'FINAL';
  }
  // ---------- simulated opponent drive ----------
  oppDrive(start) {
    if (this.over) return;
    this.play = null;
    const rng = this.rng;
    let out = driveOutcome(rng, this.oppOff, this.userDef, start, this.dp.sim);
    let time = out.plays * rng.int(6, 9);
    const endHalf = this.q === 2 || this.q >= 4;
    let clockOut = false;
    if (time >= this.clock) {
      if (endHalf && (out.res === 'TD' || out.res === 'FG') && !rng.chance(this.clock / time + 0.15)) { out = { ...out, res: 'CLOCK' }; }
      else if (endHalf && out.res !== 'TD' && out.res !== 'FG') out = { ...out, res: 'CLOCK' };
      time = this.clock; clockOut = true;
    }
    if (out.res === 'FG' && !rng.chance(0.86)) out.res = 'FGMISS';
    // build a play-by-play ticker
    const lines = [];
    const defStars = this.c.roster.filter((p) => ['DL', 'LB', 'DB'].includes(p.pos) && !p.injury);
    const tackler = () => defStars.length && rng.chance(0.55) ? rng.pick(defStars) : null;
    const total = out.endYard - start;
    let yd = start, plays = out.res === 'CLOCK' ? Math.max(2, Math.round(out.plays * 0.7)) : out.plays;
    const pos = [start];
    for (let i = 0; i < plays; i++) {
      const left = out.endYard - yd, rem = plays - i;
      let g = i === plays - 1 ? left : Math.round(left / rem + rng.range(-4, 6));
      if (out.res === 'TD' && i === plays - 1) g = 100 - yd;
      let t;
      const tk = tackler();
      if (g <= 0 && rng.chance(0.4) && defStars.some((p) => p.pos === 'DL' || p.pos === 'LB')) {
        const s = rng.pick(defStars.filter((p) => p.pos === 'DL' || p.pos === 'LB'));
        this.inc(s, 'sck'); this.inc(s, 'tkl'); g = -rng.int(3, 8); t = `SACKED BY ${displayName(s)}!`;
      } else if (g === 0 && rng.chance(0.6)) t = 'INCOMPLETE PASS';
      else {
        t = (rng.chance(0.5) ? 'RUN' : 'PASS') + (g >= 0 ? ` FOR ${g}` : ` LOSS OF ${-g}`);
        if (tk) { this.inc(tk, 'tkl'); t += ` (${tk.last})`; }
      }
      if (out.res === 'TD' && i === plays - 1) t = (rng.chance(0.6) ? 'TD PASS' : 'TD RUN') + ` FROM ${g}`;
      yd = clamp(yd + g, 1, 100); pos.push(yd);
      lines.push(t);
    }
    this.team.oppYds += total;
    const final = { TD: 'TOUCHDOWN ' + this.opp.abbr, FG: `${this.opp.abbr} FIELD GOAL GOOD (${Math.round(117 - out.endYard)} YD)`, FGMISS: `FIELD GOAL MISSED (${Math.round(117 - out.endYard)} YD)`,
      PUNT: `${this.opp.abbr} PUNTS`, DOWNS: 'STOPPED ON 4TH DOWN!', CLOCK: 'TIME EXPIRES ON THE DRIVE', TO: '' }[out.res];
    if (out.res === 'TO') {
      const db = defStars.length && rng.chance(0.7) ? rng.pick(defStars) : null;
      if (rng.chance(0.6)) { if (db) this.inc(db, 'dint'); lines.push(`INTERCEPTED${db ? ' BY ' + displayName(db) : ''}!`); }
      else lines.push(`FUMBLE! RECOVERED${db ? ' BY ' + displayName(db) : ''}!`);
    } else lines.push(final);
    this.oppState = { out, lines, pos, shown: 0, t: 0, start, time, clockStart: this.clock };
    this.oppFast = false;
    this.phase = 'opp';
    this.log(`${this.opp.abbr} BALL ON THEIR ${start}`);
  }
  oppUpdate(dt) {
    const s = this.oppState;
    s.t += dt * (this.oppFast ? 8 : 1);
    const per = 0.55;
    s.shown = Math.min(s.lines.length, Math.floor(s.t / per) + 1);
    const frac = Math.min(1, s.t / (per * s.lines.length));
    this.clock = Math.max(0, s.clockStart - s.time * frac);
    if (s.t >= per * s.lines.length + 0.9) this.oppResolve();
  }
  oppMarker() {
    const s = this.oppState; if (!s) return 50;
    const i = Math.min(s.pos.length - 1, s.shown); return s.pos[i];
  }
  oppResolve() {
    const s = this.oppState, out = s.out, rng = this.rng;
    this.clock = Math.max(0, s.clockStart - s.time);
    this.phase = 'msg';
    if (out.res === 'TD') {
      this.score.o += 6; this.sfx.push('groan');
      if (this.ot) { this.possEnded('o', true); return; }
      const diff = this.score.o - this.score.u;
      let txt;
      if (this.q >= 4 && (diff === -2 || diff === 1 || diff === -5)) { const ok = rng.chance(0.47); if (ok) this.score.o += 2; txt = ok ? '2-PT GOOD' : '2-PT FAILS'; }
      else { const ok = rng.chance(0.95); if (ok) this.score.o += 1; txt = ok ? 'PAT GOOD' : 'PAT MISSED'; }
      return this.say(`${this.opp.abbr} TOUCHDOWN - ${txt}`, () => this.afterScore('o'), 1.6);
    }
    if (out.res === 'FG') { this.score.o += 3; return this.say(`${this.opp.abbr} FIELD GOAL`, () => this.afterScore('o'), 1.4); }
    let y;
    if (out.res === 'PUNT') {
      const land = out.endYard + rng.int(35, 50);
      y = land >= 100 ? 20 : clamp(Math.round(100 - land + rng.int(0, 10)), 5, 80);
      this.sfx.push('kick');
    } else if (out.res === 'FGMISS') y = Math.round(clamp(100 - (out.endYard - 7), 20, 99));
    else if (out.res === 'CLOCK') y = 25;
    else y = Math.round(clamp(100 - out.endYard + (out.res === 'TO' ? rng.int(0, 15) : 0), 1, 99));
    if (out.res === 'TO' || out.res === 'DOWNS') this.sfx.push('crowd');
    if (this.possEnded('o')) return;
    this.say(s.lines[s.lines.length - 1] + (out.res === 'CLOCK' ? '' : ` - YOUR BALL AT ${yardText(y)}`), () => this.next(() => this.startDrive(y)), 1.4);
  }
  // ---------- sim the rest ----------
  simRest() {
    const rng = this.rng;
    let remain = (Math.max(0, 4 - this.q) * this.qlen + this.clock);
    if (this.q >= 5) remain = 0;
    const drives = Math.max(0, Math.round(remain / 75));
    const pts = (r) => r === 'TD' ? 7 : r === 'FG' ? 3 : 0;
    const uo = this.lineupOff();
    for (let i = 0; i < drives; i++) {
      this.score.u += pts(driveOutcome(rng, uo, this.oppDef, 25, -this.dp.sim).res);
      this.score.o += pts(driveOutcome(rng, this.oppOff, this.userDef, 25, this.dp.sim).res);
    }
    if (this.score.u === this.score.o && (this.playoff || rng.chance(0.7))) rng.chance(0.5) ? this.score.u += 3 : this.score.o += 3;
    this.finish();
  }
  lineupOff() {
    let s = 0, n = 0;
    for (const pos of ['QB', 'RB', 'WR', 'TE', 'OL']) for (const p of this.lineup[pos]) { s += p.stars * (pos === 'QB' ? 3 : 1); n += pos === 'QB' ? 3 : 1; }
    return s / n + (this.c.coords.oc?.stars || 0) * 0.12;
  }
  result() {
    return { us: this.score.u, them: this.score.o, ot: this.q >= 5, stats: this.stats, oppId: this.opp.id };
  }
}
export function yardText(y) { y = Math.round(y); return y === 50 ? 'THE 50' : y < 50 ? `OWN ${y}` : `OPP ${100 - y}`; }
