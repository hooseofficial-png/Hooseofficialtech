'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * App-wide micro-interactions, added once in the root layout:
 * - top progress bar while moving between pages
 * - ripple on every .btn press
 * - spotlight that follows the pointer over cards
 * All of it switches off under prefers-reduced-motion.
 */
export default function MotionLayer() {
  const path = usePathname();
  const [nav, setNav] = useState<'idle' | 'go' | 'done'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout>>();

  // Finish the bar when the route has changed.
  useEffect(() => {
    if (nav === 'go') { setNav('done'); clearTimeout(timer.current); timer.current = setTimeout(() => setNav('idle'), 450); }
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = () => { clearTimeout(timer.current); setNav('go'); timer.current = setTimeout(() => setNav('idle'), 8000); };

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const a = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const u = new URL(a.href, location.href);
      if (u.origin === location.origin && u.pathname !== location.pathname) start();
    };
    const onNav = () => start();

    const onDown = (e: PointerEvent) => {
      if (reduce) return;
      const b = (e.target as HTMLElement).closest('.btn, .pos-card, .tab') as HTMLElement | null;
      if (!b || (b as HTMLButtonElement).disabled) return;
      const r = b.getBoundingClientRect(); const s = Math.max(r.width, r.height) * 2;
      const dot = document.createElement('span');
      dot.className = 'ripple';
      dot.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
      b.appendChild(dot); setTimeout(() => dot.remove(), 650);
    };

    let raf = 0; let last: HTMLElement | null = null;
    const onMove = (e: PointerEvent) => {
      if (reduce || e.pointerType !== 'mouse') return;
      const c = (e.target as HTMLElement).closest('.card, .pcard, .pos-card') as HTMLElement | null;
      if (last && last !== c) last.classList.remove('lit');
      last = c; if (!c) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = c.getBoundingClientRect();
        c.style.setProperty('--mx', e.clientX - r.left + 'px'); c.style.setProperty('--my', e.clientY - r.top + 'px');
        c.classList.add('lit');
      });
    };

    document.addEventListener('click', onClick, true);
    window.addEventListener('hoose:nav', onNav);
    document.addEventListener('pointerdown', onDown, { passive: true });
    document.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      document.removeEventListener('click', onClick, true); window.removeEventListener('hoose:nav', onNav);
      document.removeEventListener('pointerdown', onDown); document.removeEventListener('pointermove', onMove);
    };
  }, []);

  return <div className={'navbar ' + nav} aria-hidden="true"><i /></div>;
}
