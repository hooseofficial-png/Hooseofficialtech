'use client';
import { useState } from 'react';
import { copyText, toast } from '@/lib/ui';
import type { Role } from '@/lib/domain';

type Result = { email: string; status: string; emailed: boolean; link: string; error?: string };
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const ROLE_LABEL: Record<Role, string> = { owner: 'Owner · ทุกอย่าง', editor: 'Editor · แก้ไขทุกหน้า', viewer: 'Viewer · ดูหน้าสรุปผล' };

/** Chip-style multi e-mail invite ("Enter email addresses (or paste multiple)"). */
export default function InviteBox({ projectId, canOwner = false, onDone, compact = false }: { projectId: string; canOwner?: boolean; onDone?: () => void; compact?: boolean }) {
  const [chips, setChips] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [role, setRole] = useState<Role>('editor');
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);

  function add(text: string) {
    const parts = text.split(/[\s,;]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
    const good = parts.filter(p => EMAIL.test(p)); const bad = parts.filter(p => !EMAIL.test(p));
    if (good.length) setChips(c => Array.from(new Set([...c, ...good])));
    setDraft(bad.join(' '));
    if (bad.length && good.length) toast('บางอีเมลรูปแบบไม่ถูกต้อง');
  }
  async function send() {
    const all = draft.trim() ? [...chips, ...draft.split(/[\s,;]+/).filter(e => EMAIL.test(e.toLowerCase())).map(e => e.toLowerCase())] : chips;
    if (!all.length) { toast('ใส่อีเมลอย่างน้อย 1 อีเมล'); return; }
    setBusy(true);
    const r = await fetch('/api/invite', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId, emails: all, role }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { toast('เชิญไม่สำเร็จ ลองอีกครั้ง'); return; }
    const res: Result[] = j.results || []; setResults(res); setChips([]); setDraft('');
    const sent = res.filter(x => x.emailed).length; const ok = res.filter(x => x.status !== 'error').length;
    toast(sent ? `ส่งอีเมลเชิญแล้ว ${sent} คน` : ok ? `บันทึกคำเชิญ ${ok} คน · คัดลอกลิงก์เชิญส่งให้ได้เลย` : 'เชิญไม่สำเร็จ');
    onDone?.();
  }

  return (
    <div className="invite-box">
      <div className="chips-in" onClick={e => (e.currentTarget.querySelector('input') as HTMLInputElement)?.focus()}>
        {chips.map(c => <span key={c} className="echip">{c}<button type="button" aria-label={'ลบ ' + c} onClick={() => setChips(chips.filter(x => x !== c))}>×</button></span>)}
        <input value={draft} placeholder={chips.length ? '' : 'ใส่อีเมล (วางหลายอีเมลพร้อมกันได้)'} aria-label="อีเมลที่จะเชิญ"
          onChange={e => { const v = e.target.value; if (/[\s,;]$/.test(v)) add(v); else setDraft(v); }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (draft.trim()) add(draft); else send(); } else if (e.key === 'Backspace' && !draft && chips.length) setChips(chips.slice(0, -1)); }}
          onPaste={e => { e.preventDefault(); add(draft + ' ' + e.clipboardData.getData('text')); }}
          onBlur={() => draft.trim() && add(draft)} />
      </div>
      <div className="row w">
        <select className="in-t" style={{ flex: 1, minWidth: 200 }} value={role} onChange={e => setRole(e.target.value as Role)} aria-label="บทบาท">
          {(Object.keys(ROLE_LABEL) as Role[]).filter(k => k !== 'owner' || canOwner).map(k => <option key={k} value={k}>{ROLE_LABEL[k]}</option>)}
        </select>
        <button type="button" className="btn p" onClick={send} disabled={busy}>{busy ? 'กำลังส่ง…' : 'ส่งคำเชิญ'}</button>
      </div>
      {!compact && <span className="hint">ชวนทีมมาด้วย งานพรีโปรดักชันจะเดินเร็วขึ้นมาก · PM / Producer → Editor · ทีมงานทั่วไป → Viewer</span>}
      {results && results.length > 0 && (
        <div className="list fade-in">{results.map(x => (
          <div className="li" key={x.email}>
            <span className="av">{x.email[0].toUpperCase()}</span>
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="ell" style={{ fontWeight: 600 }}>{x.email}</div>
              <div className="mut" style={{ fontSize: 12 }}>
                {x.status === 'error' ? 'เชิญไม่สำเร็จ: ' + (x.error || '') : (x.status === 'added' ? 'เพิ่มเข้าโปรเจกต์แล้ว' : 'รอสมัครสมาชิก') + (x.emailed ? ' · ส่งอีเมลแล้ว' : ' · ยังไม่ได้ส่งอีเมล ส่งลิงก์ให้เอง')}
              </div>
            </div>
            {x.status !== 'error' && !x.emailed && <button type="button" className="btn sm" onClick={() => copyText(x.link, 'คัดลอกลิงก์เชิญแล้ว')}>คัดลอกลิงก์เชิญ</button>}
            {x.emailed && <span className="chip lb">✓ ส่งแล้ว</span>}
          </div>))}
        </div>
      )}
    </div>
  );
}
