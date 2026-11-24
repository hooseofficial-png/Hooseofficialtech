'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useProject } from '@/components/ProjectProvider';
import Modal from '@/components/Modal';
import { sb } from '@/lib/supabase/client';
import { DEPTS, PRESETS, RATE, STATUS, confirmMsg, crewAllCost, crewCommitted, crewCost, crewLine, fmtS, ini, lineShare, money, num, ocMessage, safeUrl, type Crew, type CrewStatus } from '@/lib/domain';
import { toast } from '@/lib/ui';

type Draft = Partial<Crew> & { scopeUrlIn?: string };

function CrewForm({ draft, setDraft, isNew, onSave, onCancel, onDelete }: { draft: Draft; setDraft: (d: Draft) => void; isNew: boolean; onSave: () => void; onCancel: () => void; onDelete?: () => void }) {
  const { upload } = useProject();
  const dk = draft.dept || 'dir'; const opts = (DEPTS.find(d => d[0] === dk) || DEPTS[0])[2];
  const custom = !opts.length || (!!draft.position && !opts.includes(draft.position));
  const set = (patch: Draft) => setDraft({ ...draft, ...patch });
  const st = (draft.status || 'confirmed') as CrewStatus;
  async function scopeFile(f?: File) { if (!f) return; const r = await upload(f, 'workscope'); if (r) { set({ scope_file_path: r.path, scope_file_name: r.name, scope_url: '' }); toast('แนบไฟล์แล้ว · กดบันทึกตำแหน่ง'); } }
  return (
    <div className="edit">
      <div className="fg">
        <label className="f" htmlFor="cb-dept">ฝ่าย<select className="in-t" id="cb-dept" value={dk} onChange={e => { const o = (DEPTS.find(d => d[0] === e.target.value) || DEPTS[0])[2]; set({ dept: e.target.value, position: o[0] || '', budget: RATE[o[0]] ?? draft.budget }); }}>
          {DEPTS.map(d => <option key={d[0]} value={d[0]}>{d[1]}</option>)}</select></label>
        <label className="f" htmlFor="cb-pos">ตำแหน่ง<select className="in-t" id="cb-pos" value={custom ? '__other' : draft.position} onChange={e => set(e.target.value === '__other' ? { position: '' } : { position: e.target.value, budget: RATE[e.target.value] ?? draft.budget })}>
          {opts.map(o => <option key={o}>{o}</option>)}<option value="__other">อื่น ๆ (พิมพ์เอง)</option></select></label>
        {custom && <label className="f" htmlFor="cb-posc">ชื่อตำแหน่ง<input className="in-t" id="cb-posc" value={draft.position || ''} onChange={e => set({ position: e.target.value })} placeholder="เช่น Drone Operator" /></label>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>สถานะ
        <div className="seg" role="group" aria-label="สถานะ">{(Object.keys(STATUS) as CrewStatus[]).map(k => <button type="button" key={k} className={st === k ? 'on' : ''} onClick={() => set({ status: k })}>{STATUS[k][0]}</button>)}</div>
      </div>
      <div className="fg">
        <label className="f" htmlFor="cb-name">ชื่อทีมงาน{st === 'open' ? ' (ใส่เมื่อได้คนแล้ว)' : ''}<input className="in-t" id="cb-name" value={draft.name || ''} onChange={e => set({ name: e.target.value })} /></label>
        <label className="f" htmlFor="cb-phone">เบอร์โทร<input className="in-t" id="cb-phone" type="tel" value={draft.phone || ''} onChange={e => set({ phone: e.target.value })} placeholder="08x-xxx-xxxx" /></label>
        <label className="f" htmlFor="cb-line">LINE ID<input className="in-t" id="cb-line" value={draft.line_id || ''} onChange={e => set({ line_id: e.target.value })} placeholder="@lineid" /></label>
      </div>
      <div className="fg">
        <label className="f" htmlFor="cb-rate">เรท<select className="in-t" id="cb-rate" value={draft.rate_type || 'day'} onChange={e => set({ rate_type: e.target.value as 'day' | 'flat' })}><option value="day">ต่อวัน</option><option value="flat">เหมาจ่าย</option></select></label>
        <label className="f" htmlFor="cb-budget">งบ ฿<input className="in-t num" id="cb-budget" inputMode="numeric" value={draft.budget ?? ''} onChange={e => set({ budget: num(e.target.value) })} /></label>
        {draft.rate_type !== 'flat' && <label className="f" htmlFor="cb-days">จำนวนวัน<input className="in-t num" id="cb-days" inputMode="decimal" value={draft.days ?? ''} onChange={e => set({ days: num(e.target.value) })} /></label>}
        <label className="f" htmlFor="cb-scope" style={{ gridColumn: '1/-1' }}>ขอบเขตงาน (สรุป)<input className="in-t" id="cb-scope" value={draft.scope || ''} onChange={e => set({ scope: e.target.value })} placeholder="เช่น ฉากฝน ไม่ต้องนำชุดไฟมาเอง" /></label>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>ไฟล์ Workscope
        {(draft.scope_file_path || draft.scope_url) && <div className="row" style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 10, padding: '8px 10px' }}><span className="grow ell">{draft.scope_file_name || draft.scope_url}</span><button type="button" className="btn sm ghost" onClick={() => set({ scope_file_path: null, scope_file_name: '', scope_url: '' })}>นำออก</button></div>}
        <div className="row w">
          <label className="btn sm" htmlFor="cb-scopefile">{draft.scope_file_path || draft.scope_url ? 'เปลี่ยนไฟล์' : 'แนบไฟล์'}</label>
          <input type="file" id="cb-scopefile" hidden accept="application/pdf,image/png,image/jpeg,image/webp,text/plain" onChange={e => { scopeFile(e.target.files?.[0]); e.target.value = ''; }} />
          <input className="in-t" style={{ maxWidth: 360, height: 32, fontSize: 13 }} value={draft.scopeUrlIn || ''} onChange={e => set({ scopeUrlIn: e.target.value })} placeholder="หรือวางลิงก์ https://…" aria-label="ลิงก์ไฟล์ Workscope" />
        </div>
      </div>
      <div className="row w"><button className="btn p" onClick={onSave}>{isNew ? 'เพิ่มตำแหน่ง' : 'บันทึก'}</button><button className="btn" onClick={onCancel}>ยกเลิก</button>{onDelete && <><span className="sp" /><button className="btn ghost" onClick={onDelete}>ลบตำแหน่ง</button></>}</div>
    </div>
  );
}

export default function CrewPage() {
  const { id, data, act, openFile } = useProject();
  const [edit, setEdit] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const [del, setDel] = useState<Crew | null>(null);
  const [oc, setOc] = useState(false);
  if (!data) return null;
  const p = data.project; const cr = data.crew;
  const alloc = crewLine(data); const com = crewCommitted(data); const all = crewAllCost(data); const hasAlloc = num(data.budget?.crew_alloc) > 0;
  const open = cr.filter(c => c.status === 'open'); const ann = data.announcements[data.announcements.length - 1];

  function startNew() { setEdit('new'); setDraft({ dept: 'dir', position: 'Director', status: 'confirmed', rate_type: 'day', budget: RATE.Director, days: num(p.queues) || 1 }); }
  async function save() {
    const d = { ...draft };
    if (d.scopeUrlIn) { const u = safeUrl(d.scopeUrlIn); if (!u) { toast('ลิงก์ Workscope ต้องขึ้นต้นด้วย https://'); return; } d.scope_url = u; d.scope_file_path = null; d.scope_file_name = 'ลิงก์ Workscope'; }
    if (!String(d.position || '').trim()) { toast('ใส่ชื่อตำแหน่งก่อน'); return; }
    let conv = false; if (d.status === 'open' && String(d.name || '').trim()) { d.status = 'pending'; conv = true; }
    if (d.status !== 'open' && !String(d.name || '').trim()) { toast('ใส่ชื่อทีมงาน หรือเลือก Open Call'); return; }
    const row = { dept: d.dept, position: d.position, status: d.status, name: d.name || '', phone: d.phone || '', line_id: d.line_id || '', rate_type: d.rate_type || 'day', budget: num(d.budget), days: num(d.days) || 1, scope: d.scope || '', scope_file_path: d.scope_file_path || null, scope_file_name: d.scope_file_name || '', scope_url: d.scope_url || '' };
    const msg = conv ? 'ใส่ชื่อแล้ว สถานะเปลี่ยนเป็นรอยืนยัน' : edit === 'new' ? 'เพิ่มตำแหน่งแล้ว' : 'บันทึกแล้ว';
    const ok = edit === 'new' ? await act(() => sb().from('crew_positions').insert({ ...row, project_id: id, sort: cr.length }), msg) : await act(() => sb().from('crew_positions').update(row).eq('id', edit!), msg);
    if (ok) { setEdit(null); setDraft({}); }
  }
  async function preset(k: string) {
    const rows = PRESETS[k].map((s, i) => { const [dept, position] = s.split(':'); return { project_id: id, dept, position, status: 'open', rate_type: 'day', budget: RATE[position] || 0, days: num(p.queues) || 1, sort: cr.length + i }; });
    act(() => sb().from('crew_positions').insert(rows), rows.length + ' ตำแหน่งเพิ่มเป็น Open Call แล้ว');
  }
  async function queueAnnouncement() {
    setOc(false);
    act(() => sb().from('announcements').insert({ project_id: id, position_ids: open.map(c => c.id), message: ocMessage(data!) }), 'เข้าคิวประกาศแล้ว · จะส่งผ่าน HOOSE Official LINE OA เมื่อเชื่อมระบบ');
  }
  return (
    <div className="grid">
      <section className="card c8"><div className="between"><h2>งบทีมงาน</h2><Link className="btn sm" href={`/p/${id}/budget`}>ตั้งจากหน้างบประมาณ</Link></div>
        <div className="row w" style={{ gap: 24 }}>{[['งบทีมงาน', money(alloc)], ['ยืนยัน/รอยืนยัน', money(com)], ['Open Call', money(all - com)], ['คงเหลือ', hasAlloc ? money(alloc - all) : '—']].map(([l, v]) =>
          <div key={l}><div className="cap">{l}</div><b className="num" style={{ font: '600 20px var(--f-display)' }}>{v}</b></div>)}</div>
        {hasAlloc ? <><div className="bar"><i style={{ width: Math.min(100, all / alloc * 100) + '%', background: all > alloc ? 'var(--ink)' : undefined }} /></div>{all > alloc && <span className="chip k">เกินงบทีมงาน {money(all - alloc)}</span>}</>
          : <span className="mut" style={{ fontSize: 12 }}>ยังไม่ตั้งงบทีมงาน ระบบใช้ยอดรวมของทุกตำแหน่งแทน</span>}
      </section>
      <section className="card c4"><h2>ประกาศหาตำแหน่งเพิ่ม</h2>
        <div className="mut">{open.length ? open.length + ' ตำแหน่งรอคน' : 'ไม่มีตำแหน่งว่าง'}</div>
        {ann && <div className="row w" style={{ gap: 6 }}><span className="chip lb">{ann.status === 'sent' ? 'ส่งแล้ว' : 'ในคิว · รอเชื่อม LINE OA'}</span><span className="mut" style={{ fontSize: 12 }}>{fmtS(ann.created_at.slice(0, 10))} · {ann.positions} ตำแหน่ง</span></div>}
        <button className="btn k" disabled={!open.length} onClick={() => setOc(true)}>ประกาศผ่าน HOOSE Official</button>
        <div className="row w"><span className="mut" style={{ fontSize: 12 }}>เทมเพลตทีม</span><button className="btn sm" onClick={() => preset('small')}>เล็ก · 8</button><button className="btn sm" onClick={() => preset('medium')}>กลาง · 16</button></div>
      </section>
      <section className="card c12">
        <div className="between"><h2>ตำแหน่งทั้งหมด <span className="mut num" style={{ fontWeight: 500 }}>{cr.length}</span></h2><button className="btn p" onClick={startNew}>+ เพิ่มตำแหน่ง</button></div>
        {edit === 'new' && <CrewForm draft={draft} setDraft={setDraft} isNew onSave={save} onCancel={() => setEdit(null)} />}
        {!cr.length && edit !== 'new' && <div className="empty">ยังไม่มีตำแหน่ง กดเพิ่มตำแหน่ง หรือเริ่มจากเทมเพลตทีม</div>}
        {DEPTS.map(([dk, dn]) => {
          const rows = cr.filter(c => (c.dept || 'other') === dk); if (!rows.length) return null;
          return (
            <details className="dept" open key={dk}>
              <summary><span className="grow">{dn}</span><span className="mut num" style={{ fontSize: 12 }}>{rows.filter(c => c.status === 'confirmed').length}/{rows.length} · {money(rows.reduce((a, c) => a + crewCost(c), 0))}</span></summary>
              {rows.map(c => edit === c.id
                ? <CrewForm key={c.id} draft={draft} setDraft={setDraft} isNew={false} onSave={save} onCancel={() => setEdit(null)} onDelete={() => setDel(c)} />
                : (
                  <div className="crow" key={c.id}>
                    <span className={'av' + (c.status === 'open' ? ' o' : c.status === 'pending' ? ' g' : '')}>{c.status === 'open' && !c.name ? '?' : ini(c.name)}</span>
                    <div className="grow" style={{ minWidth: 160 }}><div style={{ fontWeight: 600 }} className="ell">{c.position}</div><div className="mut ell" style={{ fontSize: 12 }}>{[c.name || (c.status === 'open' ? 'รอคน' : 'ยังไม่ใส่ชื่อ'), c.phone, c.line_id ? 'LINE ' + c.line_id : ''].filter(Boolean).join(' · ')}</div></div>
                    {(c.scope_file_path || safeUrl(c.scope_url)) && <button className="chip o" style={{ cursor: 'pointer' }} onClick={() => openFile(c.scope_file_path, safeUrl(c.scope_url))}>Workscope ↗</button>}
                    <span className={'chip ' + STATUS[c.status][1]}>{STATUS[c.status][0]}</span>
                    <span className="num" style={{ fontSize: 13, minWidth: 90, textAlign: 'right' }}>{num(c.budget) ? money(c.budget) + (c.rate_type === 'day' ? '/วัน' : '') : '—'}</span>
                    {c.status !== 'open' && c.name && <a className="btn sm" href={lineShare(confirmMsg(p, c))} target="_blank" rel="noopener noreferrer">{c.status === 'pending' ? 'ขอยืนยัน' : 'ส่งยืนยัน'}</a>}
                    <button className="btn sm" onClick={() => { setEdit(c.id); setDraft({ ...c }); }}>แก้ไข</button>
                    <button className="btn sm ghost" onClick={() => setDel(c)} aria-label={'ลบตำแหน่ง ' + c.position}>ลบ</button>
                  </div>
                ))}
            </details>
          );
        })}
      </section>
      {del && <Modal title={'ลบตำแหน่ง ' + del.position + '?'} onClose={() => setDel(null)}>
        <p className="mut" style={{ margin: 0 }}>{del.name ? del.name + ' จะถูกนำออกจากโปรเจกต์นี้' : 'ตำแหน่งนี้จะถูกนำออกจากโปรเจกต์'}</p>
        <div className="row"><button className="btn k" onClick={async () => { const c = del; setDel(null); if (edit === c.id) setEdit(null); act(() => sb().from('crew_positions').delete().eq('id', c.id), 'ลบตำแหน่งแล้ว'); }}>ลบตำแหน่ง</button><button className="btn" onClick={() => setDel(null)}>ยกเลิก</button></div>
      </Modal>}
      {oc && <Modal title="ประกาศหาตำแหน่งเพิ่ม" onClose={() => setOc(false)}>
        <div className="row w" style={{ gap: 6 }}>{open.map(c => <span key={c.id} className="chip k">{c.position}</span>)}</div>
        <div className="cap">ตัวอย่างประกาศ (สร้างจากรายละเอียดโปรเจกต์และตำแหน่งว่างอัตโนมัติ)</div>
        <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, border: '1px solid var(--line)', borderRadius: 10, padding: 12, background: '#FAFAFC', maxHeight: 260, overflow: 'auto' }}>{ocMessage(data)}</div>
        <button className="btn k" onClick={queueAnnouncement}>ประกาศผ่าน HOOSE Official LINE OA</button>
        <p className="mut" style={{ fontSize: 12, margin: 0 }}>ระบบจะส่งประกาศผ่าน LINE OA ของ Hooseofficial อัตโนมัติเมื่อเชื่อม API แล้ว ตอนนี้ประกาศจะเข้าคิวรอไว้</p>
      </Modal>}
    </div>
  );
}
