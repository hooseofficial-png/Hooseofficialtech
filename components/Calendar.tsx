'use client';
import { useRef, useState } from 'react';
import { D, DOW, ET, iso, pad, todayISO, type HEvent } from '@/lib/domain';

export function MonthNav({ month, setMonth }: { month: string; setMonth: (m: string) => void }) {
  const d = D(month + '-01');
  const go = (n: number) => { const x = D(month + '-01'); x.setMonth(x.getMonth() + n); setMonth(iso(x).slice(0, 7)); };
  return <div className="row"><button className="btn sm" onClick={() => go(-1)} aria-label="เดือนก่อนหน้า">‹</button><b style={{ minWidth: 120, textAlign: 'center' }}>{d.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}</b><button className="btn sm" onClick={() => go(1)} aria-label="เดือนถัดไป">›</button></div>;
}
export function Legend() {
  return <div className="row w" style={{ fontSize: 12, color: 'var(--mut)' }}>{(Object.keys(ET) as (keyof typeof ET)[]).map(k => <span key={k} className="row" style={{ gap: 5 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: ET[k][1] }} />{k === 'shoot' ? '🎥 ' + ET[k][0] + ' (Production Day)' : ET[k][0]}</span>)}</div>;
}
type Item = { e: HEvent; label: string; title: string };

/**
 * Month grid. With `onMove`, appointments can be dragged to another day (mouse or touch), like Google Calendar.
 * Dropping on the "ยังไม่ระบุวัน" tray clears the date (TBD); dragging a TBD chip onto a day schedules it.
 */
export function MonthGrid({ month, items, onMove, tbd }: { month: string; items: Item[]; onMove?: (id: string, date: string | null) => void; tbd?: Item[] }) {
  const first = D(month + '-01'); const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate(); const t = todayISO();
  const [drag, setDrag] = useState<{ id: string; label: string; color: string; x: number; y: number; from: string | null; over: string | null | undefined } | null>(null);
  const start = useRef<{ id: string; x: number; y: number; it: Item; moved: boolean } | null>(null);

  const targetAt = (x: number, y: number): string | null | undefined => {
    const el = document.elementFromPoint(x, y)?.closest('[data-drop]') as HTMLElement | null;
    return el ? (el.dataset.drop || null) : undefined; // undefined = not over a drop zone
  };
  const down = (it: Item) => (e: React.PointerEvent) => {
    if (!onMove || e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    start.current = { id: it.e.id, x: e.clientX, y: e.clientY, it, moved: false };
  };
  const move = (e: React.PointerEvent) => {
    const s0 = start.current; if (!s0) return;
    if (!s0.moved && Math.hypot(e.clientX - s0.x, e.clientY - s0.y) < 6) return;
    s0.moved = true;
    setDrag({ id: s0.id, label: s0.it.label, color: ET[s0.it.e.type][1], x: e.clientX, y: e.clientY, from: s0.it.e.date || null, over: targetAt(e.clientX, e.clientY) });
  };
  const up = (e: React.PointerEvent) => {
    const s0 = start.current; start.current = null;
    if (!s0 || !s0.moved) { setDrag(null); return; }
    const to = targetAt(e.clientX, e.clientY); setDrag(null);
    if (to !== undefined && to !== (s0.it.e.date || null)) onMove!(s0.id, to);
  };
  const chip = (x: Item, cls = 'ev') => (
    <div key={x.e.id} className={cls + (onMove ? ' dragg' : '') + (drag?.id === x.e.id ? ' ghosting' : '')} style={{ background: ET[x.e.type][1] }} title={x.title + (onMove ? ' · ลากเพื่อย้ายวัน' : '')}
      onPointerDown={down(x)} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { start.current = null; setDrag(null); }}>{x.label}</div>
  );

  return (
    <>
      {onMove && tbd && (tbd.length > 0 || drag) && (
        <div data-drop="" className={'tbd-tray' + (drag && drag.over === null ? ' over' : '')}>
          <span className="cap">ยังไม่ระบุวัน</span>
          {tbd.map(x => chip({ ...x, label: x.title || x.label }, 'ev tbd-chip'))}
          {!tbd.length && <span className="mut" style={{ fontSize: 12 }}>วางตรงนี้เพื่อเปลี่ยนเป็น “ยังไม่ระบุวัน”</span>}
          {tbd.length > 0 && <span className="mut" style={{ fontSize: 11 }}>ลากไปวางบนวันที่เพื่อนัด</span>}
        </div>
      )}
      <div className={'cal' + (drag ? ' dragging' : '')}>
        {DOW.map(d => <div key={d} className="h">{d}</div>)}
        {Array.from({ length: first.getDay() }, (_, i) => <div key={'x' + i} className="d x" />)}
        {Array.from({ length: days }, (_, i) => {
          const ds = month + '-' + pad(i + 1); const its = items.filter(x => x.e.date === ds);
          const shoot = its.some(x => x.e.type === 'shoot');
          return <div key={ds} data-drop={onMove ? ds : undefined} className={'d' + (ds === t ? ' t' : '') + (shoot ? ' shoot' : '') + (drag && drag.over === ds ? ' over' : '')} title={shoot ? 'Production Day · วันถ่ายทำ' : undefined}>
            <span className="dn">{i + 1}{shoot && <em className="cam" aria-label="วันถ่ายทำ">🎥</em>}</span>
            {its.slice(0, 3).map(x => chip(x))}
            {its.length > 3 && <span>+{its.length - 3}</span>}</div>;
        })}
      </div>
      {drag && <div className="drag-ghost" style={{ left: drag.x, top: drag.y, background: drag.color }}>{drag.label}</div>}
    </>
  );
}
