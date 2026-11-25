'use client';
import { toast } from '@/lib/ui';

/** Tell the server to mirror one appointment into Google Calendar (and e-mail the team) and show the outcome. */
export async function pushToGoogle(eventId: string, method: 'POST' | 'DELETE' = 'POST') {
  try {
    const r = await fetch('/api/google/event', { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ eventId }) });
    const j = await r.json().catch(() => ({}));
    if (j.status === 'added') toast(`ADD เข้า Google Calendar เสร็จสิ้น · ส่งคำเชิญทางอีเมลถึงทีม ${j.invited} คน`);
    else if (j.status === 'updated') toast(`อัปเดต Google Calendar เสร็จสิ้น · แจ้งทีม ${j.invited} คนทางอีเมล`);
    else if (j.status === 'removed') toast('ลบนัดออกจาก Google Calendar ของทีมแล้ว');
    else if (j.status === 'not_connected') toast('บันทึกใน HOOSE แล้ว · ยังไม่ได้เชื่อม Google Calendar จึงยังไม่ส่งถึงทีม (กด “Sync กับ Google Calendar”)');
    else if (j.status === 'error') toast('ส่งเข้า Google Calendar ไม่สำเร็จ' + (j.message ? ': ' + j.message : ''));
    return j;
  } catch { return null; }
}
