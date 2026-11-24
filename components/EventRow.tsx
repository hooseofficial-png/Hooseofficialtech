'use client';
import { D, DOW, ET, evLabel, gcalLink, hm, todayISO, type HEvent, type Project } from '@/lib/domain';

export default function EventRow({ p, e, onEdit, onDelete }: { p: Project; e: HEvent; onEdit?: () => void; onDelete?: () => void }) {
  const tbd = !e.date; const d = tbd ? null : D(e.date!); const past = !tbd && e.date! < todayISO();
  return (
    <div className="li" style={past ? { opacity: .55 } : undefined}>
      <span className={'date ' + e.type} style={tbd ? { background: 'var(--paper)', color: 'var(--ink-2)', border: '1.5px dashed #C9CAD6' } : undefined}>
        <b>{tbd ? '?' : d!.getDate()}</b><span>{tbd ? 'TBD' : d!.toLocaleDateString('th-TH', { month: 'short' })}</span>
      </span>
      <div className="grow">
        <div className="ell" style={{ fontWeight: 600 }}>{evLabel(e)}</div>
        <div className="mut" style={{ fontSize: 12 }}>{[tbd ? 'ยังไม่ระบุวัน' : DOW[d!.getDay()] + '.', hm(e.time) || 'ยังไม่ระบุเวลา', e.kind && e.title ? e.kind : ET[e.type][0], past ? 'ผ่านไปแล้ว' : ''].filter(Boolean).join(' · ')}</div>
      </div>
      {onEdit && <>
        {!tbd && <a className="btn sm" href={gcalLink(p, e)} target="_blank" rel="noopener noreferrer">+ Google</a>}
        <button className="btn sm ghost" onClick={onEdit}>แก้ไข</button>
        <button className="btn sm ghost" onClick={onDelete} aria-label="ลบนัด">ลบ</button>
      </>}
    </div>
  );
}
