'use client';
import { useState } from 'react';
import {
  DEPTS, STATUS, budgetAllocated, crewCost, crewLine, dateRange, daysTo, docOk, evKey, firstShoot, hm, ini, money, num,
  readiness, readyPct, safeUrl, type DocFile, type ProjectData
} from '@/lib/domain';
import { downloadSummaryPdf } from '@/lib/pdf';
import { toast } from '@/lib/ui';
import EventRow from './EventRow';

/** The สรุปผล page: every section on one page + a single A4 PDF. Used by members and by the public share link. */
export default function Summary({ data, logoUrl, open, author }: {
  data: ProjectData; logoUrl: string; author: string;
  open: (path: string | null, url?: string | null) => void;
}) {
  const [busy, setBusy] = useState('');
  const p = data.project; const cr = data.crew; const m = data.withMoney;
  const n = daysTo(firstShoot(data)); const rp = readyPct(data);
  const ev = data.events.slice().sort((a, b) => evKey(a).localeCompare(evKey(b)));
  const T = num(data.budget?.total); const al = budgetAllocated(data); const cl = crewLine(data);
  const pc = (v: number) => (T ? ((v / T) * 100).toFixed(1) + '%' : '—');
  const Kpi = ({ v, l }: { v: string | number; l: string }) => (
    <div style={{ background: 'var(--soft)', borderRadius: 12, padding: 12, minWidth: 0 }}><b className="num" style={{ font: '600 26px/1.1 var(--f-display)', color: 'var(--blue)', display: 'block' }}>{v}</b><span className="mut" style={{ fontSize: 12 }}>{l}</span></div>
  );
  const Link = ({ f, children }: { f: Pick<DocFile, 'storage_path' | 'url'>; children: React.ReactNode }) => (
    <button type="button" className="link-btn ell" style={{ color: 'inherit', textAlign: 'left', fontSize: 12, fontWeight: 500 }} onClick={() => open(f.storage_path, safeUrl(f.url))}>{children} ↗</button>
  );
  async function pdf() {
    setBusy('กำลังเตรียม PDF…');
    try { await downloadSummaryPdf(data, author, setBusy); toast('ดาวน์โหลด PDF แล้ว'); }
    catch { toast('สร้าง PDF ไม่สำเร็จ ลองอีกครั้ง'); }
    setBusy('');
  }
  return (
    <>
      <div className="between">
        <div><span className="cap">สรุปผล · Project summary</span><h1>{p.name || 'โปรเจกต์ไม่มีชื่อ'}</h1></div>
        <button className="btn p" onClick={pdf} disabled={!!busy}>ดาวน์โหลด PDF A4</button>
      </div>
      <div className="grid">
        <section className="card hero c12" style={{ minHeight: 0, paddingBottom: 18 }}>
          <div className="row">
            <span className="logo-box">{logoUrl ? <img alt="" src={logoUrl} /> : <b style={{ color: 'var(--blue)', font: '700 16px var(--f-display)' }}>{ini(p.brand || p.name)}</b>}</span>
            <div className="grow"><div style={{ opacity: .85, fontSize: 13 }}>{[p.brand, p.agency, p.company].filter(Boolean).join(' · ') || 'ยังไม่ระบุลูกค้า'}</div><h1 className="ell">{p.name || 'โปรเจกต์ไม่มีชื่อ'}</h1></div>
          </div>
          <div style={{ fontSize: 14 }}>{[p.type, dateRange(p), p.queues ? p.queues + ' คิว' : '', p.call_time ? 'คอล ' + hm(p.call_time) : ''].filter(Boolean).join(' · ') || '—'}</div>
          <div style={{ fontSize: 13, opacity: .85 }}>{[p.director ? 'ผกก. ' + p.director : '', p.producer ? 'โปรดิวเซอร์ ' + p.producer : '', p.pm_name ? 'PM ' + p.pm_name + (p.pm_phone ? ' ' + p.pm_phone : '') : ''].filter(Boolean).join(' · ')}</div>
          {p.locations.length > 0 && <div style={{ fontSize: 13 }}>สถานที่: {p.locations.join(' · ')}</div>}
          {p.synopsis && <div style={{ fontSize: 13, opacity: .9, maxWidth: '70ch' }}>{p.synopsis}</div>}
        </section>
        <section className="card c12"><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
          <Kpi v={n == null ? '–' : Math.max(0, n)} l={n == null ? 'ยังไม่ตั้งวันถ่าย' : 'วันก่อนวันถ่ายวันแรก'} />
          <Kpi v={rp + '%'} l="ความพร้อมพรีโปรดักชัน" />
          <Kpi v={cr.filter(c => c.status === 'confirmed').length + '/' + cr.length} l="ทีมงานยืนยัน" />
          <Kpi v={data.docs.filter(docOk).length + '/' + data.docs.length} l="หมวดเอกสารมีไฟล์" />
          {m && <Kpi v={T ? pc(al) : '–'} l="งบที่จัดสรรแล้ว" />}
        </div></section>
        <section className="card c6"><h2>ความพร้อมพรีโปรดักชัน</h2><div className="list">
          {readiness(data).map(([, l, r, v]) => <div className="li" key={l}><span className={'chk' + (r >= 1 ? ' on' : '')}>{r >= 1 ? '✓' : ''}</span><span className="grow">{l}</span><span className="num mut" style={{ fontSize: 12, fontWeight: 600 }}>{v}</span></div>)}
        </div></section>
        <section className="card c6"><h2>ตารางนัดหมาย</h2>{ev.length ? <div className="list">{ev.map(e => <EventRow key={e.id} p={p} e={e} />)}</div> : <div className="mut">ยังไม่มีนัดหมาย</div>}</section>
        <section className="card c12"><h2>ทีมงาน</h2>
          {cr.length ? <div className="tblw"><table className="tbl"><thead><tr><th>ฝ่าย</th><th>ตำแหน่ง</th><th>ชื่อ</th><th>ติดต่อ</th><th>สถานะ</th>{m && <th style={{ textAlign: 'right' }}>งบ</th>}<th>Workscope</th></tr></thead><tbody>
            {DEPTS.flatMap(([dk, dn]) => cr.filter(c => (c.dept || 'other') === dk).map(c => (
              <tr key={c.id}><td>{dn}</td><td><b>{c.position}</b></td><td>{c.name || (c.status === 'open' ? 'รอคน' : '—')}</td>
                <td className="mut">{[c.phone, c.line_id ? 'LINE ' + c.line_id : ''].filter(Boolean).join(' · ') || '—'}</td>
                <td><span className={'chip ' + STATUS[c.status][1]}>{STATUS[c.status][0]}</span></td>
                {m && <td className="num" style={{ textAlign: 'right' }}>{money(crewCost(c))}</td>}
                <td>{(c.scope_file_path || safeUrl(c.scope_url)) ? <Link f={{ storage_path: c.scope_file_path, url: c.scope_url }}>{c.scope_file_name || 'เปิด'}</Link> : <span className="mut">{c.scope || '—'}</span>}</td></tr>
            )))}
          </tbody></table></div> : <div className="mut">ยังไม่มีตำแหน่ง</div>}
        </section>
        <section className="card c12"><h2>เอกสาร</h2><div className="docs">
          {data.docs.map(c => <div key={c.id} className={'doc' + (c.files.length ? ' on' : '')} style={{ minHeight: 0 }}><b>{c.title}</b>
            {c.files.length ? c.files.map(f => <Link key={f.id} f={f}>{f.name || f.url}</Link>) : <span className="mut" style={{ fontSize: 12 }}>ยังไม่มีไฟล์</span>}</div>)}
        </div></section>
        {m && <section className="card c12"><h2>งบประมาณ</h2>{T ? <div className="tblw"><table className="tbl"><thead><tr><th>รายการ</th><th style={{ textAlign: 'right' }}>จำนวนเงิน</th><th style={{ textAlign: 'right' }}>% ของงบรวม</th></tr></thead><tbody>
          <tr><td>งบทีมงาน</td><td className="num" style={{ textAlign: 'right' }}>{money(cl)}</td><td className="num" style={{ textAlign: 'right' }}>{pc(cl)}</td></tr>
          {(data.lines || []).map(l => <tr key={l.id}><td>{l.name || '—'}</td><td className="num" style={{ textAlign: 'right' }}>{money(l.amount)}</td><td className="num" style={{ textAlign: 'right' }}>{pc(num(l.amount))}</td></tr>)}
          <tr><td><b>รวมที่จัดสรร</b></td><td className="num" style={{ textAlign: 'right' }}><b>{money(al)}</b></td><td className="num" style={{ textAlign: 'right' }}><b>{pc(al)}</b></td></tr>
          <tr><td><b>{al > T ? 'เกินงบ' : 'คงเหลือ'}</b></td><td className="num" style={{ textAlign: 'right' }}><b>{money(Math.abs(T - al))}</b></td><td className="num" style={{ textAlign: 'right' }}>{pc(Math.abs(T - al))}</td></tr>
        </tbody></table></div> : <div className="mut">ยังไม่ตั้งงบรวม</div>}</section>}
      </div>
      {busy && <div className="pp-cover">{busy}</div>}
    </>
  );
}
