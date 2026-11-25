'use client';
import { useEffect, useRef, useState } from 'react';
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

/** Drag left/right to set an amount. Live value while dragging; `onCommit` when released. Never exceeds `cap`. */
function Slider({ value, total, cap, color, label, onLive, onCommit }: { value: number; total: number; cap: number; color: string; label: string; onLive: (v: number) => void; onCommit: (v: number) => void }) {
  const step = Math.max(100, Math.round(total / 200 / 100) * 100);
  const pct = total ? Math.min(100, (value / total) * 100) : 0; const capPct = total ? Math.min(100, (cap / total) * 100) : 0;
  const commit = (e: React.SyntheticEvent<HTMLInputElement>) => onCommit(Math.min(cap, Number((e.target as HTMLInputElement).value)));
  return (
    <div className="bslider" style={{ ['--p' as string]: pct + '%', ['--cap' as string]: capPct + '%', ['--c' as string]: color }}>
      <input type="range" min={0} max={total} step={step} value={Math.min(value, total)} aria-label={'ปรับงบ ' + label}
        aria-valuetext={Math.round(value).toLocaleString('th-TH') + ' บาท'}
        onChange={e => onLive(Math.min(cap, Number(e.target.value)))} onPointerUp={commit} onKeyUp={commit} onBlur={commit} />
    </div>
  );
}

const allDraft = (d: ProjectData) => !!d.budget?.drafted && !!d.budget?.crew_alloc_draft && (d.lines || []).filter(l => l.key).every(l => l.draft);

export default function BudgetPage() {
  const { id, data, act, reload } = useProject();
  const [name, setName] = useState(''); const [amt, setAmt] = useState('');
  const [live, setLive] = useState<Record<string, number>>({});
  const saving = useRef<Record<string, number>>({});
  if (!data) return null;
  const B0 = data.budget!;
  // Effective data = saved data + values being dragged right now, so every number on the page updates in real time.
  const dE: ProjectData = { ...data, budget: { ...B0, crew_alloc: live.crew ?? B0.crew_alloc }, lines: (data.lines || []).map(l => (live[l.id] !== undefined ? { ...l, amount: live[l.id] } : l)) };
  const B = dE.budget!; const lines = dE.lines || [];
  const T = num(B.total); const cl = crewLine(dE); const al = budgetAllocated(dE); const sg = suggestion(dE);
  const capFor = (cur: number) => Math.max(cur, T - (al - cur));
  const liveSet = (k: string, v: number) => setLive(x => ({ ...x, [k]: v }));
  async function commit(k: string, v: number) {
    const saved = k === 'crew' ? num(B0.crew_alloc) : num((data!.lines || []).find(l => l.id === k)?.amount);
    if (saving.current[k] === Math.round(v)) return; // pointerup + blur fire together
    if (Math.round(v) === Math.round(saved)) { setLive(x => { const y = { ...x }; delete y[k]; return y; }); return; }
    saving.current[k] = Math.round(v);
    await act(() => k === 'crew' ? sb().from('budgets').update({ crew_alloc: Math.round(v), crew_alloc_draft: false }).eq('project_id', id)
      : sb().from('budget_lines').update({ amount: Math.round(v), draft: false }).eq('id', k));
    delete saving.current[k];
    setLive(x => { const y = { ...x }; delete y[k]; return y; });
  }
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
          <div className="stack" aria-label="สัดส่วนงบตอนนี้">
            <i style={{ flex: cl, background: colors[0] }} title={'งบทีมงาน ' + money(cl)} />
            {lines.map((l, i) => <i key={l.id} style={{ flex: num(l.amount), background: colors[(i + 1) % colors.length] }} title={l.name + ' ' + money(num(l.amount))} />)}
            {T > al && <i className="rest" style={{ flex: T - al }} title={'คงเหลือ ' + money(T - al)} />}
          </div>
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
        <div className="tblw"><table className="tbl"><thead><tr><th>รายการ</th><th style={{ textAlign: 'right' }}>จำนวนเงิน</th><th style={{ textAlign: 'right' }}>% ของงบรวม</th><th style={{ width: '30%' }}>{T > 0 ? 'ลากเพื่อปรับ' : ''}</th><th /></tr></thead><tbody>
          <tr><td><b>งบทีมงาน</b><div className="mut" style={{ fontSize: 12 }}>{num(B.crew_alloc) ? (B.crew_alloc_draft ? 'ร่างอัตโนมัติ · แก้ได้ด้านบน' : 'กำหนดเอง') : 'อัตโนมัติ · ตามบอร์ดทีมงาน'}</div></td>
            <td className="num" style={{ textAlign: 'right' }}>{money(cl)}</td><td className="num" style={{ textAlign: 'right' }}>{pc(cl)}</td>
            <td>{T > 0 ? <Slider value={cl} total={T} cap={capFor(cl)} color={colors[0]} label="งบทีมงาน" onLive={v => liveSet('crew', v)} onCommit={v => commit('crew', v)} /> : null}</td><td /></tr>
          {lines.map(l => (
            <tr key={l.id}>
              <td><Cell style={{ height: 34 }} value={l.name} aria-label="ชื่อรายการ" onSave={v => act(() => sb().from('budget_lines').update({ name: v, draft: false }).eq('id', l.id))} />{l.draft && <span className="chip lb" style={{ height: 18, fontSize: 10, marginTop: 4 }}>ร่างอัตโนมัติ</span>}</td>
              <td style={{ textAlign: 'right' }}><Cell numeric style={{ height: 34, textAlign: 'right', maxWidth: 140 }} value={num(l.amount) || ''} aria-label="จำนวนเงิน" onSave={v => act(() => sb().from('budget_lines').update({ amount: Math.round(num(v)), draft: false }).eq('id', l.id))} /></td>
              <td className="num" style={{ textAlign: 'right' }}>{pc(num(l.amount))}</td>
              <td>{T > 0 ? <Slider value={num(l.amount)} total={T} cap={capFor(num(l.amount))} color={colors[(lines.indexOf(l) + 1) % colors.length]} label={l.name} onLive={v => liveSet(l.id, v)} onCommit={v => commit(l.id, v)} /> : null}</td>
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
