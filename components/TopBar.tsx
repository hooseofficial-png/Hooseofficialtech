'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { sb } from '@/lib/supabase/client';
import { ini } from '@/lib/domain';

export default function TopBar({ label = 'Production Management' }: { label?: string }) {
  const [me, setMe] = useState<{ email: string; name: string } | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    sb().auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: p } = await sb().from('profiles').select('full_name,email').eq('id', data.user.id).maybeSingle();
      setMe({ email: data.user.email || '', name: (p && p.full_name) || '' });
    });
  }, []);
  async function out() { await sb().auth.signOut(); window.location.href = '/login'; }
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
              <span className="mut ell" style={{ fontSize: 12 }}>{me.email}</span>
              <Link className="btn sm" href="/account" onClick={() => setOpen(false)}>บัญชีของฉัน</Link>
              <button className="btn sm" onClick={out}>ออกจากระบบ</button>
            </div>
          )}
        </div>
      )}
    </div></header>
  );
}
