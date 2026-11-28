'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import AdminShell, { Grid, Tile } from '@/components/admin/AdminShell';
import OpenCalls from '@/components/admin/OpenCalls';

type Pj = { id: string; owner: string; owner_email: string; name: string; brand: string; type: string; pm_name: string; start_date: string | null; end_date: string | null; party_code: string | null;
  phase: 'pre' | 'shooting' | 'done'; crew: { total: number; open: number; pending: number; confirmed: number }; next: { type: string; date: string; time: string | null; title: string } | null };
const PHASE: Record<string, string> = { pre: 'เตรียมงาน', shooting: 'กำลังถ่าย', done: 'จบแล้ว' };
const d = (s: string | null) => s ? new Date(s + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '–';

/** Production: projects with crew fill and next date, plus Open Calls to the LINE crew. */
export default function Production() {
  const [p, setP] = useState<Pj[] | null>(null); const [denied, setDenied] = useState(false);
  const [tab, setTab] = useState<'projects' | 'opencall'>('projects'); const [phase, setPhase] = useState<'live' | 'all'>('live');
  useEffect(() => { fetch('/api/admin/production').then(async r => { if (r.status === 403 || r.status === 401) { setDenied(true); return; } setP((await r.json()).projects || []); }); }, []);
  const rows = (p || []).filter(x => phase === 'all' || x.phase !== 'done');
  return (
    <AdminShell title="โปรดักชัน" denied={denied}>
      {!p ? <div className="empty">กำลังโหลด…</div> : <>
        <Grid>
          <Tile label="กำลังถ่าย" value={p.filter(x => x.phase === 'shooting').length} />
          <Tile label="เตรียมงาน" value={p.filter(x => x.phase === 'pre').length} />
          <Tile label="ตำแหน่งที่ยังว่าง" value={p.filter(x => x.phase !== 'done').reduce((s, x) => s + x.crew.open, 0)} hot onClick={() => setTab('opencall')} />
          <Tile label="จบแล้ว" value={p.filter(x => x.phase === 'done').length} />
        </Grid>
        <div className="seg" style={{ alignSelf: 'flex-start' }}>
          <button className={tab === 'projects' ? 'on' : ''} onClick={() => setTab('projects')}>โปรเจกต์</button>
          <button className={tab === 'opencall' ? 'on' : ''} onClick={() => setTab('opencall')}>Open Call · ทีมโปรดักชัน</button>
        </div>
        {tab === 'opencall' ? <OpenCalls /> : <>
          <div className="seg" style={{ alignSelf: 'flex-start' }}>
            <button className={phase === 'live' ? 'on' : ''} onClick={() => setPhase('live')}>ยังไม่จบ</button>
            <button className={phase === 'all' ? 'on' : ''} onClick={() => setPhase('all')}>ทั้งหมด</button>
          </div>
          <section className="card" style={{ padding: 0 }}><div className="tblw"><table className="tbl">
            <thead><tr><th>โปรเจกต์</th><th>เจ้าของ</th><th>ช่วง</th><th>วันถ่าย</th><th>ทีมงาน</th><th>ถัดไป</th><th>Party Code</th></tr></thead>
            <tbody>{rows.map(x => {
              const fill = x.crew.total ? Math.round(x.crew.confirmed / x.crew.total * 100) : 0;
              return (
                <tr key={x.id}>
                  <td><Link href={`/p/${x.id}`} style={{ fontWeight: 600, color: 'var(--blue)' }}>{x.name || 'ไม่มีชื่อ'}</Link><div className="mut" style={{ fontSize: 12 }}>{[x.brand, x.type, x.pm_name && 'PM ' + x.pm_name].filter(Boolean).join(' · ')}</div></td>
                  <td style={{ fontSize: 13 }}>{x.owner || <span className="mut">–</span>}{x.owner_email && x.owner !== x.owner_email && <div className="mut" style={{ fontSize: 11 }}>{x.owner_email}</div>}</td>
                  <td><span className={x.phase === 'shooting' ? 'chip b' : x.phase === 'pre' ? 'chip lb' : 'chip o'}>{PHASE[x.phase]}</span></td>
                  <td style={{ whiteSpace: 'nowrap' }}>{d(x.start_date)}{x.end_date && x.end_date !== x.start_date ? ' – ' + d(x.end_date) : ''}</td>
                  <td style={{ minWidth: 120 }}>
                    <div style={{ background: 'var(--soft)', borderRadius: 6, height: 8 }}><div style={{ width: fill + '%', background: 'var(--blue)', height: '100%', borderRadius: 6 }} /></div>
                    <span className="mut" style={{ fontSize: 11 }}>ยืนยัน {x.crew.confirmed}/{x.crew.total}{x.crew.open ? ` · ว่าง ${x.crew.open}` : ''}</span>
                  </td>
                  <td style={{ fontSize: 12 }}>{x.next ? `${d(x.next.date)} · ${x.next.title}` : <span className="mut">–</span>}</td>
                  <td>{x.party_code || <span className="mut">–</span>}</td>
                </tr>);
            })}</tbody>
          </table></div></section>
        </>}
      </>}
    </AdminShell>
  );
}
