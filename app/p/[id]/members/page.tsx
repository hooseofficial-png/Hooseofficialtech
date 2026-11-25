'use client';
import { useCallback, useEffect, useState } from 'react';
import { useProject } from '@/components/ProjectProvider';
import { sb } from '@/lib/supabase/client';
import type { Role } from '@/lib/domain';
import { toast, errText } from '@/lib/ui';

interface Person { user_id: string | null; email: string; full_name: string; role: Role; pending: boolean; position?: string; company?: string }
const ROLES: Record<Role, [string, string]> = {
  owner: ['เจ้าของ', 'ทุกอย่าง รวมถึงลบโปรเจกต์'],
  editor: ['Editor', 'แก้ไขทุกหน้า เชิญสมาชิก'],
  viewer: ['Viewer', 'ดูหน้าสรุปผลอย่างเดียว']
};

export default function Members() {
  const { id, role } = useProject();
  const [people, setPeople] = useState<Person[]>([]);
  const [email, setEmail] = useState(''); const [r, setR] = useState<Role>('viewer'); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const [{ data }, { data: info }] = await Promise.all([sb().rpc('project_people', { pid: id }), sb().rpc('project_people_info', { pid: id })]);
    const I = new Map(((info as { user_id: string; job_title: string; company: string }[]) || []).map(x => [x.user_id, x]));
    setPeople(((data as Person[]) || []).map(p => ({ ...p, position: (p.user_id && I.get(p.user_id)?.job_title) || '', company: (p.user_id && I.get(p.user_id)?.company) || '' })));
  }, [id]);
  useEffect(() => { load(); }, [load]);
  async function invite(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    const { data, error } = await sb().rpc('invite_member', { pid: id, invite_email: email, invite_role: r });
    if (error) { toast(errText(error)); setBusy(false); return; }
    if (data === 'invited') {
      const res = await fetch('/api/invite', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId: id, email }) });
      toast(res.ok ? 'ส่งอีเมลเชิญแล้ว · เข้าสู่ระบบด้วยอีเมลนี้แล้วจะเห็นโปรเจกต์ทันที' : 'บันทึกคำเชิญแล้ว · ให้เขาเข้าสู่ระบบด้วยอีเมลนี้');
    } else toast('เพิ่มสมาชิกแล้ว');
    setEmail(''); setBusy(false); load();
  }
  async function change(p: Person, role: Role) {
    const q = p.pending ? sb().from('project_invites').update({ role }).eq('project_id', id).eq('email', p.email) : sb().from('project_members').update({ role }).eq('project_id', id).eq('user_id', p.user_id!);
    const { error } = await q; if (error) toast(errText(error)); load();
  }
  async function remove(p: Person) {
    const q = p.pending ? sb().from('project_invites').delete().eq('project_id', id).eq('email', p.email) : sb().from('project_members').delete().eq('project_id', id).eq('user_id', p.user_id!);
    const { error } = await q; if (error) toast(errText(error)); else toast('นำออกแล้ว'); load();
  }
  const isOwner = role === 'owner';
  return (
    <div className="grid">
      <section className="card c12"><h2>เชิญสมาชิก</h2>
        <form className="row w" onSubmit={invite}>
          <input className="in-t" style={{ flex: 2, minWidth: 220 }} type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="อีเมลของคนที่จะเชิญ" aria-label="อีเมล" />
          <select className="in-t" style={{ flex: 1, minWidth: 160 }} value={r} onChange={e => setR(e.target.value as Role)} aria-label="บทบาท">
            {(Object.keys(ROLES) as Role[]).filter(k => k !== 'owner' || isOwner).map(k => <option key={k} value={k}>{ROLES[k][0]} · {ROLES[k][1]}</option>)}
          </select>
          <button className="btn p" disabled={busy}>เชิญ</button>
        </form>
        <span className="mut" style={{ fontSize: 12 }}>PM / Producer → Editor · ทีมงานทั่วไป → Viewer (เห็นเฉพาะหน้าสรุปผล) · คนที่ไม่มีบัญชีให้ใช้ลิงก์แชร์แทน</span>
      </section>
      <section className="card c12"><h2>สมาชิก <span className="mut num" style={{ fontWeight: 500 }}>{people.length}</span></h2>
        <div className="list">{people.map(p => (
          <div className="li" key={p.email}>
            <span className={'av' + (p.pending ? ' o' : '')}>{(p.full_name || p.email)[0]?.toUpperCase()}</span>
            <div className="grow"><div style={{ fontWeight: 600 }} className="ell">{p.full_name || p.email}{p.position && <span className="pos-tag">{p.position}</span>}</div><div className="mut" style={{ fontSize: 12 }}>{p.email}{p.company ? ' · ' + p.company : ''}{p.pending ? ' · รอเข้าสู่ระบบครั้งแรก' : ''}</div></div>
            {p.role === 'owner' && !isOwner ? <span className="chip b">เจ้าของ</span> : (
              <select className="in-t" style={{ width: 150, height: 34 }} value={p.role} onChange={e => change(p, e.target.value as Role)} aria-label="บทบาท">
                {(Object.keys(ROLES) as Role[]).filter(k => k !== 'owner' || isOwner).map(k => <option key={k} value={k}>{ROLES[k][0]}</option>)}
              </select>)}
            {(p.role !== 'owner' || isOwner) && <button className="btn sm ghost" onClick={() => remove(p)}>นำออก</button>}
          </div>))}</div>
      </section>
    </div>
  );
}
