'use client';
import { D, DOW, ET, iso, pad, todayISO, type HEvent } from '@/lib/domain';

export function MonthNav({ month, setMonth }: { month: string; setMonth: (m: string) => void }) {
  const d = D(month + '-01');
  const go = (n: number) => { const x = D(month + '-01'); x.setMonth(x.getMonth() + n); setMonth(iso(x).slice(0, 7)); };
  return <div className="row"><button className="btn sm" onClick={() => go(-1)} aria-label="เดือนก่อนหน้า">‹</button><b style={{ minWidth: 120, textAlign: 'center' }}>{d.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}</b><button className="btn sm" onClick={() => go(1)} aria-label="เดือนถัดไป">›</button></div>;
}
export function Legend() {
  return <div className="row w" style={{ fontSize: 12, color: 'var(--mut)' }}>{(Object.keys(ET) as (keyof typeof ET)[]).map(k => <span key={k} className="row" style={{ gap: 5 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: ET[k][1] }} />{ET[k][0]}</span>)}</div>;
}
export function MonthGrid({ month, items }: { month: string; items: { e: HEvent; label: string; title: string }[] }) {
  const first = D(month + '-01'); const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate(); const t = todayISO();
  return (
    <div className="cal">
      {DOW.map(d => <div key={d} className="h">{d}</div>)}
      {Array.from({ length: first.getDay() }, (_, i) => <div key={'x' + i} className="d x" />)}
      {Array.from({ length: days }, (_, i) => {
        const ds = month + '-' + pad(i + 1); const its = items.filter(x => x.e.date === ds);
        return <div key={ds} className={'d' + (ds === t ? ' t' : '')}><span>{i + 1}</span>
          {its.slice(0, 3).map(x => <div key={x.e.id} className="ev" style={{ background: ET[x.e.type][1] }} title={x.title}>{x.label}</div>)}
          {its.length > 3 && <span>+{its.length - 3}</span>}</div>;
      })}
    </div>
  );
}
