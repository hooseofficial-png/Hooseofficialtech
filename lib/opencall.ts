/** Loose position match between an Open Call position and what a person wrote ("Camera Assistance" ~ "Camera Assistant"). */
export function positionMatch(want: string, have: string) {
  const n = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9ก-๙ ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const a = n(want), b = n(have);
  if (!a || !b) return false;
  if (a.includes(b) || b.includes(a)) return true;
  const stem = (w: string) => w.slice(0, Math.max(4, w.length - 2));
  const wa = a.split(' ').filter(w => w.length >= 3).map(stem), wb = b.split(' ').filter(w => w.length >= 3).map(stem);
  return wa.length > 0 && wa.every(x => wb.some(y => x === y || x.startsWith(y) || y.startsWith(x)));
}
