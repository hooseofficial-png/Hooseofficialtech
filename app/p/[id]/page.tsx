'use client';
import Link from 'next/link';
import { useProject } from '@/components/ProjectProvider';
import EventRow from '@/components/EventRow';
import { budgetAllocated, dateRange, daysTo, docOk, evKey, firstShoot, ini, money, num, readiness, readyPct, todayISO } from '@/lib/domain';
import ProjectTitle from '@/components/ProjectTitle';

export default function Dashboard() {
  const { id, data, signed } = useProject();
  if (!data) return null;
  const p = data.project; const cr = data.crew; const n = daysTo(firstShoot(data));
  const dn = data.docs.filter(docOk).length; const rp = readyPct(data);
  const cnt = (k: string) => cr.filter(c => c.status === k).length;
  const up = data.events.filter(e => e.date && e.date >= todayISO()).sort((a, b) => evKey(a).localeCompare(evKey(b))).slice(0, 5);
  const tbd = data.events.filter(e => !e.date).length;
  const T = num(data.budget?.total); const al = budgetAllocated(data);
  const href = (k: string) => `/p/${id}${k === 'share' ? '/summary' : '/' + k}`;
  const logo = signed(p.logo_path);
  return (
    <div className="grid">
      <section className="card hero c8">
        <div className="row"><span className="logo-box">{logo ? <img alt="" src={logo} /> : <b style={{ color: 'var(--blue)', font: '700 16px var(--f-display)' }}>{ini(p.brand || p.name)}</b>}</span>
          <div className="grow"><div style={{ opacity: .85, fontSize: 13 }}>{[p.brand, p.agency].filter(Boolean).join(' · ') || 'ยังไม่ระบุลูกค้า'}</div><ProjectTitle hero /></div></div>
        <div style={{ fontSize: 14 }}>{[dateRange(p), p.queues ? p.queues + ' คิว' : '', p.locations[0]].filter(Boolean).join(' · ') || 'กรอกรายละเอียดเพื่อเริ่ม'}</div>
        <div style={{ fontSize: 13, opacity: .85 }}>{[p.director ? 'ผกก. ' + p.director : '', p.producer ? 'โปรดิวเซอร์ ' + p.producer : ''].filter(Boolean).join(' · ')}</div>
        <Link href={`/p/${id}/docs`} style={{ color: '#fff', textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 340 }}>
          <span className="between" style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.05em' }}><span>เอกสาร</span><span className="num">{dn}/{data.docs.length} หมวดมีไฟล์</span></span>
          <span className="bar" style={{ height: 6 }}><i style={{ width: (data.docs.length ? dn / data.docs.length * 100 : 0) + '%' }} /></span>
        </Link>
        <div className="big"><b className="num">{n == null ? '–' : n < 0 ? '✓' : n}</b><span style={{ fontSize: 12, opacity: .85 }}>{n == null ? 'ยังไม่ตั้งวันถ่าย' : n < 0 ? 'ถ่ายไปแล้ว' : n === 0 ? 'วันนี้ถ่าย' : 'วันก่อนวันถ่ายวันแรก'}</span></div>
      </section>
      <section className="card c4"><h2>ทีมงาน</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
          {([['ยืนยัน', cnt('confirmed'), 'b'], ['รอยืนยัน', cnt('pending'), 'lb'], ['Open Call', cnt('open'), 'k']] as const).map(([l, v, c]) =>
            <div key={l} style={{ background: 'var(--soft)', borderRadius: 12, padding: 10 }}><b className="num" style={{ font: '600 24px var(--f-display)' }}>{v}</b><div><span className={'chip ' + c} style={{ height: 20, fontSize: 11 }}>{l}</span></div></div>)}
        </div>
        <div className="row w" style={{ gap: 6 }}>
          {cr.filter(c => c.status !== 'open').slice(0, 9).map(c => <span key={c.id} className={'av' + (c.status === 'pending' ? ' g' : '')} title={c.position + ' · ' + c.name}>{ini(c.name)}</span>)}
          {cr.filter(c => c.status === 'open').slice(0, 5).map(c => <span key={c.id} className="av o" title={c.position}>?</span>)}
        </div>
        <Link className="btn sm" href={`/p/${id}/crew`}>จัดการทีมงาน</Link>
      </section>
      <section className="card c12">
        <div className="between"><h2>ความพร้อมพรีโปรดักชัน</h2><b className="num" style={{ font: '700 28px/1 var(--f-display)', color: 'var(--blue)' }}>{rp}%</b></div>
        <div className="bar"><i style={{ width: rp + '%' }} /></div>
        <div className="rd">{readiness(data).map(([k, l, r, v]) =>
          <Link key={l} href={href(k)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--paper)', textDecoration: 'none', color: 'inherit', minWidth: 0 }}>
            <span className={'chk' + (r >= 1 ? ' on' : '')}>{r >= 1 ? '✓' : ''}</span><span className="grow ell">{l}</span>
            <span className="num" style={{ fontSize: 12, fontWeight: 600, color: r >= 1 ? 'var(--blue)' : 'var(--mut)' }}>{v}</span>
          </Link>)}</div>
      </section>
      <section className="card c6"><div className="between"><h2>นัดหมายที่จะถึง</h2><Link className="btn sm" href={`/p/${id}/calendar`}>ปฏิทินทีม</Link></div>
        {up.length ? <div className="list">{up.map(e => <EventRow key={e.id} p={p} e={e} />)}</div> : <div className="mut">ยังไม่มีนัดหมายที่มีวันแน่นอน</div>}
        {tbd > 0 && <span className="chip o" style={{ alignSelf: 'flex-start' }}>{tbd} นัดยังไม่ระบุวัน</span>}
      </section>
      <section className="card c6"><div className="between"><h2>งบประมาณ</h2><Link className="btn sm" href={`/p/${id}/budget`}>เปิด</Link></div>
        {T ? <>
          <div className="row" style={{ alignItems: 'baseline' }}><b className="num" style={{ font: '600 26px var(--f-display)' }}>{Math.round(al / T * 100)}%</b><span className="mut">จัดสรรแล้ว จาก {money(T)}</span></div>
          <div className="bar"><i style={{ width: Math.min(100, al / T * 100) + '%', background: al > T ? 'var(--ink)' : undefined }} /></div>
          <div className="mut">{al > T ? 'เกินงบรวม ' + money(al - T) : 'คงเหลือ ' + money(T - al)}</div>
        </> : <div className="mut">ยังไม่ตั้งงบรวม</div>}
      </section>
      <section className="card c12"><div className="between"><h2>เอกสาร</h2><Link className="btn sm" href={`/p/${id}/docs`}>คลังเอกสาร</Link></div>
        <div className="row w">{data.docs.map(c => <span key={c.id} className={'chip ' + (docOk(c) ? 'b' : 'o')}>{docOk(c) ? '✓ ' : ''}{c.title}</span>)}</div>
      </section>
    </div>
  );
}
