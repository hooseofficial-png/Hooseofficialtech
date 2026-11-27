'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fmt } from '@/lib/admin-ui';
import { toast } from '@/lib/ui';

type Resp = { position_id: string; line_user_id: string; answer: string; created_at: string; selected_at: string | null;
  person: { full_name: string; display_name: string; position: string; portfolio_url: string; phone: string; picture_url: string } | null };
type Pos = { id: string; position: string; status: string; scope: string; days: number | null; name: string; matches: number; responses: Resp[] };
type Ann = { id: string; status: string; error: string | null; created_at: string; sent_at: string | null;
  projects: { name: string; brand: string; type: string; start_date: string | null; end_date: string | null; party_code: string | null } | null; positions: Pos[] };

/** Open Calls from PMs: send on LINE, see who raised a hand, pick one → party code + brief go out on LINE. */
export default function OpenCalls() {
  const [data, setData] = useState<{ announcements: Ann[]; teamSize: number } | null>(null);
  const [busy, setBusy] = useState('');
  const load = () => fetch('/api/admin/opencall').then(r => r.json()).then(setData);
  useEffect(() => { load(); }, []);
  async function send(a: Ann, audience: 'match' | 'all') {
    const n = audience === 'all' ? data!.teamSize : a.positions.filter(p => p.status === 'open').reduce((s, p) => s + p.matches, 0);
    if (!confirm(`ส่ง Open Call "${a.projects?.name}" ทาง LINE ถึง ${n} คน?\n(นับโควตา push ${n} ข้อความต่อ 1 ตำแหน่ง)`)) return;
    setBusy(a.id);
    const r = await fetch(`/api/admin/opencall/${a.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ audience }) });
    const j = await r.json().catch(() => ({})); setBusy('');
    toast(!r.ok ? (j.error || 'ส่งไม่สำเร็จ') : `ส่งแล้ว ${j.sent} ข้อความ${j.errors?.length ? ' · บางส่วนไม่สำเร็จ' : ''}`); load();
  }
  async function pick(p: Pos, r: Resp, project: string) {
    const name = r.person?.full_name || r.person?.display_name || 'คนนี้';
    if (!confirm(`เลือก ${name} เป็น ${p.position} · ${project}?\nจะยืนยันในโปรเจกต์ และส่ง Party Code + สรุปโปรเจกต์ทาง LINE ทันที`)) return;
    setBusy(p.id);
    const res = await fetch('/api/admin/opencall/pick', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ position_id: p.id, line_user_id: r.line_user_id }) });
    const j = await res.json().catch(() => ({})); setBusy('');
    toast(!res.ok ? (j.error || 'ไม่สำเร็จ') : j.sendError ? 'ยืนยันแล้ว แต่ส่ง LINE ไม่สำเร็จ' : `ยืนยัน ${name} · ส่ง Party Code แล้ว`); load();
  }
  if (!data) return <div className="empty">กำลังโหลด…</div>;
  if (!data.announcements.length) return <div className="empty">ยังไม่มี Open Call · PM สร้างได้ในแอป หน้าโปรเจกต์ → ทีมงาน → “ประกาศหาทีมงาน”</div>;
  return <>
    <span className="mut" style={{ fontSize: 13 }}>ทีมงานที่ผ่านแล้วและยังติดตาม OA: {data.teamSize} คน</span>
    {data.announcements.map(a => {
      const pj = a.projects;
      return (
        <section key={a.id} className="card" style={{ gap: 12 }}>
          <div className="between" style={{ gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <b className="ell" style={{ display: 'block' }}>{pj?.name || 'โปรเจกต์'}</b>
              <span className="mut" style={{ fontSize: 12 }}>{[pj?.type, pj?.brand].filter(Boolean).join(' · ')} · สร้าง {fmt(a.created_at)}{pj?.party_code ? ' · Party Code ' + pj.party_code : ' · ยังไม่มี Party Code'}</span>
            </div>
            <span className={a.status === 'sent' ? 'chip k' : a.status === 'failed' ? 'chip o' : 'chip b'}>{a.status === 'sent' ? 'ส่งแล้ว ' + fmt(a.sent_at) : a.status === 'failed' ? 'ส่งไม่สำเร็จ' : 'รอส่ง'}</span>
          </div>
          {a.error && <span className="mut" style={{ fontSize: 12 }}>{a.error}</span>}
          <div className="row w" style={{ gap: 8 }}>
            <button className="btn p sm" disabled={!!busy} onClick={() => send(a, 'match')}>ส่งถึงคนตำแหน่งตรง</button>
            <button className="btn sm" disabled={!!busy} onClick={() => send(a, 'all')}>ส่งถึงทีมงานทั้งหมด ({data.teamSize})</button>
          </div>
          {a.positions.map(p => (
            <div key={p.id} style={{ borderTop: '1px solid var(--line)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="between" style={{ gap: 8 }}>
                <b>{p.position}{p.days ? <span className="mut" style={{ fontWeight: 400 }}> · {p.days} วัน</span> : null}</b>
                {p.status === 'confirmed' ? <span className="chip k">ได้คนแล้ว{p.name ? ': ' + p.name : ''}</span> : <span className="chip lb">ตำแหน่งตรง {p.matches} คน</span>}
              </div>
              {p.responses.filter(r => r.answer === 'accept').length === 0
                ? <span className="mut" style={{ fontSize: 13 }}>ยังไม่มีคนกดรับงาน</span>
                : p.responses.filter(r => r.answer === 'accept').map(r => {
                  const nm = r.person?.full_name || r.person?.display_name || 'ไม่ทราบชื่อ';
                  return (
                    <div key={r.line_user_id} className="between" style={{ gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <Link href={`/admin/line/${r.line_user_id}`} style={{ fontWeight: 600, color: 'var(--ink)' }}>{nm}</Link>
                        <span className="mut" style={{ fontSize: 12 }}> · {r.person?.position || '-'} · กดรับ {fmt(r.created_at)}</span>
                        {r.person?.portfolio_url && <a href={r.person.portfolio_url} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)', fontSize: 12, marginLeft: 6 }}>ผลงาน ▶</a>}
                      </div>
                      {r.selected_at ? <span className="chip k">เลือกแล้ว ✓</span>
                        : p.status !== 'confirmed' && <button className="btn p sm" disabled={!!busy} onClick={() => pick(p, r, pj?.name || '')}>✓ เลือก + ส่ง Party Code</button>}
                    </div>);
                })}
              {p.responses.some(r => r.answer === 'decline') && <span className="mut" style={{ fontSize: 12 }}>ไม่สะดวก {p.responses.filter(r => r.answer === 'decline').length} คน</span>}
            </div>
          ))}
        </section>);
    })}
  </>;
}
