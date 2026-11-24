'use client';
import { useState } from 'react';
import { useProject } from '@/components/ProjectProvider';
import EventRow from '@/components/EventRow';
import CalendarSync from '@/components/CalendarSync';
import { MonthGrid, MonthNav, Legend } from '@/components/Calendar';
import { sb } from '@/lib/supabase/client';
import { ET, KINDS, evKey, firstShoot, fmtS, hm, todayISO, type EventType, type HEvent } from '@/lib/domain';
import { toast } from '@/lib/ui';

const blank = { kind: 'Kick-Off Meeting', date: '', time: '', title: '', tbd: false };

export default function CalendarPage() {
  const { id, data, act } = useProject();
  const [f, setF] = useState(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | EventType>('all');
  const [month, setMonth] = useState<string | null>(null);
  if (!data) return null;
  const p = data.project; const t = todayISO();
  const ev = data.events.slice().sort((a, b) => evKey(a).localeCompare(evKey(b)));
  const list = ev.filter(e => filter === 'all' || e.type === filter);
  const m = month || (firstShoot(data) || t).slice(0, 7);

  async function save() {
    if (!f.tbd && !f.date) { toast('เลือกวันที่ หรือติ๊ก “ยังไม่ระบุวัน”'); return; }
    const type = (KINDS.find(k => k[0] === f.kind) || KINDS[2])[1];
    const row = { kind: f.kind, type, date: f.tbd ? null : f.date, time: f.time || null, title: f.title.trim() };
    const ok = editing ? await act(() => sb().from('events').update(row).eq('id', editing), 'อัปเดตนัดหมายแล้ว')
      : await act(() => sb().from('events').insert({ ...row, project_id: id }), f.tbd ? 'เพิ่มนัดแบบยังไม่ระบุวันแล้ว' : 'เพิ่มลงปฏิทินแล้ว');
    if (ok) { if (row.date) setMonth(row.date.slice(0, 7)); setF(blank); setEditing(null); }
  }
  function startEdit(e: HEvent) {
    setEditing(e.id); window.scrollTo(0, 0);
    setF({ kind: e.kind || (e.type === 'shoot' ? KINDS[5][0] : e.type === 'brief' ? 'Brief before Production' : 'General Meeting'), date: e.date || '', time: hm(e.time), title: e.title, tbd: !e.date });
  }
  return (
    <div className="grid">
      <section className="card c12"><div className="row w" style={{ gap: 10 }}>
        {(Object.keys(ET) as EventType[]).map(k => { const l = ev.filter(e => e.type === k); const nx = l.find(e => e.date && e.date >= t); return (
          <div key={k} style={{ flex: 1, minWidth: 150, background: 'var(--soft)', borderRadius: 12, padding: 12 }}>
            <div className="row" style={{ gap: 6 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: ET[k][1] }} /><span className="cap">{ET[k][0]}</span></div>
            <b className="num" style={{ font: '600 24px var(--f-display)' }}>{l.length}</b>
            <div className="mut" style={{ fontSize: 12 }}>{nx ? 'ถัดไป ' + fmtS(nx.date) + (nx.time ? ' · ' + hm(nx.time) : '') : l.length ? 'ไม่มีนัดที่จะถึง' : 'ยังไม่นัด'}</div>
          </div>); })}
      </div></section>
      <section className="card c12"><h2>{editing ? 'แก้ไขนัดหมาย' : 'เพิ่มนัดหมาย'}</h2>
        <div className="fg">
          <label className="f" htmlFor="ev-kind">ประเภทนัด<select className="in-t" id="ev-kind" value={f.kind} onChange={e => setF({ ...f, kind: e.target.value })}>{KINDS.map(([k]) => <option key={k}>{k}</option>)}</select></label>
          <label className="f" htmlFor="ev-date">วันที่<input className="in-t" type="date" id="ev-date" value={f.date} disabled={f.tbd} onChange={e => setF({ ...f, date: e.target.value })} /></label>
          <label className="f" htmlFor="ev-time">เวลา<input className="in-t" type="time" id="ev-time" value={f.time} onChange={e => setF({ ...f, time: e.target.value })} /></label>
          <label className="f" htmlFor="ev-title">หัวข้อ / สถานที่ (ไม่บังคับ)<input className="in-t" id="ev-title" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="เช่น ออฟฟิศเอเจนซี่ / Google Meet" /></label>
        </div>
        <label className="row" htmlFor="ev-tbd" style={{ gap: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', width: 'max-content' }}>
          <input type="checkbox" id="ev-tbd" checked={f.tbd} onChange={e => setF({ ...f, tbd: e.target.checked })} style={{ width: 18, height: 18, accentColor: 'var(--blue)' }} />ยังไม่ระบุวัน (มีหัวข้อแล้ว รอยืนยันวัน)</label>
        <div className="row w"><button className="btn p" onClick={save}>{editing ? 'บันทึก' : 'เพิ่มลงปฏิทิน'}</button>{editing && <button className="btn" onClick={() => { setEditing(null); setF(blank); }}>ยกเลิก</button>}</div>
      </section>
      <section className="card c12"><div className="between"><h2>ปฏิทินทีม</h2><div className="row w"><CalendarSync /><MonthNav month={m} setMonth={setMonth} /></div></div><MonthGrid month={m} items={ev.map(e => ({ e, label: hm(e.time) || ET[e.type][0], title: e.title || e.kind }))} /><Legend /></section>
      <section className="card c12">
        <div className="between"><h2>รายการนัด</h2><div className="seg" role="group" aria-label="ตัวกรอง">{([['all', 'ทั้งหมด'], ['brief', 'บรีฟ'], ['meeting', 'ประชุม'], ['shoot', 'ถ่ายทำ']] as const).map(([k, l]) => <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}</button>)}</div></div>
        {!list.length && <div className="empty">ยังไม่มีนัดหมาย</div>}
        {list.some(e => !e.date) && <><div className="cap">ยังไม่ระบุวัน</div><div className="list">{list.filter(e => !e.date).map(e => <EventRow key={e.id} p={p} e={e} onEdit={() => startEdit(e)} onDelete={() => act(() => sb().from('events').delete().eq('id', e.id), 'ลบนัดแล้ว')} />)}</div><div className="cap" style={{ marginTop: 6 }}>มีวันแล้ว</div></>}
        <div className="list">{list.filter(e => e.date).map(e => <EventRow key={e.id} p={p} e={e} onEdit={() => startEdit(e)} onDelete={() => act(() => sb().from('events').delete().eq('id', e.id), 'ลบนัดแล้ว')} />)}</div>
      </section>
    </div>
  );
}
