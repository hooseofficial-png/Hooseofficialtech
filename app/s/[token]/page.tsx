'use client';
import { useEffect, useState } from 'react';
import Summary from '@/components/Summary';
import { sb } from '@/lib/supabase/client';
import { fromSummaryJson, type ProjectData } from '@/lib/domain';

// Public share link: no login, read-only สรุปผล of one project. Files open through /api/share/<token>/file.
export default function SharedPage({ params }: { params: { token: string } }) {
  const [data, setData] = useState<ProjectData | null | undefined>(undefined);
  useEffect(() => { sb().rpc('shared_summary', { token: params.token }).then(({ data: j }) => setData(j ? fromSummaryJson(j) : null)); }, [params.token]);
  const fileUrl = (path: string | null) => path ? `/api/share/${params.token}/file?path=${encodeURIComponent(path)}` : '';
  const open = (path: string | null, url?: string | null) => { const u = path ? fileUrl(path) : url; if (u) window.open(u, '_blank', 'noopener'); };
  return (
    <>
      <header className="top"><div className="in"><img src="/hoose-logo.png" alt="HOOSE" style={{ height: 28 }} /><small className="mut" style={{ marginLeft: 8, fontSize: 11 }}>สรุปผลโปรเจกต์ · ดูอย่างเดียว</small></div></header>
      <main className="wrap">
        {data === undefined && <><div className="skel" /><div className="skel" /></>}
        {data === null && <div className="empty"><h2 style={{ color: 'var(--ink)' }}>ลิงก์นี้ใช้ไม่ได้</h2><p>เจ้าของอาจปิดลิงก์แชร์หรือสร้างลิงก์ใหม่แล้ว ติดต่อ Production Manager ของโปรเจกต์</p></div>}
        {data && <Summary data={data} logoUrl={fileUrl(data.project.logo_path)} open={open} author="" />}
      </main>
    </>
  );
}
