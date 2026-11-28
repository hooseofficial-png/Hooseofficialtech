'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import TopBar from '@/components/TopBar';

// HOOSE super dashboard frame: one nav for every admin page.
const NAV = [
  ['/admin', 'ภาพรวม'],
  ['/admin/editing', 'ตัดต่อ'],
  ['/admin/production', 'โปรดักชัน'],
  ['/admin/line', 'รับสมัคร'],
  ['/admin/analytics', 'วิเคราะห์']
] as const;

export default function AdminShell({ title, sub, denied, children }: { title: string; sub?: React.ReactNode; denied?: boolean; children: React.ReactNode }) {
  const path = usePathname();
  return (
    <><TopBar label="HOOSE · Super Dashboard" />
      <main className="wrap dash">
        <nav className="seg" style={{ alignSelf: 'flex-start', overflowX: 'auto', maxWidth: '100%' }} aria-label="แดชบอร์ด">
          {NAV.map(([href, label]) => {
            const on = href === '/admin' ? path === '/admin' : path?.startsWith(href);
            return <Link key={href} href={href} className={on ? 'on' : ''} style={{ padding: '8px 14px', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', background: on ? 'var(--blue)' : undefined, color: on ? '#fff' : 'var(--ink-2)' }}>{label}</Link>;
          })}
        </nav>
        <div className="between"><h1 style={{ margin: 0 }}>{title}</h1>{sub}</div>
        {denied ? <div className="empty">หน้านี้สำหรับแอดมิน HOOSE เท่านั้น</div> : children}
      </main>
    </>
  );
}

/** Number tile used across dashboard pages. */
export function Tile({ label, value, sub, hot, onClick, href }: { label: string; value: React.ReactNode; sub?: string; hot?: boolean; onClick?: () => void; href?: string }) {
  const body = <>
    <span className="mut" style={{ fontSize: 12 }}>{label}</span>
    <b style={{ fontSize: 26, color: hot ? 'var(--blue)' : 'var(--ink)' }}>{value}</b>
    {sub && <span className="mut" style={{ fontSize: 12 }}>{sub}</span>}
  </>;
  const style: React.CSSProperties = { padding: 14, gap: 4, textAlign: 'left', borderColor: hot ? 'var(--blue)' : undefined, cursor: onClick || href ? 'pointer' : 'default', color: 'inherit' };
  if (href) return <Link href={href} className="card" style={style}>{body}</Link>;
  return <button className="card" style={style} onClick={onClick} disabled={!onClick}>{body}</button>;
}

export const Grid = ({ min = 150, children }: { min?: number; children: React.ReactNode }) =>
  <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 10 }}>{children}</div>;

/** Simple vertical bars (HOOSE blue). Values with label; optional second series in light blue. */
export function Bars({ data, height = 140 }: { data: { label: string; a: number; b?: number }[]; height?: number }) {
  const max = Math.max(1, ...data.map(d => Math.max(d.a, d.b || 0)));
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${data.length}, 1fr)`, gap: 6, alignItems: 'end', height }}>
        {data.map(d => (
          <div key={d.label} title={`${d.label}: ${d.a}${d.b !== undefined ? ' / ' + d.b : ''}`} style={{ display: 'flex', gap: 2, alignItems: 'flex-end', justifyContent: 'center', height: '100%' }}>
            {d.b !== undefined && <div style={{ width: '40%', height: `${d.b / max * 100}%`, minHeight: 2, background: 'var(--blue-bg)', borderRadius: '4px 4px 0 0' }} />}
            <div style={{ width: d.b !== undefined ? '40%' : '70%', height: `${d.a / max * 100}%`, minHeight: 2, background: 'var(--blue)', borderRadius: '4px 4px 0 0' }} />
          </div>))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${data.length}, 1fr)`, gap: 6, marginTop: 4 }}>
        {data.map(d => <span key={d.label} className="mut ell" style={{ fontSize: 10, textAlign: 'center' }}>{d.label}</span>)}
      </div>
    </div>
  );
}

/** Horizontal bar list (label · bar · value). */
export function HBars({ rows }: { rows: { label: string; value: number; note?: string }[] }) {
  const max = Math.max(1, ...rows.map(r => r.value));
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    {rows.map(r => (
      <div key={r.label} style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 160px) 1fr auto', gap: 10, alignItems: 'center', fontSize: 13 }}>
        <span className="ell">{r.label}</span>
        <div style={{ background: 'var(--soft)', borderRadius: 6, height: 10 }}><div style={{ width: `${r.value / max * 100}%`, background: 'var(--blue)', height: '100%', borderRadius: 6 }} /></div>
        <b>{r.value}{r.note ? <span className="mut" style={{ fontWeight: 400 }}> {r.note}</span> : null}</b>
      </div>))}
  </div>;
}
