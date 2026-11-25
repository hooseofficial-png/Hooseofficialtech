'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Modal from './Modal';
import { sb } from '@/lib/supabase/client';
import { copyText, toast, errText } from '@/lib/ui';

type Conn = { google_email: string; connected_at: string } | null;

/**
 * "Sync กับ Google Calendar".
 * 1) Connect the HOOSE account to Google (Calendar API): new appointments go straight into Google Calendar
 *    and the team (owner, editors, viewers) get e-mail invitations.
 * 2) Alternative: subscribe to the personal iCal feed; we show "ADD เสร็จสิ้น" once Google first fetches it.
 */
export default function CalendarSync({ variant = 'button' }: { variant?: 'button' | 'card' }) {
  const [uid, setUid] = useState('');
  const [token, setToken] = useState('');
  const [conn, setConn] = useState<Conn>(null);
  const [open, setOpen] = useState(false);
  const [feedAdded, setFeedAdded] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [gOn, setGOn] = useState(false);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    const { data } = await sb().auth.getUser(); if (!data.user) return; setUid(data.user.id);
    const [{ data: p }, { data: g }] = await Promise.all([
      sb().from('profiles').select('calendar_token, calendar_feed_seen_at').eq('id', data.user.id).maybeSingle(),
      sb().rpc('my_google_connection')
    ]);
    if (p?.calendar_token) setToken(p.calendar_token);
    if (p?.calendar_feed_seen_at) setFeedAdded(true);
    setConn(((g as Conn[] | null) || [])[0] || null);
    fetch('/api/google/status').then(r => r.json()).then(j => setGOn(!!j.configured)).catch(() => setGOn(false));
  }, []);
  useEffect(() => { refresh(); return () => { if (poll.current) clearInterval(poll.current); }; }, [refresh]);

  const site = process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
  const feed = token ? `${site}/api/calendar/${token}.ics` : '';
  const google = feed ? 'https://calendar.google.com/calendar/render?cid=' + encodeURIComponent(feed.replace(/^https?:/, 'webcal:')) : '';
  const here = typeof window !== 'undefined' ? window.location.pathname : '/account';
  const connectHref = '/api/google/connect?next=' + encodeURIComponent(here);

  // After "เปิด Google Calendar แล้วกดเพิ่ม", wait for Google's first fetch of the feed, then say ADD เสร็จสิ้น.
  function watchFeed() {
    const since = Date.now(); setWaiting(true); if (poll.current) clearInterval(poll.current);
    let n = 0;
    poll.current = setInterval(async () => {
      n++;
      const { data } = await sb().from('profiles').select('calendar_feed_seen_at').eq('id', uid).maybeSingle();
      const seen = data?.calendar_feed_seen_at ? new Date(data.calendar_feed_seen_at).getTime() : 0;
      if (seen >= since - 5000) { clearInterval(poll.current!); setWaiting(false); setFeedAdded(true); toast('ADD เสร็จสิ้น · Google Calendar เพิ่มปฏิทิน HOOSE แล้ว'); }
      else if (n > 120) { clearInterval(poll.current!); setWaiting(false); }
    }, 5000);
  }
  async function disconnect() {
    const r = await fetch('/api/google/disconnect', { method: 'POST' });
    if (r.ok) { setConn(null); toast('ยกเลิกการเชื่อม Google แล้ว'); } else toast('ยกเลิกไม่สำเร็จ ลองอีกครั้ง');
  }
  async function rotate() {
    const { data, error } = await sb().rpc('rotate_calendar_token');
    if (error) { toast(errText(error)); return; }
    setToken(data as string); setFeedAdded(false); toast('สร้างลิงก์ใหม่แล้ว · ลิงก์เดิมใช้ไม่ได้อีก ต้องกด Sync ใหม่');
  }

  const label = conn && gOn ? 'Google Calendar · เชื่อมแล้ว' : 'Sync กับ Google Calendar';
  const trigger = <button className={variant === 'card' ? ((conn && gOn) || feedAdded ? 'btn' : 'btn p') : 'btn sm'} onClick={() => setOpen(true)} disabled={!uid}>{label}</button>;
  return (
    <>
      {variant === 'card' ? (
        <section className="card" style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div className="grow" style={{ minWidth: 220 }}>
            <h2>Google Calendar</h2>
            {conn && gOn ? <span className="gc-ok">✓ ADD เสร็จสิ้น · เชื่อมกับ {conn.google_email || 'บัญชี Google'} แล้ว</span>
              : feedAdded ? <span className="gc-ok">✓ ADD เสร็จสิ้น · Google Calendar เพิ่มปฏิทิน HOOSE แล้ว</span>
              : <span className="mut" style={{ fontSize: 13 }}>{gOn ? 'เชื่อมบัญชี Google แล้วนัดบรีฟ ประชุม และวันถ่าย จะส่งเข้า Google Calendar และอีเมลของทีมอัตโนมัติ' : 'เพิ่มปฏิทิน HOOSE เข้า Google Calendar แล้วนัดบรีฟ ประชุม และวันถ่ายของทุกโปรเจกต์จะขึ้นในปฏิทินของคุณ'}</span>}
          </div>
          {trigger}
        </section>
      ) : trigger}
      {open && <Modal title="Sync กับ Google Calendar" onClose={() => setOpen(false)}>
        {gOn && <div className="cap">แบบที่ 1 · สมัครรับปฏิทินด้วยลิงก์</div>}
        <p className="mut" style={{ fontSize: 13, margin: 0 }}>กดปุ่มด้านล่าง แล้วกด <b>เพิ่ม (Add)</b> ใน Google Calendar เมื่อ Google เพิ่มเสร็จ หน้านี้จะแจ้ง “ADD เสร็จสิ้น”</p>
        {feedAdded ? <div className="gc-ok">✓ ADD เสร็จสิ้น · Google Calendar เพิ่มปฏิทิน HOOSE แล้ว</div>
          : waiting ? <div className="mut" style={{ fontSize: 13 }}>รอ Google เพิ่มปฏิทิน… กด <b>เพิ่ม (Add)</b> ในหน้าต่าง Google Calendar แล้วกลับมาที่นี่</div> : null}
        <a className="btn" href={google} target="_blank" rel="noopener noreferrer" onClick={watchFeed}>เปิด Google Calendar แล้วกดเพิ่ม</a>
        <div className="row"><input className="in-t" readOnly value={feed} aria-label="ลิงก์ปฏิทิน" /><button className="btn" onClick={() => copyText(feed, 'คัดลอกลิงก์แล้ว')}>คัดลอก</button></div>
        <p className="mut" style={{ fontSize: 12, margin: 0 }}>
          แบบลิงก์: Google อัปเดตเองทุกไม่กี่ชั่วโมง ใช้กับ Apple Calendar / Outlook ได้ · ลิงก์นี้เป็นความลับ ถ้าหลุดให้กด <button className="link-btn" onClick={rotate}>สร้างลิงก์ใหม่</button>
        </p>
        {gOn && <>
        <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '4px 0' }} />
        <div className="cap">แบบที่ 2 · เชื่อมบัญชี Google (ส่งนัดถึงทีมอัตโนมัติ)</div>
        {conn ? (
          <>
            <div className="gc-ok">✓ ADD เสร็จสิ้น · เชื่อมกับ {conn.google_email || 'บัญชี Google'} แล้ว</div>
            <p className="mut" style={{ fontSize: 13, margin: 0 }}>เมื่อคุณสร้าง แก้ หรือลบนัดใน HOOSE ระบบจะส่งเข้า Google Calendar ของคุณทันที และส่งคำเชิญทางอีเมลถึงทีมในโปรเจกต์ (Owner · Editor · Viewer) นัดจะขึ้นใน Google Calendar ของแต่ละคน</p>
            <div className="row w"><a className="btn" href={connectHref}>เชื่อมบัญชีอื่น</a><button className="btn" onClick={disconnect}>ยกเลิกการเชื่อม</button></div>
          </>
        ) : (
          <>
            <p className="mut" style={{ fontSize: 13, margin: 0 }}>กดแล้วเลือกบัญชี Google แล้วกด <b>อนุญาต (Allow)</b> เมื่อกลับมาที่ HOOSE จะแจ้ง “ADD เสร็จสิ้น” · หลังจากนั้นนัดใหม่จะเข้า Google Calendar ทันที พร้อมส่งอีเมลเชิญทีม</p>
            <a className="btn p" href={connectHref}>เชื่อมบัญชี Google</a>
          </>
        )}
        </>}
      </Modal>}
    </>
  );
}
