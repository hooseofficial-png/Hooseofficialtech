'use client';
import { useEffect, useState } from 'react';
import { sb } from '@/lib/supabase/client';
import InviteBox from '@/components/InviteBox';
import { POSITIONS, POSITION_TH } from '@/lib/domain';
import { toast, errText } from '@/lib/ui';
import { currentUser } from '@/lib/me';

const POS_DESC: Record<string, string> = {
  Director: 'ดูแลภาพรวมความคิดสร้างสรรค์ Treatment และการถ่ายทำ',
  Producer: 'ดูแลลูกค้า งบประมาณ และให้งานเดินตามแผน',
  'Production Manager': 'วางแผนพรีโปรดักชัน ทีมงาน คิวถ่าย และเอกสาร'
};
const POS_ICON: Record<string, JSX.Element> = {
  Director: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="8" width="13" height="11" rx="2"/><path d="M16 11l5-3v10l-5-3"/><path d="M5 8l3-4M10 8l3-4"/></svg>,
  Producer: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></svg>,
  'Production Manager': <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="4" y="4" width="16" height="17" rx="2"/><path d="M9 4V2h6v2M8 11l2 2 4-4M8 17h8"/></svg>
};
const STEPS = ['ตำแหน่ง', 'โปรเจกต์แรก', 'เชิญทีม'];

export default function Welcome() {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [uid, setUid] = useState('');
  const [name, setName] = useState('');
  const [pos, setPos] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [proj, setProj] = useState({ name: '', brand: '' });
  const [projectId, setProjectId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [next, setNext] = useState('/');

  useEffect(() => {
    const n = new URLSearchParams(window.location.search).get('next'); if (n?.startsWith('/') && n !== '/') setNext(n);
    currentUser().then(async (user) => {
      if (!user) { window.location.href = '/login'; return; }
      setUid(user.id);
      const { data: p } = await sb().from('profiles').select('full_name, position, company, phone').eq('id', user.id).maybeSingle();
      if (p) { setName(p.full_name || ''); setPos(p.position || ''); setCompany(p.company || ''); setPhone(p.phone || ''); }
    });
  }, []);

  const go = (n: number) => { setDir(n > step ? 1 : -1); setStep(n); };
  async function finish() {
    await sb().from('profiles').update({ onboarded_at: new Date().toISOString() }).eq('id', uid);
    window.location.href = next !== '/' ? next : projectId ? `/?tour=1` : '/?tour=1';
  }
  async function nextStep() {
    if (step === 0) {
      if (!pos) { toast('เลือกตำแหน่งของคุณ'); return; }
      setBusy(true);
      const { error } = await sb().from('profiles').update({ full_name: name.trim(), position: pos, company: company.trim(), phone: phone.trim() }).eq('id', uid);
      setBusy(false); if (error) { toast(errText(error)); return; }
      // Invited into a project already? Skip "first project" and land there.
      if (next !== '/') { await finish(); return; }
      go(1); return;
    }
    if (step === 1) {
      if (!proj.name.trim()) { go(2); return; }
      if (!projectId) {
        setBusy(true);
        const { data, error } = await sb().from('projects').insert({ name: proj.name.trim(), brand: proj.brand.trim(), created_by: uid }).select('id').single();
        setBusy(false); if (error) { toast(errText(error)); return; }
        setProjectId(data.id); toast('สร้างโปรเจกต์ “' + proj.name.trim() + '” แล้ว');
      }
      go(2); return;
    }
    await finish();
  }

  return (
    <main className="onb">
      <div className="onb-bg" aria-hidden="true"><i /><i /><i /></div>
      <section className="onb-card" aria-labelledby="onb-h">
        <header className="row"><img src="/hoose-logo.png" alt="HOOSE" style={{ height: 26 }} /><span className="sp" /><span className="mut" style={{ fontSize: 12 }}>ขั้นที่ {step + 1} จาก {STEPS.length} · {STEPS[step]}</span></header>
        <div className={'onb-body ' + (dir > 0 ? 'in-r' : 'in-l')} key={step}>
          {step === 0 && <>
            <h1 id="onb-h">ยินดีต้อนรับสู่ HOOSE{name ? ', ' + name.split(' ')[0] : ''}<br /><span className="mut-h">คุณทำงานในตำแหน่งอะไร?</span></h1>
            <div className="pos-grid" role="radiogroup" aria-label="ตำแหน่ง">
              {POSITIONS.map(p => (
                <button key={p} type="button" role="radio" aria-checked={pos === p} className={'pos-card' + (pos === p ? ' on' : '')} onClick={() => setPos(p)}>
                  <span className="pos-ic">{POS_ICON[p]}</span>
                  <b>{p}</b><small>{POSITION_TH[p]}</small>
                  <span className="pos-desc">{POS_DESC[p]}</span>
                  <span className="pos-check" aria-hidden="true">✓</span>
                </button>))}
            </div>
            <div className="fg">
              <label className="f" htmlFor="w-name">ชื่อ-นามสกุล<input className="in-t" id="w-name" value={name} onChange={e => setName(e.target.value)} /></label>
              <label className="f" htmlFor="w-co">บริษัท / สังกัด<input className="in-t" id="w-co" value={company} onChange={e => setCompany(e.target.value)} placeholder="เช่น HOOSE Production" /></label>
              <label className="f" htmlFor="w-ph">เบอร์โทร (ไม่บังคับ)<input className="in-t" id="w-ph" type="tel" value={phone} onChange={e => setPhone(e.target.value)} /></label>
            </div>
          </>}
          {step === 1 && <>
            <h1 id="onb-h">สร้างโปรเจกต์แรกของคุณ<br /><span className="mut-h">ตั้งชื่อไว้ก่อน รายละเอียดกรอกต่อทีหลังได้</span></h1>
            <div className="fg">
              <label className="f" htmlFor="w-pn">ชื่อโปรเจกต์<input className="in-t big" id="w-pn" value={proj.name} disabled={!!projectId} onChange={e => setProj({ ...proj, name: e.target.value })} placeholder="เช่น TVC Summer Campaign 2027" autoFocus /></label>
              <label className="f" htmlFor="w-br">ลูกค้า / แบรนด์ (ไม่บังคับ)<input className="in-t big" id="w-br" value={proj.brand} disabled={!!projectId} onChange={e => setProj({ ...proj, brand: e.target.value })} /></label>
            </div>
            <div className="hint">เว้นว่างแล้วกด “ถัดไป” ได้ถ้ายังไม่พร้อม</div>
          </>}
          {step === 2 && <>
            <h1 id="onb-h">เชิญทีมเข้าร่วม{projectId ? ' “' + proj.name + '”' : ''}</h1>
            {projectId ? <InviteBox projectId={projectId} canOwner />
              : <p className="mut">ยังไม่ได้สร้างโปรเจกต์ เชิญทีมได้ทีหลังที่แท็บ “สมาชิก” ของแต่ละโปรเจกต์</p>}
          </>}
        </div>
        <footer>
          <div className="onb-progress" aria-hidden="true"><i style={{ width: ((step + 1) / STEPS.length) * 100 + '%' }} /></div>
          <div className="between">
            <button className="btn" onClick={() => go(step - 1)} disabled={step === 0 || busy} style={{ visibility: step === 0 ? 'hidden' : 'visible' }}>‹ ย้อนกลับ</button>
            <div className="row">
              {step > 0 && <button className="btn ghost" onClick={finish}>ข้าม</button>}
              <button className="btn p" onClick={nextStep} disabled={busy || (step === 0 && !pos)}>{busy ? 'กำลังบันทึก…' : step === STEPS.length - 1 ? 'เริ่มใช้งาน HOOSE ›' : 'ถัดไป ›'}</button>
            </div>
          </div>
        </footer>
      </section>
    </main>
  );
}
