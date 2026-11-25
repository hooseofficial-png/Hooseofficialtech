'use client';
// Tiny event-bus helpers so any component can show a toast or a confirm dialog.
export function toast(message: string) { window.dispatchEvent(new CustomEvent('hoose:toast', { detail: message })); }
export async function copyText(t: string, ok = 'คัดลอกแล้ว') {
  try { await navigator.clipboard.writeText(t); toast(ok); } catch { toast('คัดลอกไม่ได้ เลือกข้อความแล้วคัดลอกเอง'); }
}
export function errText(e: unknown) {
  const m = (e as { message?: string })?.message || String(e || '');
  if (/row-level security|permission denied/i.test(m)) return 'คุณไม่มีสิทธิ์ทำรายการนี้';
  if (/ล็อก/.test(m)) return m;
  return m || 'เกิดข้อผิดพลาด ลองอีกครั้ง';
}

/** Signal a programmatic navigation (router.push) so the top progress bar starts. */
export function navStart() { window.dispatchEvent(new Event('hoose:nav')); }

/** Small celebratory burst in brand colours (blue / black / grey) from a point or the screen centre. */
export function celebrate(x?: number, y?: number) {
  if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cx = x ?? window.innerWidth / 2; const cy = y ?? window.innerHeight / 3;
  const colors = ['#0D00FF', '#0E0E1A', '#5B52FF', '#B9B6FF', '#8B8E9C'];
  const box = document.createElement('div'); box.className = 'confetti'; document.body.appendChild(box);
  for (let i = 0; i < 46; i++) {
    const p = document.createElement('i');
    const ang = Math.random() * Math.PI * 2; const dist = 90 + Math.random() * 170;
    p.style.cssText = `left:${cx}px;top:${cy}px;background:${colors[i % colors.length]};--dx:${Math.cos(ang) * dist}px;--dy:${Math.sin(ang) * dist - 60}px;--r:${Math.random() * 720 - 360}deg;animation-delay:${Math.random() * 80}ms;${i % 3 === 0 ? 'border-radius:50%;width:7px;height:7px' : ''}`;
    box.appendChild(p);
  }
  setTimeout(() => box.remove(), 1400);
}
