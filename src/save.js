// Career persistence: localStorage autosave + JSON export/import.
import { SAVE_VERSION, migrateCareer } from './league.js';
export const SAVE_KEY = 'pixelgridiron.career.v1';

export function serialize(c) { return JSON.stringify(c); }
export function deserialize(str) {
  const c = typeof str === 'string' ? JSON.parse(str) : str;
  if (!c || typeof c !== 'object' || !Array.isArray(c.teams) || c.teams.length !== 32 || !Array.isArray(c.roster) || !Array.isArray(c.schedule))
    throw new Error('NOT A PIXEL GRIDIRON SAVE');
  if ((c.version | 0) > SAVE_VERSION) throw new Error('SAVE FROM A NEWER VERSION');
  // forward-compatible defaults
  c.pending ||= []; c.news ||= []; c.history ||= []; c.freeAgents ||= []; c.expiring ||= [];
  c.coords ||= { oc: null, dc: null }; c.settings ||= { qlen: 2, difficulty: 'MEDIUM', dynamic: true, sound: true };
  c.dyn ??= 0;
  return migrateCareer(c);
}
function store() { try { return window.localStorage; } catch (_) { return null; } }
export function saveCareer(c) {
  const s = store(); if (!s || !c) return false;
  try { s.setItem(SAVE_KEY, serialize(c)); return true; } catch (_) { return false; }
}
export function loadCareer() {
  const s = store(); if (!s) return null;
  try { const v = s.getItem(SAVE_KEY); return v ? deserialize(v) : null; } catch (_) { return null; }
}
export function hasSave() { const s = store(); try { return !!(s && s.getItem(SAVE_KEY)); } catch (_) { return false; } }
export function deleteSave() { const s = store(); try { s && s.removeItem(SAVE_KEY); } catch (_) {} }
export function exportCareer(c) {
  const blob = new Blob([JSON.stringify(c, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `pixel-gridiron-y${c.year}-${c.teams[c.userTeamId].abbr.toLowerCase()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
export function importCareer() {
  return new Promise((resolve, reject) => {
    const inp = document.getElementById('file');
    inp.value = '';
    inp.onchange = () => {
      const f = inp.files && inp.files[0];
      if (!f) return reject(new Error('NO FILE'));
      const r = new FileReader();
      r.onload = () => { try { resolve(deserialize(String(r.result))); } catch (e) { reject(e); } };
      r.onerror = () => reject(new Error('READ FAILED'));
      r.readAsText(f);
    };
    inp.click();
  });
}
