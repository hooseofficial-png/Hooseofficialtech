'use client';
import { useCallback, useEffect, useState } from 'react';
import { useProject } from '@/components/ProjectProvider';
import { sb } from '@/lib/supabase/client';
import type { Role } from '@/lib/domain';
import { toast, errText, copyText } from '@/lib/ui';
import InviteBox from '@/components/InviteBox';

interface Person { user_id: string | null; email: string; full_name: string; role: Role; pending: boolean; position?: string; company?: string }
const ROLES: Record<Role, [string, string]> = {
  owner: ['เจ้าของ', 'ทุกอย่าง รวมถึงลบโปรเจกต์'],
  editor: ['Editor', 'แก้ไขทุกหน้า เชิญสมาชิก'],
  viewer: ['Viewer', 'ดูหน้าสรุปผลอย่างเดียว']
};

export default function Members() {
  const { id, role } = useProject();
  const [people, setPeople] = useState<Person[]>([]);
  const load = useCallback(async () => {
    const [{ data }, { data: info }] = await Promise.all([sb().rpc('project_people', { pid: id }), sb().rpc('project_people_info', { pid: id })]);
    const I = new Map(((info as { user_id: string; job_title: string; company: string }[]) || []).map(x => [x.user_id, x]));
    setPeople(((data as Person[]) || []).map(p => ({ ...p, position: (p.user_id && I.get(p.user_id)?.job_title) || '', company: (p.user_id && I.get(p.user_id)?.company) || '' })));
  }, [id]);
  useEffect(() => { load(); }, [load]);
  async function change(p: Person, role: Role) {
    const q = p.pending ? sb().from('project_invites').update({ role }).eq('project_id', id).eq('email', p.email) : sb().from('project_members').update({ role }).eq('project_id', id).eq('user_id', p.user_id!);
    const { error } = await q; if (error) toast(errText(error)); load();
  }
  async function remove(p: Person) {
    const q = p.pending ? sb().from('project_invites').delete().eq('project_id', id).eq('email', p.email) : sb().from('project_members').delete().eq('project_id', id).eq('user_id', p.user_id!);
    const { error } = await q; if (error) toast(errText(error)); else toast('นำออกแล้ว'); load();
  }
  async function resend(p: Person) {
    const r = await fetch('/api/invite', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId: id, emails: [p.email], role: p.role }) });
    const x = (await r.json().catch(() => ({}))).results?.[0];
    if (x?.emailed) toast('ส่งอีเมลเชิญอีกครั้งแล้ว'); else if (x?.link) copyText(x.link, 'ยังส่งอีเมลไม่ได้ · คัดลอกลิงก์เชิญแล้ว ส่งให้เขาได้เลย'); else toast('ส่งไม่สำเร็จ');
  }
  const isOwner = role === 'owner';
  return (
    <div className="grid">
      <section className="card c12"><h2>เชิญสมาชิก</h2>
        <InviteBox projectId={id} canOwner={role === 'owner'} onDone={load} />
      </section>
      <section className="card c12"><h2>สมาชิก <span className="mut num" style={{ fontWeight: 500 }}>{people.length}</span></h2>
        <div className="list">{people.map(p => (
          <div className="li" key={p.email}>
            <span className={'av' + (p.pending ? ' o' : '')}>{(p.full_name || p.email)[0]?.toUpperCase()}</span>
            <div className="grow"><div style={{ fontWeight: 600 }} className="ell">{p.full_name || p.email}{p.position && <span className="pos-tag">{p.position}</span>}</div><div className="mut" style={{ fontSize: 12 }}>{p.email}{p.company ? ' · ' + p.company : ''}{p.pending ? ' · รอสมัครสมาชิก' : ''}</div></div>
            {p.role === 'owner' && !isOwner ? <span className="chip b">เจ้าของ</span> : (
              <select className="in-t" style={{ width: 150, height: 34 }} value={p.role} onChange={e => change(p, e.target.value as Role)} aria-label="บทบาท">
                {(Object.keys(ROLES) as Role[]).filter(k => k !== 'owner' || isOwner).map(k => <option key={k} value={k}>{ROLES[k][0]}</option>)}
              </select>)}
            {p.pending && <button className="btn sm" onClick={() => resend(p)}>ส่งคำเชิญอีกครั้ง</button>}
            {(p.role !== 'owner' || isOwner) && <button className="btn sm ghost" onClick={() => remove(p)}>นำออก</button>}
          </div>))}</div>
      </section>
    </div>
  );
}
