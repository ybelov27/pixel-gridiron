// Achievements: unlocked once per career, each pays a coaching-credit reward.
// Game feats come from Match (see Match.feats); career ones are checked after every game and menu action.
import { userTeam } from './league.js';

// [id, name, description, CC reward]
export const ACHIEVEMENTS = [
  ['first_win', 'FIRST VICTORY', 'WIN A GAME', 3],
  ['first_td', 'SIX POINTS', 'SCORE A TOUCHDOWN', 2],
  ['long_bomb', 'AIR RAID', 'COMPLETE A 50+ YARD PASS', 4],
  ['house_call', 'HOUSE CALL', 'SCORE A 50+ YARD RUSHING TOUCHDOWN', 4],
  ['kr_td', 'RETURN TO SENDER', 'RETURN A KICKOFF FOR A TOUCHDOWN', 6],
  ['fg50', 'BIG BOOT', 'MAKE A 50+ YARD FIELD GOAL', 4],
  ['two_pt', 'GOING FOR TWO', 'CONVERT A 2-POINT TRY', 2],
  ['juke3', 'ANKLE BREAKER', 'MAKE 3 DEFENDERS MISS ON ONE PLAY', 4],
  ['stretch', 'EVERY INCH', 'STRETCH ACROSS THE GOAL LINE AS YOU GO DOWN', 3],
  ['hail', 'HAIL MARY', '40+ YD TD PASS WITH 10 SECONDS OR LESS IN A HALF', 8],
  ['shutout', 'SHUTOUT', 'WIN WITHOUT ALLOWING A POINT', 5],
  ['blowout', 'STATEMENT GAME', 'WIN BY 28 OR MORE', 4],
  ['comeback', 'COMEBACK KIDS', 'WIN AFTER TRAILING BY 14 OR MORE', 6],
  ['ot_win', 'SUDDEN DEATH', 'WIN IN OVERTIME', 4],
  ['air300', 'GUNSLINGER', 'PASS FOR 300+ YARDS IN A GAME', 5],
  ['td4', 'FOUR-PLAY', 'THROW 4 TOUCHDOWN PASSES IN A GAME', 5],
  ['rush200', 'GROUND AND POUND', 'RUSH FOR 200+ YARDS IN A GAME', 5],
  ['hard_win', 'TOUGH COOKIE', 'WIN A GAME ON HARD OR EXTREME', 4],
  ['streak5', 'ON FIRE', 'WIN 5 GAMES IN A ROW', 5],
  ['playoffs', 'POSTSEASON', 'MAKE THE PLAYOFFS', 5],
  ['division', 'DIVISION CHAMPS', 'WIN YOUR DIVISION', 6],
  ['perfect', 'PERFECT SEASON', 'GO UNDEFEATED IN THE REGULAR SEASON', 15],
  ['champ', 'CHAMPIONS', 'WIN THE PIXEL BOWL', 15],
  ['dynasty', 'DYNASTY', 'WIN 3 PIXEL BOWLS', 25],
  ['wins25', 'WINNING CULTURE', 'REACH 25 CAREER WINS', 5],
  ['wins100', 'LEGEND', 'REACH 100 CAREER WINS', 15],
  ['five_star', 'FRANCHISE PLAYER', 'HAVE A 5-STAR PLAYER', 6],
  ['full_house', 'FULL HOUSE', 'HAVE 12 STARS ON YOUR ROSTER', 4],
  ['facility', 'STATE OF THE ART', 'UPGRADE A FACILITY TO 5 STARS', 5],
  ['coord5', 'STAFFED UP', 'HIRE A 5-STAR COORDINATOR', 4],
  ['dj', 'DJ', 'BUY A TOUCHDOWN SONG', 2],
  ['fantasy', 'FANTASY GM', 'COMPLETE A FANTASY DRAFT', 2],
  ['rehired', 'SECOND CHANCE', 'GET HIRED AFTER BEING FIRED', 3],
  ['long_td80', 'TO THE HOUSE', 'SCORE AN 80+ YARD TOUCHDOWN', 6],
  ['td8', 'TOUCHDOWN PARTY', 'SCORE 8 TOUCHDOWNS IN A GAME', 8],
  ['pts50', 'HALF CENTURY', 'SCORE 50+ POINTS IN A GAME', 6],
  ['yds600', 'YARDS FOR DAYS', 'GAIN 600+ TOTAL YARDS IN A GAME', 8],
  ['rec200', 'NUMBER ONE TARGET', 'ONE RECEIVER GAINS 200+ YARDS IN A GAME', 5],
  ['rb175', 'WORKHORSE', 'ONE RUNNER GAINS 175+ YARDS IN A GAME', 5],
  ['fg55', 'MOONSHOT', 'MAKE A 55+ YARD FIELD GOAL', 8],
  ['onside', 'SURPRISE!', 'RECOVER AN ONSIDE KICK', 5],
  ['walkoff', 'WALK-OFF', 'WIN ON A GO-AHEAD FIELD GOAL IN THE LAST 10 SECONDS OR OT', 8],
  ['no_int', 'CLEAN HANDS', 'WIN WITH 350+ PASS YARDS AND NO INTERCEPTIONS', 5],
  ['no_punt', 'NO PUNT INTENDED', 'SCORE 35+ AND WIN WITHOUT PUNTING', 4],
  ['snow_win', 'WINTER WARRIOR', 'WIN A GAME IN THE SNOW', 4],
  ['night_win', 'PRIME TIME', 'WIN A NIGHT GAME', 2],
  ['extreme_win', 'NIGHTMARE MODE', 'WIN A GAME ON EXTREME', 6],
  ['win12', 'TWELVE AND COUNTING', 'WIN 12 REGULAR-SEASON GAMES IN ONE SEASON', 8],
  ['wins50', 'BUILT TO LAST', 'REACH 50 CAREER WINS', 8],
  ['repeat', 'BACK TO BACK', 'WIN THE PIXEL BOWL TWO SEASONS IN A ROW', 15],
  ['seasons5', 'LIFER', 'COACH 5 FULL SEASONS', 6],
  ['bank100', 'MONEY BAGS', 'HOLD 100 CC AT ONCE', 4],
  ['all_fac', 'PALACE', 'GET ALL THREE FACILITIES TO 5 STARS', 10],
  ['collector', 'COLLECTOR', 'UNLOCK 25 ACHIEVEMENTS', 10],
  ['hof', 'HALL OF FAME', 'UNLOCK EVERY OTHER ACHIEVEMENT', 30],
];
export const achById = (id) => ACHIEVEMENTS.find((a) => a[0] === id);

export function unlock(c, id) {
  c.ach ||= {};
  if (c.ach[id]) return false;
  const a = achById(id); if (!a) return false;
  c.ach[id] = { y: c.year, w: c.week };
  c.cc += a[3];
  (c.newAch ||= []).push(id);   // shown as a banner by the UI, then cleared
  return true;
}
export function achCount(c) { return Object.keys(c.ach || {}).length; }

// big-play feats unlocked live, the moment they happen during a game
export function checkLive(c, f) {
  if ((f.tds || 0) > 0) unlock(c, 'first_td');
  if ((f.longPass || 0) >= 50) unlock(c, 'long_bomb');
  if ((f.longRunTD || 0) >= 50) unlock(c, 'house_call');
  if (f.krTD) unlock(c, 'kr_td');
  if (f.fg50) unlock(c, 'fg50');
  if (f.twoPt) unlock(c, 'two_pt');
  if ((f.maxMisses || 0) >= 3) unlock(c, 'juke3');
  if (f.stretched) unlock(c, 'stretch');
  if (f.hailMary) unlock(c, 'hail');
  if ((f.passYds || 0) >= 300) unlock(c, 'air300');
  if ((f.passTD || 0) >= 4) unlock(c, 'td4');
  if ((f.rushYds || 0) >= 200) unlock(c, 'rush200');
  feats(c, f);
}
// single-game feats shared by the live check and the post-game check
function feats(c, f) {
  if ((f.longTD || 0) >= 80) unlock(c, 'long_td80');
  if ((f.tds || 0) >= 8) unlock(c, 'td8');
  if ((f.points || 0) >= 50) unlock(c, 'pts50');
  if ((f.passYds || 0) + (f.rushYds || 0) >= 600) unlock(c, 'yds600');
  if ((f.recBest || 0) >= 200) unlock(c, 'rec200');
  if ((f.rushBest || 0) >= 175) unlock(c, 'rb175');
  if ((f.fgLong || 0) >= 55) unlock(c, 'fg55');
  if (f.onside) unlock(c, 'onside');
}
// after a played (or simmed) game. res.feats exists only for games you actually played
export function checkGame(c, res) {
  const won = res.us > res.them, f = res.feats || {};
  if (won) unlock(c, 'first_win');
  if (won && res.them === 0) unlock(c, 'shutout');
  if (won && res.us - res.them >= 28) unlock(c, 'blowout');
  if (won && res.ot) unlock(c, 'ot_win');
  if (won && (c.settings.difficulty === 'HARD' || c.settings.difficulty === 'EXTREME')) unlock(c, 'hard_win');
  if (res.us >= 6 && (f.tds || 0) > 0) unlock(c, 'first_td');
  if (won && (f.maxDeficit || 0) >= 14) unlock(c, 'comeback');
  if ((f.longPass || 0) >= 50) unlock(c, 'long_bomb');
  if ((f.longRunTD || 0) >= 50) unlock(c, 'house_call');
  if (f.krTD) unlock(c, 'kr_td');
  if (f.fg50) unlock(c, 'fg50');
  if (f.twoPt) unlock(c, 'two_pt');
  if ((f.maxMisses || 0) >= 3) unlock(c, 'juke3');
  if (f.stretched) unlock(c, 'stretch');
  if (f.hailMary) unlock(c, 'hail');
  if ((f.passYds || 0) >= 300) unlock(c, 'air300');
  if ((f.passTD || 0) >= 4) unlock(c, 'td4');
  if ((f.rushYds || 0) >= 200) unlock(c, 'rush200');
  feats(c, { ...f, points: res.us });
  if (won && f.walkoffFG) unlock(c, 'walkoff');
  if (won && res.feats && !f.ints && (f.passYds || 0) >= 350) unlock(c, 'no_int');
  if (won && res.feats && !f.punts && res.us >= 35) unlock(c, 'no_punt');
  if (won && f.snow) unlock(c, 'snow_win');
  if (won && f.night) unlock(c, 'night_win');
  if (won && c.settings.difficulty === 'EXTREME') unlock(c, 'extreme_win');
  checkCareer(c);
}
export function checkCareer(c) {
  if (!c || !c.teams) return;
  const t = userTeam(c);
  if ((c.streak || 0) >= 5) unlock(c, 'streak5');
  const P = c.playoffs;
  if (P && P.seeds) {
    const seed = P.seeds.reduce((s, arr) => s >= 0 ? s : arr.indexOf(c.userTeamId), -1);
    if (seed >= 0) unlock(c, 'playoffs');
    if (seed >= 0 && seed < 4) unlock(c, 'division');
    if (c.phase === 'playoffs' && t.l === 0 && t.w + t.t >= 16) unlock(c, 'perfect');
  }
  if (c.coach.titles >= 1) unlock(c, 'champ');
  if (c.coach.titles >= 3) unlock(c, 'dynasty');
  if (c.coach.wins >= 25) unlock(c, 'wins25');
  if (c.coach.wins >= 100) unlock(c, 'wins100');
  if (c.roster.some((p) => p.stars >= 5)) unlock(c, 'five_star');
  if (c.roster.length >= 12) unlock(c, 'full_house');
  if (Object.values(c.facilities).some((v) => v >= 5)) unlock(c, 'facility');
  if ((c.coords.oc && c.coords.oc.stars >= 5) || (c.coords.dc && c.coords.dc.stars >= 5)) unlock(c, 'coord5');
  if (c.music && c.music.owned.length > 1) unlock(c, 'dj');
  if (c.fantasyDone) unlock(c, 'fantasy');
  if (c.coach.teams.length > 1) unlock(c, 'rehired');
  if (c.phase === 'regular' || c.phase === 'playoffs') { if (t.w >= 12) unlock(c, 'win12'); }
  if (c.coach.wins >= 50) unlock(c, 'wins50');
  const ty = c.titleYears || [];
  if (ty.some((y) => ty.includes(y - 1))) unlock(c, 'repeat');
  if ((c.history || []).length >= 5) unlock(c, 'seasons5');
  if (c.cc >= 100) unlock(c, 'bank100');
  if (Object.values(c.facilities).every((v) => v >= 5)) unlock(c, 'all_fac');
  // meta trophies last, so they see everything unlocked above
  if (achCount(c) >= 25) unlock(c, 'collector');
  if (ACHIEVEMENTS.every((a) => a[0] === 'hof' || (c.ach || {})[a[0]])) unlock(c, 'hof');
}
