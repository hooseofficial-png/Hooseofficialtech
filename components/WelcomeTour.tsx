'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

/** Welcome box on the overview page: three animated slides on how HOOSE runs pre-production. */
const SLIDES = [
  {
    tag: 'เริ่มต้น',
    title: 'สร้างโปรเจกต์ใน 1 นาที',
    body: 'กด “+ โปรเจกต์ใหม่” แล้วกรอกข้อมูลหลักของงาน ทุกคนในทีมเห็นข้อมูลชุดเดียวกันทันที',
    points: ['ลูกค้า / แบรนด์ และประเภทงาน (TVC, Online, Photo …)', 'วันถ่าย จำนวนคิว เวลา Call และโลเคชัน', 'กด “ยืนยันรายละเอียด” เพื่อล็อกกันแก้ไขโดยไม่ตั้งใจ']
  },
  {
    tag: 'Pre-Production',
    title: 'วางพรีโปรดักชันเป็นขั้นตอน',
    body: 'แต่ละแท็บในโปรเจกต์คือหนึ่งขั้นของงาน ระบบคำนวณ “ความพร้อม” ให้อัตโนมัติ',
    points: ['ทีมงาน + Workscope และประกาศหาทีม (Open Call)', 'เอกสาร: Treatment, Storyboard, PPM, Call Sheet', 'งบประมาณร่างอัตโนมัติตามประเภทงาน']
  },
  {
    tag: 'ทำงานเป็นทีม',
    title: 'ทีม ปฏิทิน และสรุปผลในที่เดียว',
    body: 'เชิญทีมด้วยอีเมล แบ่งสิทธิ์ Editor / Viewer นัดทุกอย่างส่งเข้า Google Calendar ของทีม',
    points: ['Kick-off · PPM · Shoot Day ขึ้นปฏิทินทุกคน', 'สรุปผลเป็น PDF A4 ไฟล์เดียว', 'ลิงก์แชร์ให้ลูกค้าดูได้โดยไม่ต้องล็อกอิน']
  }
];

/** Types the text out letter by letter, then keeps a blinking caret. */
function TypeText({ text, delay = 350, speed = 70 }: { text: string; delay?: number; speed?: number }) {
  const chars = Array.from(text);
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0); let k = 0; let t: ReturnType<typeof setTimeout>;
    const tick = () => { k++; setN(k); if (k < chars.length) t = setTimeout(tick, speed); };
    t = setTimeout(tick, delay); return () => clearTimeout(t);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps
  return <span className="typed">{chars.slice(0, n).join('')}<span className="caret" /></span>;
}

function Art({ i, name }: { i: number; name?: string }) {
  if (i === 0) return (
    <div className="art art0" aria-hidden="true">
      <div className="mock">
        <div className="mock-h"><img src="/hoose-logo.png" alt="" className="mock-logo" /><TypeText text={'Hello ' + (name?.trim().split(/\s+/)[0] || 'there')} /></div>
        {['ลูกค้า', 'ประเภทงาน', 'วันถ่าย', 'โลเคชัน'].map((l, k) => <div className="mock-f" key={l} style={{ animationDelay: 0.25 + k * 0.18 + 's' }}><span>{l}</span><i /></div>)}
        <div className="mock-btn">ยืนยันรายละเอียด</div>
      </div>
    </div>
  );
  if (i === 1) {
    const st = ['รายละเอียด', 'ทีมงาน', 'เอกสาร', 'ปฏิทิน', 'งบประมาณ', 'สรุปผล'];
    return (
      <div className="art art1" aria-hidden="true">
        <div className="pipe">{st.map((s, k) => <div className="pipe-s" key={s} style={{ animationDelay: 0.15 + k * 0.16 + 's' }}><span className="pipe-n">{k + 1}</span>{s}</div>)}</div>
        <div className="ready"><span>ความพร้อมพรีโปรดักชัน</span><div className="ready-bar"><i /></div><b className="num">86%</b></div>
      </div>
    );
  }
  return (
    <div className="art art2" aria-hidden="true">
      <div className="avs">{['P', 'D', 'PM', 'A', 'C'].map((a, k) => <span key={a} style={{ animationDelay: 0.1 + k * 0.12 + 's' }}>{a}</span>)}</div>
      <div className="mcal">{Array.from({ length: 14 }, (_, k) => <i key={k} className={[3, 8, 9].includes(k) ? 'on' : k === 5 ? 'b' : ''} style={{ animationDelay: 0.3 + k * 0.03 + 's' }} />)}</div>
      <div className="pdf"><b>PDF</b><span>สรุปผล A4</span></div>
    </div>
  );
}

export default function WelcomeTour({ name, onClose, onCreate }: { name?: string; onClose: () => void; onCreate: () => void }) {
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const [leaving, setLeaving] = useState(false);
  const touch = useRef<number | null>(null);
  const go = useCallback((n: number) => { if (n < 0 || n >= SLIDES.length) return; setDir(n > i ? 1 : -1); setI(n); }, [i]);
  const close = useCallback(() => { setLeaving(true); setTimeout(onClose, 260); }, [onClose]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'ArrowRight') go(i + 1); if (e.key === 'ArrowLeft') go(i - 1); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [go, i]);
  const s = SLIDES[i]; const last = i === SLIDES.length - 1;
  return (
    <section className={'tour' + (leaving ? ' out' : '')} aria-roledescription="carousel" aria-label="แนะนำการใช้งาน HOOSE"
      onTouchStart={e => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={e => { if (touch.current === null) return; const d = e.changedTouches[0].clientX - touch.current; if (Math.abs(d) > 50) go(i + (d < 0 ? 1 : -1)); touch.current = null; }}>
      <div className="tour-glow" aria-hidden="true" />
      <button className="tour-x" onClick={close} aria-label="ปิดคู่มือ">✕</button>
      <div className={'tour-slide ' + (dir > 0 ? 'in-r' : 'in-l')} key={i} aria-live="polite">
        <div className="tour-text">
          <span className="tour-tag">{i === 0 && name ? `สวัสดี ${name.split(' ')[0]} · ` : ''}{s.tag} · {i + 1}/{SLIDES.length}</span>
          <h2>{s.title}</h2>
          <p>{s.body}</p>
          <ul>{s.points.map((p, k) => <li key={p} style={{ animationDelay: 0.2 + k * 0.1 + 's' }}>{p}</li>)}</ul>
        </div>
        <Art i={i} name={name} />
      </div>
      <div className="tour-foot">
        <div className="dots" role="tablist">{SLIDES.map((_, k) => <button key={k} role="tab" aria-selected={k === i} aria-label={'หน้า ' + (k + 1)} className={k === i ? 'on' : ''} onClick={() => go(k)} />)}</div>
        <div className="row">
          {i > 0 && <button className="btn tour-ghost" onClick={() => go(i - 1)}>ย้อนกลับ</button>}
          {last ? <>
            <button className="btn tour-ghost" onClick={close}>เข้าใจแล้ว</button>
            <button className="btn tour-cta" onClick={() => { close(); onCreate(); }}>+ สร้างโปรเจกต์</button>
          </> : <button className="btn tour-cta" onClick={() => go(i + 1)}>ถัดไป ›</button>}
        </div>
      </div>
    </section>
  );
}
