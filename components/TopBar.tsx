'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getMe, cachedMe, signOut } from '@/lib/me';
import { ini } from '@/lib/domain';

export default function TopBar({ label = 'Production Management' }: { label?: string }) {
  const [me, setMe] = useState<{ email: string; name: string; position: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [admin, setAdmin] = useState<boolean | null>(null);
  useEffect(() => { if (open && admin === null) fetch('/api/admin/me').then(r => r.json()).then(j => setAdmin(!!j.admin)).catch(() => setAdmin(false)); }, [open, admin]);
  useEffect(() => {
    const show = (m: ReturnType<typeof cachedMe> | null) => m && setMe({ email: m.email, name: m.profile?.full_name || '', position: m.profile?.position || '' });
    show(cachedMe()); getMe().then(show);
  }, []);
  const out = signOut;
  return (
    <header className="top"><div className="in">
      <Link href="/" className="logo" style={{ display: 'flex', alignItems: 'center' }} aria-label="HOOSE หน้าภาพรวม">
        <img src="/hoose-logo.png" alt="HOOSE" style={{ height: 28, display: 'block' }} /><small>{label}</small>
      </Link>
      <span className="sp" />
      {me && (
        <div style={{ position: 'relative' }}>
          <button className="me" style={{ background: 'none', border: 0, cursor: 'pointer' }} onClick={() => setOpen(!open)} aria-expanded={open}>
            <span className="nm">{me.name || me.email}</span><span className="av">{ini(me.name || me.email)}</span>
          </button>
          {open && (
            <div className="card" style={{ position: 'absolute', right: 0, top: 40, width: 240, zIndex: 30, padding: 12, gap: 8 }}>
              {me.position && <span className="pos-tag lg" style={{ alignSelf: 'flex-start' }}>{me.position}</span>}
              <span className="mut ell" style={{ fontSize: 12 }}>{me.email}</span>
              <Link className="btn sm" href="/account" onClick={() => setOpen(false)}>บัญชีของฉัน</Link>
              {admin && <Link className="btn sm" href="/admin/line" onClick={() => setOpen(false)}>แอดมิน · LINE OA</Link>}
              <button className="btn sm" onClick={out}>ออกจากระบบ</button>
            </div>
          )}
        </div>
      )}
    </div></header>
  );
}
