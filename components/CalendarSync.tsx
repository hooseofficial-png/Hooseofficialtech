'use client';
import { useEffect, useState } from 'react';
import Modal from './Modal';
import { sb } from '@/lib/supabase/client';
import { copyText, toast, errText } from '@/lib/ui';

/** "Sync กับ Google Calendar": subscribes Google Calendar to this account's personal iCal feed. */
export default function CalendarSync({ variant = 'button' }: { variant?: 'button' | 'card' }) {
  const [token, setToken] = useState('');
  const [open, setOpen] = useState(false);
  useEffect(() => {
    sb().auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: p } = await sb().from('profiles').select('calendar_token').eq('id', data.user.id).maybeSingle();
      if (p?.calendar_token) setToken(p.calendar_token);
    });
  }, []);
  const site = process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
  const feed = token ? `${site}/api/calendar/${token}.ics` : '';
  const google = feed ? 'https://calendar.google.com/calendar/render?cid=' + encodeURIComponent(feed.replace(/^https?:/, 'webcal:')) : '';
  async function rotate() {
    const { data, error } = await sb().rpc('rotate_calendar_token');
    if (error) { toast(errText(error)); return; }
    setToken(data as string); toast('สร้างลิงก์ใหม่แล้ว · ลิงก์เดิมใช้ไม่ได้อีก ต้องกด Sync ใหม่');
  }
  const trigger = <button className={variant === 'card' ? 'btn p' : 'btn sm'} onClick={() => setOpen(true)} disabled={!token}>Sync กับ Google Calendar</button>;
  return (
    <>
      {variant === 'card' ? (
        <section className="card" style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div className="grow" style={{ minWidth: 220 }}><h2>Google Calendar</h2><span className="mut" style={{ fontSize: 13 }}>นัดบรีฟ ประชุม และวันถ่ายจากทุกโปรเจกต์ของคุณ ขึ้นใน Google Calendar อัตโนมัติ</span></div>
          {trigger}
        </section>
      ) : trigger}
      {open && <Modal title="Sync กับ Google Calendar" onClose={() => setOpen(false)}>
        <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14 }}>
          <li>กดปุ่มด้านล่าง ระบบจะเปิด Google Calendar</li>
          <li>เลือกบัญชี Google ที่ต้องการ แล้วกด <b>เพิ่ม (Add)</b></li>
          <li>ปฏิทิน “HOOSE” จะขึ้นในรายการ “ปฏิทินอื่น ๆ” และอัปเดตเองเมื่อมีนัดใหม่</li>
        </ol>
        <a className="btn p" href={google} target="_blank" rel="noopener noreferrer">เปิด Google Calendar แล้วกดเพิ่ม</a>
        <div className="cap" style={{ marginTop: 4 }}>ลิงก์ปฏิทินส่วนตัว (Apple Calendar / Outlook ใช้ลิงก์นี้ได้)</div>
        <div className="row"><input className="in-t" readOnly value={feed} aria-label="ลิงก์ปฏิทิน" /><button className="btn" onClick={() => copyText(feed, 'คัดลอกลิงก์แล้ว')}>คัดลอก</button></div>
        <p className="mut" style={{ fontSize: 12, margin: 0 }}>
          Google อัปเดตปฏิทินที่สมัครไว้เองทุกไม่กี่ชั่วโมง นัดใหม่จึงอาจขึ้นช้ากว่าในระบบ · ซิงก์ทางเดียว: แก้นัดใน HOOSE แล้ว Google จะเปลี่ยนตาม แต่แก้ใน Google จะไม่กลับมาที่ HOOSE ·
          ลิงก์นี้เป็นความลับ ใครมีลิงก์จะเห็นนัดของคุณ ถ้าหลุดให้กด <button className="link-btn" onClick={rotate}>สร้างลิงก์ใหม่</button>
        </p>
      </Modal>}
    </>
  );
}
