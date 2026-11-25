'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import TopBar from '@/components/TopBar';
import Modal from '@/components/Modal';
import { MonthGrid, MonthNav, Legend } from '@/components/Calendar';
import CalendarSync from '@/components/CalendarSync';
import WelcomeTour from '@/components/WelcomeTour';
import { sb, BUCKET } from '@/lib/supabase/client';
import { loadFull } from '@/components/ProjectProvider';
import { dateRange, docOk, evKey, evLabel, firstShoot, fmtS, hm, ini, readyPct, todayISO, type HEvent, type ProjectData, type Project, type Role } from '@/lib/domain';
import { toast, errText } from '@/lib/ui';

interface Item { role: Role; project: Project; full: ProjectData | null }

function Meter({ label, val, r }: { label: string; val: string; r: number }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><div className="between" style={{ fontSize: 12, color: 'var(--mut)' }}><span>{label}</span><span className="num">{val}</span></div><div className="bar" style={{ height: 6 }}><i style={{ width: Math.round(r * 100) + '%' }} /></div></div>;
}

export default function Overview() {
  const router = useRouter();
  const [items, setItems] = useState<Item[] | null>(null);
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [del, setDel] = useState<Item | null>(null);
  const [tour, setTour] = useState(false); const [me, setMe] = useState<{ id: string; name: string } | null>(null);
  const load = useCallback(async () => {
    const { data: u } = await sb().auth.getUser(); if (!u.user) return;
    const { data: prof } = await sb().from('profiles').select('full_name, onboarded_at, tour_done_at').eq('id', u.user.id).maybeSingle();
    if (prof && !prof.onboarded_at) { router.replace('/welcome'); return; }
    setMe({ id: u.user.id, name: prof?.full_name || '' });
    if (prof && (!prof.tour_done_at || new URLSearchParams(window.location.search).get('tour'))) setTour(true);
    if (window.location.search.includes('tour')) window.history.replaceState(null, '', '/');
    const { data } = await sb().from('project_members').select('role, projects(*)').eq('user_id', u.user.id);
    const rows = (data || []).filter((r: any) => r.projects) as unknown as { role: Role; projects: Project }[];
    const full = await Promise.all(rows.map(r => (r.role === 'viewer' ? Promise.resolve(null) : loadFull(r.projects.id))));
    setItems(rows.map((r, i) => ({ role: r.role, project: r.projects, full: full[i] })));
  }, [router]);
  useEffect(() => { load(); }, [load]);
  async function closeTour() { setTour(false); if (me) await sb().from('profiles').update({ tour_done_at: new Date().toISOString() }).eq('id', me.id); }

  async function create() {
    const { data: u } = await sb().auth.getUser();
    const { data, error } = await sb().from('projects').insert({ name: '', created_by: u.user!.id }).select('id').single();
    if (error) { toast(errText(error)); return; }
    router.push(`/p/${data.id}/details`);
  }
  async function remove(it: Item) {
    setDel(null);
    for (const folder of ['logo', 'docs', 'workscope']) {
      const base = `projects/${it.project.id}/${folder}`;
      const { data: objs } = await sb().storage.from(BUCKET).list(base, { limit: 1000 });
      if (objs?.length) await sb().storage.from(BUCKET).remove(objs.map(o => `${base}/${o.name}`));
    }
    const { error } = await sb().from('projects').delete().eq('id', it.project.id);
    if (error) toast(errText(error)); else { toast('ลบโปรเจกต์แล้ว'); load(); }
  }

  const managed = (items || []).filter(i => i.full).sort((a, b) => (firstShoot(a.full!) || '9999').localeCompare(firstShoot(b.full!) || '9999'));
  const viewing = (items || []).filter(i => !i.full);
  const allEv: { e: HEvent; p: Project }[] = managed.flatMap(i => i.full!.events.map(e => ({ e, p: i.project })));
  const t = todayISO();
  const stats: [string, number][] = [
    ['โปรเจกต์', managed.length],
    ['วันถ่ายเดือนนี้', allEv.filter(x => x.e.type === 'shoot' && x.e.date?.slice(0, 7) === t.slice(0, 7)).length],
    ['ทีมงานยืนยัน', managed.reduce((a, i) => a + i.full!.crew.filter(c => c.status === 'confirmed').length, 0)],
    ['ที่ว่าง Open Call', managed.reduce((a, i) => a + i.full!.crew.filter(c => c.status === 'open').length, 0)]
  ];
  return (
    <>
      <TopBar />
      <main className="wrap">
        <div className="between"><h1>ภาพรวม</h1><div className="row">{!tour && <button className="btn ghost" onClick={() => setTour(true)}>คู่มือการใช้งาน</button>}<button className="btn p" onClick={create}>+ โปรเจกต์ใหม่</button></div></div>
        {tour && <WelcomeTour name={me?.name} onClose={closeTour} onCreate={create} />}
        {items === null ? <><div className="skel" /><div className="skel" /></> : <>
          <div className="grid">{stats.map(([l, v]) => <div key={l} className="card c3" style={{ gap: 4 }}><span className="cap">{l}</span><b className="num" style={{ font: '600 28px/1.1 var(--f-display)' }}>{v}</b></div>)}</div>
          <CalendarSync variant="card" />
          {!managed.length && !viewing.length && <div className="empty"><h2 style={{ color: 'var(--ink)' }}>ยังไม่มีโปรเจกต์</h2><p>สร้างโปรเจกต์แรก แล้วกรอกรายละเอียด ทีมงาน และเอกสาร ทุกคนในทีมเห็นข้อมูลเดียวกันทันที</p><button className="btn p" onClick={create}>+ สร้างโปรเจกต์แรก</button></div>}
          {managed.length > 0 && <div className="pcards">
            {managed.map(({ project: p, full: d, role }) => {
              const cf = d!.crew.filter(c => c.status === 'confirmed').length; const dn = d!.docs.filter(docOk).length;
              const nx = d!.events.filter(e => e.date && e.date >= t).sort((a, b) => evKey(a).localeCompare(evKey(b)))[0];
              return (
                <article key={p.id} className="card pcard" onClick={() => router.push(`/p/${p.id}`)} onKeyDown={e => { if (e.key === 'Enter') router.push(`/p/${p.id}`); }} tabIndex={0} role="link" aria-label={'เปิด ' + (p.name || 'โปรเจกต์')}>
                  <div className="row">
                    <span className="logo-box" style={{ width: 40, height: 40, background: 'var(--soft)' }}><b style={{ color: 'var(--blue)' }}>{ini(p.brand || p.name)}</b></span>
                    <div className="grow"><h2 className="ell">{p.name || 'โปรเจกต์ไม่มีชื่อ'}</h2><div className="mut ell" style={{ fontSize: 12 }}>{p.brand || 'ยังไม่ระบุลูกค้า'}</div></div>
                    {role === 'owner' && <button className="btn sm ghost" onClick={e => { e.stopPropagation(); setDel({ role, project: p, full: d }); }} aria-label="ลบโปรเจกต์">ลบ</button>}
                  </div>
                  <div className="row w"><span className="chip lb">{dateRange(p) || 'ยังไม่ตั้งวันถ่าย'}</span>{p.queues ? <span className="chip">{p.queues} คิว</span> : null}<span className="chip k">พร้อม {readyPct(d!)}%</span>{p.details_locked && <span className="chip b">ยืนยันแล้ว</span>}</div>
                  <Meter label="ทีมงาน" val={cf + '/' + d!.crew.length} r={d!.crew.length ? cf / d!.crew.length : 0} />
                  <Meter label="เอกสาร" val={dn + '/' + d!.docs.length} r={d!.docs.length ? dn / d!.docs.length : 0} />
                  <div className="mut ell" style={{ fontSize: 12 }}>{nx ? 'ถัดไป: ' + fmtS(nx.date) + (nx.time ? ' ' + hm(nx.time) : '') + ' · ' + evLabel(nx) : 'ไม่มีนัดหมายที่จะถึง'}</div>
                </article>
              );
            })}
            <button className="card newcard" onClick={create}>+ โปรเจกต์ใหม่</button>
          </div>}
          {viewing.length > 0 && <section className="card"><h2>โปรเจกต์ที่ดูได้ (Viewer)</h2><div className="list">
            {viewing.map(({ project: p }) => <div className="li" key={p.id}><span className="grow"><b>{p.name || 'โปรเจกต์'}</b> <span className="mut">{dateRange(p)}</span></span><Link className="btn sm" href={`/p/${p.id}/summary`}>ดูสรุปผล</Link></div>)}
          </div></section>}
          {managed.length > 0 && <section className="card"><div className="between"><h2>ปฏิทินทุกโปรเจกต์</h2><div className="row w"><CalendarSync /><MonthNav month={month} setMonth={setMonth} /></div></div>
            <MonthGrid month={month} items={allEv.map(x => ({ e: x.e, label: (x.p.name || 'โปรเจกต์').split(' ')[0], title: (x.p.name || 'โปรเจกต์') + ' · ' + evLabel(x.e) }))} /><Legend /></section>}
        </>}
      </main>
      {del && <Modal title={'ลบ “' + (del.project.name || 'โปรเจกต์ไม่มีชื่อ') + '”?'} onClose={() => setDel(null)}>
        <p className="mut" style={{ margin: 0 }}>ทีมงาน เอกสาร นัดหมาย และงบประมาณของโปรเจกต์นี้จะถูกลบสำหรับทุกคน และย้อนกลับไม่ได้</p>
        <div className="row"><button className="btn k" onClick={() => remove(del)}>ลบโปรเจกต์</button><button className="btn" onClick={() => setDel(null)}>ยกเลิก</button></div>
      </Modal>}
    </>
  );
}
