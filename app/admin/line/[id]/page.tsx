'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import TopBar from '@/components/TopBar';
import { toast } from '@/lib/ui';
import { NOTIFY, ROLE_TH, STATUS_CHIP, STATUS_TH, SURVEY_Q, fmt } from '@/lib/admin-ui';
import { SURVEY_LABEL } from '@/lib/line-cards';

type U = Record<string, string | boolean | null | object> & { line_user_id: string; status: string; note: string; memory: string; needs_attention: boolean; attention_note: string };
type M = { id: number; role: 'user' | 'assistant'; content: string; created_at: string };
const ACTIONS = ['interview', 'approved', 'rejected', 'active'];

export default function LineApplicant({ params }: { params: { id: string } }) {
  const [u, setU] = useState<U | null>(null); const [msgs, setMsgs] = useState<M[]>([]);
  const [denied, setDenied] = useState(false); const [missing, setMissing] = useState(false);
  const [note, setNote] = useState(''); const [memory, setMemory] = useState('');
  const [pick, setPick] = useState<string | null>(null); const [notify, setNotify] = useState(''); const [send, setSend] = useState(true);
  const [iv, setIv] = useState(''); const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await fetch(`/api/admin/line/${params.id}`);
    if (r.status === 403 || r.status === 401) { setDenied(true); return; }
    if (r.status === 404) { setMissing(true); return; }
    const j = await r.json(); setU(j.user); setMsgs(j.messages); setNote(j.user.note || ''); setMemory(j.user.memory || '');
    setIv(j.user.interview_url || (typeof window !== 'undefined' ? localStorage.getItem('hoose_iv') || '' : ''));
  }
  useEffect(() => { load(); }, [params.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const name = u ? String(u.full_name || u.display_name || '') : '';
  function choose(st: string) { setPick(st); setNotify(NOTIFY[st] ? NOTIFY[st](name, u?.role as string | null) : ''); setSend(true); }

  async function save(body: Record<string, unknown>, ok: string) {
    setBusy(true);
    const r = await fetch(`/api/admin/line/${params.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({})); setBusy(false);
    if (!r.ok) { toast(j.error || 'บันทึกไม่สำเร็จ'); return; }
    toast(j.sendError ? 'เปลี่ยนสถานะแล้ว แต่ส่งข้อความ LINE ไม่สำเร็จ (โควตาหรือผู้ใช้บล็อก)' : ok);
    setPick(null); load();
  }

  if (denied) return <><TopBar label="Admin" /><main className="wrap"><div className="empty">หน้านี้สำหรับแอดมิน HOOSE เท่านั้น</div></main></>;
  if (missing) return <><TopBar label="Admin" /><main className="wrap"><div className="empty">ไม่พบผู้ใช้นี้ · <Link href="/admin/line">กลับ</Link></div></main></>;
  if (!u) return <><TopBar label="Admin" /><main className="wrap"><div className="empty">กำลังโหลด…</div></main></>;

  const field = (label: string, v: unknown, href?: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <span className="mut" style={{ fontSize: 12 }}>{label}</span>
      {v ? (href ? <a href={href} target="_blank" rel="noreferrer" className="ell" style={{ color: 'var(--blue)', fontWeight: 600 }}>{String(v)}</a> : <span className="ell">{String(v)}</span>) : <span className="mut">–</span>}
    </div>);

  return (
    <><TopBar label="Admin · LINE OA" /><main className="wrap" style={{ maxWidth: 880 }}>
      <Link href="/admin/line" className="mut" style={{ fontSize: 13 }}>← ผู้สมัครทั้งหมด</Link>
      <section className="card id-card">
        {u.picture_url ? <img src={String(u.picture_url)} alt="" className="av lg" style={{ objectFit: 'cover' }} /> : <span className="av lg">{(name || '?')[0]}</span>}
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="id-name ell">{name || 'ไม่ทราบชื่อ'}</div>
          <div className="row w" style={{ gap: 8, marginTop: 6 }}>
            <span className={STATUS_CHIP[u.status] || 'chip'}>{STATUS_TH[u.status] || u.status}</span>
            {u.role && <span className="chip o">{ROLE_TH[String(u.role)]}</span>}
            {u.position && <span className="pos-tag">{String(u.position)}</span>}
            {!u.following && <span className="chip o">เลิกติดตาม OA แล้ว</span>}
          </div>
        </div>
      </section>

      {u.needs_attention && (
        <div className="notice" role="status"><span>รอทีมตอบ: {u.attention_note}</span>
          <button className="btn sm" disabled={busy} onClick={() => save({ resolve: true }, 'ปิดเรื่องแล้ว')}>ตอบแล้ว</button></div>
      )}
      <section className="card">
        <h2>ใบสมัคร</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          {field('ชื่อ LINE', u.display_name)}
          {field('เบอร์โทร', u.phone, u.phone ? `tel:${u.phone}` : undefined)}
          {field('อีเมล', u.email, u.email ? `mailto:${u.email}` : undefined)}
          {field('ลิงก์ผลงาน', u.portfolio_url, u.portfolio_url ? String(u.portfolio_url) : undefined)}
          {Object.keys(SURVEY_Q).map(k => { const v = (u.survey as unknown as Record<string, string | string[]>)?.[k]; const l = SURVEY_LABEL[k];
            return <div key={k}>{field('แบบสอบถาม · ' + SURVEY_Q[k], Array.isArray(v) ? v.map(x => l[x] || x).join(', ') : v ? l[v] || v : '')}</div>; })}
          {u.interview_url && field('ลิงก์สัมภาษณ์', u.interview_url, String(u.interview_url))}
          {field('ส่งใบสมัคร', u.applied_at ? fmt(String(u.applied_at)) : '')}
          {field('ยินยอม PDPA', u.consent_at ? fmt(String(u.consent_at)) : '')}
          {field('เพิ่ม OA เมื่อ', fmt(String(u.created_at)))}
          {field('เปลี่ยนสถานะล่าสุด', u.status_changed_at ? fmt(String(u.status_changed_at)) : '')}
        </div>
      </section>

      <section className="card">
        <h2>เปลี่ยนสถานะ</h2>
        <div className="row w" style={{ gap: 8 }}>
          {ACTIONS.map(st => <button key={st} className={'btn sm' + (pick === st ? ' p' : '')} disabled={busy || u.status === st} onClick={() => choose(st)}>{STATUS_TH[st]}</button>)}
          <button className="btn sm ghost" disabled={busy || u.status === 'blocked'} onClick={() => choose('blocked')}>บล็อก</button>
        </div>
        {pick && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {NOTIFY[pick] && <>
              {pick === 'interview' && <label className="f">ลิงก์นัดสัมภาษณ์ (Calendly / Google Calendar / Meet)<input className="in-t" placeholder="https://" value={iv} onChange={e => setIv(e.target.value)} /></label>}
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}><input type="checkbox" checked={send} onChange={e => setSend(e.target.checked)} />ส่งการ์ดแจ้งทาง LINE (นับโควตา push 1 ข้อความ)</label>
              {send && <textarea className="in-t" style={{ height: 96, padding: 10 }} value={notify} onChange={e => setNotify(e.target.value)} />}
            </>}
            <div className="row" style={{ gap: 8 }}>
              <button className="btn p sm" disabled={busy} onClick={() => { if (pick === 'interview') { try { localStorage.setItem('hoose_iv', iv); } catch { /* ignore */ } } save({ status: pick, notify: send && NOTIFY[pick] ? notify : '', ...(pick === 'interview' ? { interview_url: iv } : {}) }, `เปลี่ยนเป็น “${STATUS_TH[pick]}” แล้ว`); }}>ยืนยัน: {STATUS_TH[pick]}</button>
              <button className="btn sm ghost" onClick={() => setPick(null)}>ยกเลิก</button>
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <h2>ตอบแชท 💬</h2>
        <span className="mut" style={{ fontSize: 12 }}>ส่งข้อความจากทีม HOOSE ถึงคนนี้ทาง LINE (นับโควตา push 1 ข้อความ) · ขึ้นในประวัติแชทด้านล่าง</span>
        <textarea className="in-t" style={{ height: 80, padding: 10 }} value={msg} onChange={e => setMsg(e.target.value)} placeholder="พิมพ์ข้อความ…" />
        <div className="row" style={{ gap: 8 }}>
          <button className="btn p sm" disabled={busy || !msg.trim()} onClick={async () => { await save({ notify: msg, ...(u.needs_attention ? { resolve: true } : {}) }, 'ส่งแล้ว'); setMsg(''); }}>ส่งทาง LINE</button>
          {u.needs_attention && <span className="mut" style={{ fontSize: 12 }}>ส่งแล้วจะปิดเรื่อง “รอทีมตอบ” ให้อัตโนมัติ</span>}
        </div>
      </section>

      <section className="card">
        <h2>โน้ตภายใน</h2>
        <span className="mut" style={{ fontSize: 12 }}>เห็นเฉพาะแอดมิน ผู้สมัครไม่เห็น</span>
        <textarea className="in-t" style={{ height: 80, padding: 10 }} value={note} onChange={e => setNote(e.target.value)} />
        <button className="btn sm" style={{ alignSelf: 'flex-start' }} disabled={busy || note === (u.note || '')} onClick={() => save({ note }, 'บันทึกโน้ตแล้ว')}>บันทึกโน้ต</button>
      </section>

      <section className="card">
        <h2>สิ่งที่ผู้ช่วยจำไว้</h2>
        <span className="mut" style={{ fontSize: 12 }}>ผู้ช่วยจดเองระหว่างคุย (1 บรรทัดต่อ 1 เรื่อง) แก้หรือลบได้</span>
        <textarea className="in-t" style={{ height: 90, padding: 10 }} value={memory} onChange={e => setMemory(e.target.value)} />
        <button className="btn sm" style={{ alignSelf: 'flex-start' }} disabled={busy || memory === (u.memory || '')} onClick={() => save({ memory }, 'บันทึกแล้ว')}>บันทึก</button>
      </section>

      <section className="card">
        <h2>ประวัติแชท ({msgs.length})</h2>
        {msgs.length === 0 ? <div className="empty">ยังไม่มีข้อความ</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 520, overflowY: 'auto' }}>
            {msgs.map(m => (
              <div key={m.id} style={{ alignSelf: m.role === 'user' ? 'flex-start' : 'flex-end', maxWidth: '80%' }}>
                <div style={{ background: m.role === 'user' ? 'var(--soft)' : 'var(--blue)', color: m.role === 'user' ? 'var(--ink)' : '#fff', padding: '8px 12px', borderRadius: 12, fontSize: 14, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.content}</div>
                <div className="mut" style={{ fontSize: 11, marginTop: 2, textAlign: m.role === 'user' ? 'left' : 'right' }}>{m.role === 'user' ? 'ผู้ใช้' : 'HOOSE'} · {fmt(m.created_at)}</div>
              </div>))}
          </div>
        )}
      </section>
    </main></>
  );
}
