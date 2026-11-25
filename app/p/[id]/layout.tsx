'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import ProjectProvider, { useProject } from '@/components/ProjectProvider';
import TopBar from '@/components/TopBar';
import ShareModal from '@/components/ShareModal';
import ProjectTitle from '@/components/ProjectTitle';

const TABS: [string, string][] = [['', 'แดชบอร์ด'], ['details', 'รายละเอียด'], ['crew', 'ทีมงาน'], ['docs', 'เอกสาร'], ['calendar', 'ปฏิทินทีม'], ['budget', 'งบประมาณ'], ['summary', 'สรุปผล'], ['members', 'สมาชิก']];

function Shell({ children }: { children: React.ReactNode }) {
  const { id, role, data, loading, missing } = useProject();
  const path = usePathname(); const router = useRouter();
  const [share, setShare] = useState(false);
  const sub = path.split('/')[3] || '';
  useEffect(() => { if (role === 'viewer' && sub !== 'summary') router.replace(`/p/${id}/summary`); }, [role, sub, id, router]);
  if (loading) return <><TopBar /><main className="wrap"><div className="skel" /><div className="skel" /></main></>;
  if (missing || !data) return <><TopBar /><main className="wrap"><div className="empty"><h2 style={{ color: 'var(--ink)' }}>ไม่พบโปรเจกต์นี้</h2><p>อาจถูกลบไปแล้ว หรือคุณยังไม่ได้รับสิทธิ์เข้าถึง</p><Link className="btn p" href="/">ไปหน้าภาพรวม</Link></div></main></>;
  if (role === 'viewer') return <><TopBar label="สรุปผลโปรเจกต์" /><main className="wrap">{sub === 'summary' ? children : <div className="skel" />}</main></>;
  return (
    <>
      <TopBar />
      <nav className="tabs" aria-label="เมนูโปรเจกต์"><div className="in">
        {TABS.map(([k, l]) => <Link key={k} href={`/p/${id}${k ? '/' + k : ''}`} className={'tab' + (sub === k ? ' on' : '')} style={{ textDecoration: 'none' }}>{l}</Link>)}
      </div></nav>
      <main className="wrap">
        <div className="between">
          <div className="row" style={{ minWidth: 0 }}><Link className="btn sm ghost" href="/">← ภาพรวม</Link><ProjectTitle /></div>
          <button className="btn sm p" onClick={() => setShare(true)}>แชร์ให้ทีม</button>
        </div>
        {children}
      </main>
      {share && <ShareModal onClose={() => setShare(false)} />}
    </>
  );
}

export default function ProjectLayout({ params, children }: { params: { id: string }; children: React.ReactNode }) {
  return <ProjectProvider id={params.id}><Shell>{children}</Shell></ProjectProvider>;
}
