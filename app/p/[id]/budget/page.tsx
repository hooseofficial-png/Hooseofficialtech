'use client';
import { useEffect, useState } from 'react';
import { useProject } from '@/components/ProjectProvider';
import { sb } from '@/lib/supabase/client';
import { budgetAllocated, crewAllCost, crewLine, money, num, suggestion, type ProjectData } from '@/lib/domain';
import { toast, errText } from '@/lib/ui';

/** Input that keeps its own text while typing and saves on blur / Enter. */
function Cell({ value, onSave, numeric, ...rest }: { value: string | number; onSave: (v: string) => void; numeric?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  const [v, setV] = useState(String(value ?? ''));
  useEffect(() => { setV(String(value ?? '')); }, [value]);
  return <input {...rest} className={'in-t' + (numeric ? ' num' : '')} inputMode={numeric ? 'numeric' : undefined} value={v}
    onChange={e => setV(e.target.value)} onBlur={() => { if (v !== String(value ?? '')) onSave(v); }} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />;
}

const allDraft = (d: ProjectData) => !!d.budget?.drafted && !!d.budget?.crew_alloc_draft && (d.lines || []).filter(l => l.key).every(l => l.draft);

export default function BudgetPage() {
  const { id, data, act, reload } = useProject();
  const [name, setName] = useState(''); const [amt, setAmt] = useState('');
  if (!data) return null;
  const B = data.budget!; const lines = data.lines || [];
  const T = num(B.total); const cl = crewLine(data); const al = budgetAllocated(data); const sg = suggestion(data);
  const pc = (v: number) => (T ? ((v / T) * 100).toFixed(1) + '%' : '—');

  async function applySuggestion(total: number, quietMsg?: string) {
    const d2 = { ...data!, budget: { ...B, total } }; const s = suggestion(d2);
    const s1 = await sb().from('budgets').update({ total, crew_alloc: s[0].amount, crew_alloc_draft: true, drafted: true }).eq('project_id', id);
    if (s1.error) { toast(errText(s1.error)); return; }
    await sb().from('budget_lines').delete().eq('project_id', id).not('key', 'is', null);
    const keep = lines.filter(l => !l.key).length;
    await sb().from('budget_lines').insert(s.slice(1).map((x, i) => ({ project_id: id, key: x.key, name: x.name, amount: x.amount, draft: true, sort: i })));
    if (keep) { /* manual lines stay after the suggested ones */ }
    toast(quietMsg || 'ใช้สัดส่วนที่แนะนำแล้ว'); reload();
  }
  async function setTotal(v: string) {
    const total = Math.round(num(v));
    const fresh = !B.drafted && !lines.length && !num(B.crew_alloc);
    if (total && (fresh || allDraft(data!))) { applySuggestion(total, fresh ? 'ร่างการแบ่งงบตามสัดส่วนแนะนำแล้ว แก้ตัวเลขได้' : 'ปรับร่างงบตามงบรวมใหม่แล้ว'); return; }
    act(() => sb().from('budgets').update({ total }).eq('project_id', id));
  }
  const colors = ['var(--blue)', 'var(--ink)', 'var(--blue-2)', 'var(--ink-2)', 'var(--blue-3)', 'var(--mut)', '#C9C6FF', 'var(--line)'];
  return (
    <div className="grid">
      <section className="card c12"><h2>งบประมาณ</h2>
        <div className="fg">
          <label className="f" htmlFor="b-total">งบรวมที่ได้รับ (บาท)<Cell id="b-total" numeric value={T || ''} placeholder="เช่น 1500000" onSave={setTotal} /></label>
          <label className="f" htmlFor="b-crew">งบทีมงาน (บาท) · เว้นว่าง = รวมจากบอร์ดทีมงาน<Cell id="b-crew" numeric value={num(B.crew_alloc) || ''} placeholder={String(Math.round(crewAllCost(data)))} onSave={v => act(() => sb().from('budgets').update({ crew_alloc: Math.round(num(v)), crew_alloc_draft: false }).eq('project_id', id))} /></label>
        </div>
        {T ? <>
          <div className="row w" style={{ gap: 24 }}>
            <div><div className="cap">จัดสรรแล้ว</div><b className="num" style={{ font: '600 22px var(--f-display)' }}>{pc(al)}</b></div>
            <div><div className="cap">{al > T ? 'เกินงบ' : 'คงเหลือ'}</div><b className="num" style={{ font: '600 22px var(--f-display)' }}>{money(Math.abs(T - al))} · {pc(Math.abs(T - al))}</b></div>
          </div>
          <div className="bar"><i style={{ width: Math.min(100, al / T * 100) + '%', background: al > T ? 'var(--ink)' : undefined }} /></div>
        </> : <div className="mut">ใส่งบรวมที่ได้รับ ระบบจะร่างการแบ่งงบตามสัดส่วนที่เหมาะกับประเภทงานให้อัตโนมัติ</div>}
      </section>
      {T > 0 && <section className="card c12">
        <div className="between"><div><h2>สัดส่วนที่แนะนำ</h2><div className="mut" style={{ fontSize: 12 }}>ตามประเภทงาน: {data.project.type || 'TVC / โฆษณา (ค่าเริ่มต้น)'} · ปรับตัวเลขในรายการงบด้านล่างได้</div></div>
          <button className="btn sm p" onClick={() => applySuggestion(T)}>ใช้สัดส่วนที่แนะนำ</button></div>
        <div style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', gap: 2 }}>{sg.map((x, i) => <i key={x.key} title={x.name + ' ' + x.pct + '%'} style={{ flex: x.pct, background: colors[i] }} />)}</div>
        <div className="tblw"><table className="tbl"><thead><tr><th>หมวด</th><th style={{ textAlign: 'right' }}>แนะนำ</th><th style={{ textAlign: 'right' }}>จำนวนเงินแนะนำ</th><th style={{ textAlign: 'right' }}>ตั้งไว้ตอนนี้</th></tr></thead><tbody>
          {sg.map((x, i) => { const cur = i === 0 ? cl : lines.filter(l => l.key === x.key).reduce((a, l) => a + num(l.amount), 0); return (
            <tr key={x.key}><td>{x.name}</td><td className="num" style={{ textAlign: 'right' }}>{x.pct}%</td><td className="num" style={{ textAlign: 'right' }}>{money(x.amount)}</td>
              <td className="num" style={{ textAlign: 'right', color: Math.abs(cur - x.amount) < 1 ? 'var(--blue)' : 'var(--ink-2)' }}>{money(cur)} · {pc(cur)}</td></tr>); })}
        </tbody></table></div>
      </section>}
      <section className="card c12"><h2>รายการงบ</h2>
        <div className="tblw"><table className="tbl"><thead><tr><th>รายการ</th><th style={{ textAlign: 'right' }}>จำนวนเงิน</th><th style={{ textAlign: 'right' }}>% ของงบรวม</th><th style={{ width: '26%' }} /><th /></tr></thead><tbody>
          <tr><td><b>งบทีมงาน</b><div className="mut" style={{ fontSize: 12 }}>{num(B.crew_alloc) ? (B.crew_alloc_draft ? 'ร่างอัตโนมัติ · แก้ได้ด้านบน' : 'กำหนดเอง') : 'อัตโนมัติ · ตามบอร์ดทีมงาน'}</div></td>
            <td className="num" style={{ textAlign: 'right' }}>{money(cl)}</td><td className="num" style={{ textAlign: 'right' }}>{pc(cl)}</td>
            <td><div className="bar" style={{ height: 6 }}><i style={{ width: (T ? Math.min(100, cl / T * 100) : 0) + '%' }} /></div></td><td /></tr>
          {lines.map(l => (
            <tr key={l.id}>
              <td><Cell style={{ height: 34 }} value={l.name} aria-label="ชื่อรายการ" onSave={v => act(() => sb().from('budget_lines').update({ name: v, draft: false }).eq('id', l.id))} />{l.draft && <span className="chip lb" style={{ height: 18, fontSize: 10, marginTop: 4 }}>ร่างอัตโนมัติ</span>}</td>
              <td style={{ textAlign: 'right' }}><Cell numeric style={{ height: 34, textAlign: 'right', maxWidth: 140 }} value={num(l.amount) || ''} aria-label="จำนวนเงิน" onSave={v => act(() => sb().from('budget_lines').update({ amount: Math.round(num(v)), draft: false }).eq('id', l.id))} /></td>
              <td className="num" style={{ textAlign: 'right' }}>{pc(num(l.amount))}</td>
              <td><div className="bar" style={{ height: 6 }}><i style={{ width: (T ? Math.min(100, num(l.amount) / T * 100) : 0) + '%', background: 'var(--blue-2)' }} /></div></td>
              <td><button className="btn sm ghost" onClick={() => act(() => sb().from('budget_lines').delete().eq('id', l.id))} aria-label="ลบรายการ">✕</button></td>
            </tr>))}
        </tbody></table></div>
        <form className="row" onSubmit={e => { e.preventDefault(); if (!name.trim()) { toast('ใส่ชื่อรายการก่อน'); return; } act(() => sb().from('budget_lines').insert({ project_id: id, name: name.trim(), amount: Math.round(num(amt)), sort: lines.length + 10 })); setName(''); setAmt(''); }}>
          <input className="in-t" value={name} onChange={e => setName(e.target.value)} placeholder="เช่น ค่าเช่ากล้อง, ค่าสถานที่" aria-label="รายการใหม่" />
          <input className="in-t num" value={amt} onChange={e => setAmt(e.target.value)} inputMode="numeric" placeholder="฿" aria-label="จำนวนเงิน" style={{ maxWidth: 140 }} />
          <button className="btn">เพิ่ม</button>
        </form>
      </section>
    </div>
  );
}
