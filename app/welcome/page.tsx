'use client';
import { useEffect, useState } from 'react';
import { sb } from '@/lib/supabase/client';
import InviteBox from '@/components/InviteBox';
import { POSITIONS, POSITION_TH, PROJECT_POSITIONS, POSITION_DESC } from '@/lib/domain';
import PartyCodeField from '@/components/PartyCodeField';
import { joinWithCode } from '@/lib/party';
import { toast, errText, celebrate } from '@/lib/ui';
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
type Screen = 'start' | 'profile' | 'project' | 'invite';
type Mode = 'create' | 'join' | 'invited';
const FLOW: Record<Mode, Screen[]> = { create: ['start', 'profile', 'project', 'invite'], join: ['start', 'profile'], invited: ['profile'] };
const LABEL: Record<Screen, string> = { start: 'เริ่มต้น', profile: 'ตำแหน่ง', project: 'โปรเจกต์แรก', invite: 'เชิญทีม' };

export default function Welcome() {
  const [mode, setMode] = useState<Mode>('create');
  const [step, setStep] = useState(0);
  const [code, setCode] = useState(''); const [codeErr, setCodeErr] = useState('');
  const [joinedId, setJoinedId] = useState<string | null>(null);
  const [projPos, setProjPos] = useState('');
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
    const n = new URLSearchParams(window.location.search).get('next'); if (n?.startsWith('/') && n !== '/') { setNext(n); setMode('invited'); }
    currentUser().then(async (user) => {
      if (!user) { window.location.href = '/login'; return; }
      setUid(user.id);
      const { data: p } = await sb().from('profiles').select('full_name, position, company, phone').eq('id', user.id).maybeSingle();
      if (p) { setName(p.full_name || ''); setPos(p.position || ''); setProjPos(p.position || ''); setCompany(p.company || ''); setPhone(p.phone || ''); }
    });
  }, []);

  const flow = FLOW[mode]; const screen = flow[Math.min(step, flow.length - 1)];
  const go = (n: number) => { setDir(n > step ? 1 : -1); setStep(n); };
  async function finish() {
    celebrate();
    await sb().from('profiles').update({ onboarded_at: new Date().toISOString() }).eq('id', uid);
    await new Promise(r => setTimeout(r, 700));
    window.location.href = mode === 'invited' ? next : joinedId ? `/p/${joinedId}` : '/?tour=1';
  }
  async function nextStep() {
    if (screen === 'start') {
      if (mode === 'join') {
        if (code.length !== 6) { setCodeErr('Party Code มี 6 ตัวอักษร'); return; }
        setBusy(true); setCodeErr('');
        try { const pid = joinedId || await joinWithCode(code); setJoinedId(pid); toast('พบโปรเจกต์แล้ว · เข้าร่วมเรียบร้อย'); }
        catch (e) { setCodeErr((e as Error).message); setBusy(false); return; }
        setBusy(false);
      }
      go(step + 1); return;
    }
    if (screen === 'profile') {
      const joining = mode !== 'create';
      if (!joining && !pos) { toast('เลือกตำแหน่งของคุณ'); return; }
      if (joining && !projPos) { toast('เลือกตำแหน่งของคุณในโปรเจกต์'); return; }
      setBusy(true);
      const profilePos = joining ? ((POSITIONS as readonly string[]).includes(projPos) ? projPos : pos) : pos;
      const { error } = await sb().from('profiles').update({ full_name: name.trim(), position: profilePos, company: company.trim(), phone: phone.trim() }).eq('id', uid);
      if (!error && joinedId) await sb().rpc('set_my_position', { pid: joinedId, pos: projPos });
      setBusy(false); if (error) { toast(errText(error)); return; }
      if (step === flow.length - 1) { await finish(); return; }
      go(step + 1); return;
    }
    if (screen === 'project') {
      if (!proj.name.trim()) { go(step + 1); return; }
      if (!projectId) {
        setBusy(true);
        const { data, error } = await sb().from('projects').insert({ name: proj.name.trim(), brand: proj.brand.trim(), created_by: uid }).select('id').single();
        setBusy(false); if (error) { toast(errText(error)); return; }
        setProjectId(data.id); toast('สร้างโปรเจกต์ “' + proj.name.trim() + '” แล้ว');
      }
      go(step + 1); return;
    }
    await finish();
  }

  return (
    <main className="onb">
      <div className="onb-bg" aria-hidden="true"><i /><i /><i /></div>
      <section className="onb-card" aria-labelledby="onb-h">
        <header className="row"><img src="/hoose-logo.png" alt="HOOSE" style={{ height: 26 }} /><span className="sp" /><span className="mut" style={{ fontSize: 12 }}>ขั้นที่ {step + 1} จาก {flow.length} · {LABEL[screen]}</span></header>
        <div className={'onb-body ' + (dir > 0 ? 'in-r' : 'in-l')} key={step}>
          {screen === 'start' && <>
            <h1 id="onb-h">ยินดีต้อนรับสู่ HOOSE{name ? ', ' + name.split(' ')[0] : ''}<br /><span className="mut-h">จะเริ่มต้นแบบไหน?</span></h1>
            <div className="pos-grid" role="radiogroup" aria-label="เริ่มต้น">
              <button type="button" role="radio" aria-checked={mode === 'create'} className={'pos-card start-card' + (mode === 'create' ? ' on' : '')} onClick={() => setMode('create')}>
                <span className="pos-ic"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M12 9v6M9 12h6"/></svg></span>
                <b>สร้าง Workspace ใหม่</b><small>สำหรับคนที่เริ่มโปรเจกต์เอง</small>
                <span className="pos-desc">สร้างโปรเจกต์ วางพรีโปรดักชัน แล้วชวนทีมเข้ามาด้วย Party Code</span>
                <span className="pos-check" aria-hidden="true">✓</span>
              </button>
              <button type="button" role="radio" aria-checked={mode === 'join'} className={'pos-card start-card' + (mode === 'join' ? ' on' : '')} onClick={() => setMode('join')}>
                <span className="pos-ic"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v3M21 12v2"/></svg></span>
                <b>มี Party Code แล้ว</b><small>สำหรับคนที่ทีมชวนเข้ามา</small>
                <span className="pos-desc">ใส่ Code 6 ตัวที่ได้จาก Production Manager หรือ Producer</span>
                <span className="pos-check" aria-hidden="true">✓</span>
              </button>
            </div>
            {mode === 'join' && <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 420 }}>
              <PartyCodeField value={code} onChange={v => { setCode(v); setCodeErr(''); setJoinedId(null); }} onEnter={nextStep} autoFocus />
              {codeErr && <div className="err" role="alert">{codeErr}</div>}
            </div>}
          </>}
          {screen === 'profile' && mode !== 'create' && <>
            <h1 id="onb-h">{joinedId ? 'เข้าร่วมโปรเจกต์แล้ว' : 'ยินดีต้อนรับสู่ HOOSE'}{name ? ', ' + name.split(' ')[0] : ''}<br /><span className="mut-h">คุณทำหน้าที่อะไรในโปรเจกต์นี้?</span></h1>
            <div className="fg">
              <label className="f" htmlFor="w-pp">ตำแหน่งในโปรเจกต์
                <select className="in-t big" id="w-pp" value={projPos} onChange={e => setProjPos(e.target.value)}>
                  <option value="">เลือกตำแหน่ง</option>
                  {PROJECT_POSITIONS.map(x => <option key={x} value={x}>{x}</option>)}
                </select></label>
              <label className="f" htmlFor="w-name2">ชื่อ-นามสกุล<input className="in-t big" id="w-name2" value={name} onChange={e => setName(e.target.value)} /></label>
              <label className="f" htmlFor="w-co2">บริษัท / สังกัด<input className="in-t big" id="w-co2" value={company} onChange={e => setCompany(e.target.value)} /></label>
            </div>
            {projPos && <div className="hint">{POSITION_DESC[projPos]}</div>}
          </>}
          {screen === 'profile' && mode === 'create' && <>
            <h1 id="onb-h">คุณทำงานในตำแหน่งอะไร?<br /><span className="mut-h">ใช้เป็นตำแหน่งเริ่มต้นในทุกโปรเจกต์ที่คุณสร้าง</span></h1>
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
          {screen === 'project' && <>
            <h1 id="onb-h">สร้างโปรเจกต์แรกของคุณ<br /><span className="mut-h">ตั้งชื่อไว้ก่อน รายละเอียดกรอกต่อทีหลังได้</span></h1>
            <div className="fg">
              <label className="f" htmlFor="w-pn">ชื่อโปรเจกต์<input className="in-t big" id="w-pn" value={proj.name} disabled={!!projectId} onChange={e => setProj({ ...proj, name: e.target.value })} placeholder="เช่น TVC Summer Campaign 2027" autoFocus /></label>
              <label className="f" htmlFor="w-br">ลูกค้า / แบรนด์ (ไม่บังคับ)<input className="in-t big" id="w-br" value={proj.brand} disabled={!!projectId} onChange={e => setProj({ ...proj, brand: e.target.value })} /></label>
            </div>
            <div className="hint">เว้นว่างแล้วกด “ถัดไป” ได้ถ้ายังไม่พร้อม</div>
          </>}
          {screen === 'invite' && <>
            <h1 id="onb-h">เชิญทีมเข้าร่วม{projectId ? ' “' + proj.name + '”' : ''}</h1>
            {projectId ? <><InviteBox projectId={projectId} canOwner /><div className="hint">หรือแชร์ Party Code ให้ทีมใส่เองได้ที่ปุ่ม “แชร์ Party Code” ในโปรเจกต์</div></>
              : <p className="mut">ยังไม่ได้สร้างโปรเจกต์ เชิญทีมได้ทีหลังที่แท็บ “สมาชิก” ของแต่ละโปรเจกต์</p>}
          </>}
        </div>
        <footer>
          <div className="onb-progress" aria-hidden="true"><i style={{ width: ((step + 1) / flow.length) * 100 + '%' }} /></div>
          <div className="between">
            <button className="btn" onClick={() => go(step - 1)} disabled={step === 0 || busy} style={{ visibility: step === 0 ? 'hidden' : 'visible' }}>‹ ย้อนกลับ</button>
            <div className="row">
              {(screen === 'project' || screen === 'invite') && <button className="btn ghost" onClick={finish}>ข้าม</button>}
              <button className="btn p" onClick={nextStep} disabled={busy || (screen === 'start' && mode === 'join' && code.length !== 6) || (screen === 'profile' && (mode === 'create' ? !pos : !projPos))}>{busy ? 'กำลังบันทึก…' : step === flow.length - 1 ? 'เริ่มใช้งาน HOOSE ›' : 'ถัดไป ›'}</button>
            </div>
          </div>
        </footer>
      </section>
    </main>
  );
}
