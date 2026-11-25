'use client';
import { useEffect, useRef, useState } from 'react';

/** Number that counts up/down to `value` (easeOutCubic). Non-numbers render as-is. */
export default function CountUp({ value, duration = 900, format }: { value: number | string; duration?: number; format?: (n: number) => string }) {
  const target = typeof value === 'number' ? value : Number.NaN;
  const [shown, setShown] = useState(Number.isFinite(target) ? 0 : 0);
  const from = useRef(0);
  useEffect(() => {
    if (!Number.isFinite(target)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(target); from.current = target; return; }
    const a = from.current; const t0 = performance.now(); let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / duration); const e = 1 - Math.pow(1 - k, 3);
      const v = a + (target - a) * e; setShown(v);
      if (k < 1) raf = requestAnimationFrame(step); else from.current = target;
    };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  if (!Number.isFinite(target)) return <>{value}</>;
  const n = Math.round(shown);
  return <>{format ? format(n) : n.toLocaleString('th-TH')}</>;
}
