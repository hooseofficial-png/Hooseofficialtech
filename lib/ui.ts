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
