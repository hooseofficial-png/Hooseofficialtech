'use client';
import { useEffect, useRef, useState } from 'react';
import { useProject } from '@/components/ProjectProvider';
import { sb } from '@/lib/supabase/client';
import { D, TYPES, fmtL, iso, num, shootDays, type Project } from '@/lib/domain';
import { toast, errText } from '@/lib/ui';

type Key = keyof Project;

/** Text/date/select field that saves itself ~0.7 s after typing stops. */
function Field({ label, k, type = 'text', ph = '', options, area, locked }: { label: string; k: Key; type?: string; ph?: string; options?: string[]; area?: boolean; locked: boolean }) {
  const { id, data, reload } = useProject();
  const server = data!.project[k] as unknown;
  const toStr = (v: unknown) => (v == null ? '' : type === 'time' ? String(v).slice(0, 5) : String(v));
  const [val, setVal] = useState(toStr(server));
  const [state, setState] = useState<'' | 'saving' | 'saved'>('');
  const t = useRef<ReturnType<typeof setTimeout>>();
  const dirty = useRef(false);
  useEffect(() => { if (!dirty.current) setVal(toStr(server)); }, [server]); // eslint-disable-line react-hooks/exhaustive-deps
  async function save(v: string) {
    setState('saving');
    const value = v === '' ? (['start_date', 'end_date', 'call_time', 'wrap_time', 'queues'].includes(k) ? null : '') : type === 'number' ? Math.round(num(v)) : v;
    const { error } = await sb().from('projects').update({ [k]: value }).eq('id', id);
    dirty.current = false;
    if (error) { toast(errText(error)); setState(''); reload(); } else { setState('saved'); setTimeout(() => setState(''), 1200); if (type === 'date' || options) reload(); }
  }
  const onChange = (v: string) => { setVal(v); dirty.current = true; clearTimeout(t.current); t.current = setTimeout(() => save(v), options || type === 'date' ? 0 : 700); };
  const fid = 'f-' + String(k);
  const common = { id: fid, className: 'in-t', disabled: locked, value: val, placeholder: ph };
  return (
    <label className="f" htmlFor={fid} style={area ? { gridColumn: '1/-1' } : undefined}>
      <span className="between" style={{ gap: 6 }}>{label}{state && <span className="saving">{state === 'saving' ? 'กำลังบันทึก…' : 'บันทึกแล้ว'}</span>}</span>
      {options ? <select {...common} onChange={e => onChange(e.target.value)}><option value="">เลือก…</option>{options.map(o => <option key={o}>{o}</option>)}</select>
        : area ? <textarea {...common} onChange={e => onChange(e.target.value)} />
        : <input {...common} type={type} inputMode={type === 'number' ? 'numeric' : undefined} onChange={e => onChange(e.target.value)} onBlur={() => { if (dirty.current) { clearTimeout(t.current); save(val); } }} />}
    </label>
  );
}

export default function Details() {
  const { id, data, act, upload, signed } = useProject();
  const [loc, setLoc] = useState('');
  if (!data) return null;
  const p = data.project; const L = p.details_locked;
  const upd = (patch: Partial<Project>, ok?: string) => act(() => sb().from('projects').update(patch).eq('id', id), ok);
  async function logo(f?: File) {
    if (!f) return; const r = await upload(f, 'logo'); if (r) upd({ logo_path: r.path }, 'อัปโหลดโลโก้แล้ว');
  }
  async function buildShoot() {
    if (!p.start_date) { toast('ตั้งวันถ่ายวันแรกก่อน'); return; }
    const q = Math.max(1, num(p.queues) || 1); const have = new Set(shootDays(data!).map(e => e.date)); const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < q; i++) { const d = D(p.start_date); d.setDate(d.getDate() + i); const ds = iso(d); if (!have.has(ds)) rows.push({ project_id: id, type: 'shoot', kind: 'Shoot Day · วันถ่ายทำ', date: ds, time: p.call_time, title: p.locations[0] || '' }); }
    if (!rows.length) { toast('วันถ่ายครบอยู่แล้ว'); return; }
    await act(() => sb().from('events').insert(rows), 'เพิ่ม ' + rows.length + ' วันถ่ายลงปฏิทินแล้ว');
    if (!p.end_date && q > 1) { const d = D(p.start_date); d.setDate(d.getDate() + q - 1); upd({ end_date: iso(d) }); }
  }
  const logoUrl = signed(p.logo_path);
  return (
    <div className="grid">
      {L && <div className="banner c12" style={{ gridColumn: 'span 12' }}>ยืนยันรายละเอียดแล้ว{p.locked_at ? ' · ' + fmtL(p.locked_at.slice(0, 10)) : ''} · ล็อกไว้กันแก้ไขโดยไม่ตั้งใจ<span className="sp" /><button className="btn sm" onClick={() => upd({ details_locked: false })}>แก้ไขรายละเอียด</button></div>}
      <section className="card c12"><h2>ลูกค้าและแบรนด์</h2>
        <div className="row w">
          <span className="logo-box" style={{ width: 64, height: 64, border: '1px solid var(--line)' }}>{logoUrl ? <img alt="โลโก้ลูกค้า" src={logoUrl} /> : <span className="mut" style={{ fontSize: 11 }}>โลโก้</span>}</span>
          {!L && <><label className="btn sm" htmlFor="logo-in">{p.logo_path ? 'เปลี่ยนโลโก้' : 'อัปโหลดโลโก้'}</label><input id="logo-in" type="file" hidden accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={e => { logo(e.target.files?.[0]); e.target.value = ''; }} />
            {p.logo_path && <button className="btn sm ghost" onClick={() => upd({ logo_path: null })}>นำออก</button>}</>}
        </div>
        <div className="fg">
          <Field locked={L} label="แบรนด์ / ลูกค้า" k="brand" /><Field locked={L} label="เอเจนซี่" k="agency" /><Field locked={L} label="บริษัทโปรดักชัน" k="company" />
          <Field locked={L} label="ผู้กำกับ" k="director" /><Field locked={L} label="โปรดิวเซอร์" k="producer" /><Field locked={L} label="Production Manager" k="pm_name" />
          <Field locked={L} label="เบอร์ PM" k="pm_phone" type="tel" ph="08x-xxx-xxxx" /><Field locked={L} label="ชิ้นงานที่ส่งมอบ" k="deliverables" ph="เช่น 1 × 30 วิ, 2 × 15 วิ, ภาพนิ่ง 6 ภาพ" />
        </div>
      </section>
      <section className="card c12"><h2>ข้อมูลพื้นฐาน</h2><div className="fg">
        <Field locked={L} label="ชื่อโปรเจกต์" k="name" ph="เช่น FIRST RAIN" /><Field locked={L} label="ประเภท" k="type" options={TYPES} /><Field locked={L} label="แคมเปญ / เลขที่งาน" k="campaign" />
        <Field locked={L} label="เรื่องย่อ / บรีฟสำหรับทีมงาน" k="synopsis" area ph="งานนี้ถ่ายอะไร สรุปสั้น ๆ 2–3 บรรทัด (ใช้ในประกาศหาทีมงาน)" />
      </div></section>
      <section className="card c12"><h2>การถ่ายทำ</h2><div className="fg">
        <Field locked={L} label="วันถ่ายวันแรก" k="start_date" type="date" /><Field locked={L} label="วันถ่ายวันสุดท้าย" k="end_date" type="date" /><Field locked={L} label="จำนวนคิว" k="queues" type="number" />
        <Field locked={L} label="เวลาคอลทีมงาน" k="call_time" type="time" /><Field locked={L} label="เวลาเลิกกองโดยประมาณ" k="wrap_time" type="time" />
        <Field locked={L} label="รูปแบบกอง" k="setting" options={['สตูดิโอ', 'ถ่ายนอกสถานที่', 'ผสม']} /><Field locked={L} label="ช่วงเวลา" k="time_of_day" options={['กลางวัน', 'กลางคืน', 'กลางวัน + กลางคืน']} />
        <Field locked={L} label="ข้อกำหนดพิเศษ" k="special" area ph="เช่น ฉากฝน มีเด็กในกอง โดรน" />
      </div>
        <div className="row w">{!L && <button className="btn p" onClick={buildShoot}>สร้างวันถ่ายลงปฏิทิน</button>}<span className="mut" style={{ fontSize: 12 }}>{shootDays(data).length} วันถ่ายในปฏิทินตอนนี้</span></div>
      </section>
      <section className="card c12"><h2>สถานที่</h2>
        {p.locations.length > 0 ? <div className="list">{p.locations.map((l, i) => <div className="li" key={i}><span className="chip lb">{i + 1}</span><span className="grow ell">{l}</span>{!L && <button className="btn sm ghost" onClick={() => upd({ locations: p.locations.filter((_, j) => j !== i) })}>นำออก</button>}</div>)}</div> : L && <div className="mut">ยังไม่มีสถานที่</div>}
        {!L && <form className="row" onSubmit={e => { e.preventDefault(); const v = loc.trim(); if (v) { upd({ locations: [...p.locations, v] }); setLoc(''); } }}>
          <input className="in-t" value={loc} onChange={e => setLoc(e.target.value)} placeholder="เช่น ตึกแถวตลาดน้อย กรุงเทพฯ" aria-label="สถานที่ใหม่" /><button className="btn">เพิ่ม</button></form>}
      </section>
      <section className="card c12"><h2>กลุ่ม LINE ของทีม</h2><div className="fg"><Field locked={L} label="ลิงก์เชิญกลุ่ม LINE" k="line_group_link" ph="https://line.me/R/ti/g/…" /></div><span className="mut" style={{ fontSize: 12 }}>ใส่ในข้อความยืนยันที่ส่งให้ทีมงาน</span></section>
      <section className="card c12" style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
        {L ? <><span className="chip b">✓ ยืนยันแล้ว</span><span className="grow mut" style={{ fontSize: 13 }}>กด “แก้ไขรายละเอียด” เพื่อปลดล็อก</span><button className="btn" onClick={() => upd({ details_locked: false })}>แก้ไขรายละเอียด</button></>
          : <><span className="grow mut" style={{ fontSize: 13 }}>ตรวจข้อมูลให้ครบแล้วกดยืนยัน ระบบจะล็อกหน้านี้ (ฐานข้อมูลจะไม่รับการแก้ไขจนกว่าจะปลดล็อก)</span><button className="btn p" onClick={() => { upd({ details_locked: true }, 'ยืนยันรายละเอียดแล้ว'); window.scrollTo(0, 0); }}>ยืนยันรายละเอียด</button></>}
      </section>
    </div>
  );
}
