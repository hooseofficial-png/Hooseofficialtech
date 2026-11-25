'use client';
// Tiny stale-while-revalidate cache: memory first, sessionStorage so a refresh or back-navigation paints instantly.
const mem = new Map<string, unknown>();
const KEY = (k: string) => 'hoose:' + k;

export function getCache<T>(k: string): T | undefined {
  if (mem.has(k)) return mem.get(k) as T;
  try { const s = sessionStorage.getItem(KEY(k)); if (s) { const v = JSON.parse(s) as T; mem.set(k, v); return v; } } catch { /* private mode */ }
  return undefined;
}
export function setCache(k: string, v: unknown) {
  mem.set(k, v);
  try { sessionStorage.setItem(KEY(k), JSON.stringify(v)); } catch { /* quota */ }
}
export function clearCache() {
  mem.clear();
  try { Object.keys(sessionStorage).filter(k => k.startsWith('hoose:')).forEach(k => sessionStorage.removeItem(k)); } catch { /* ignore */ }
}
