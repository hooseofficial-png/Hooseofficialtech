#!/usr/bin/env node
// Import projects from the claude.ai prototype ("HOOSE ใช้งานภายใน" → ส่งออกข้อมูล JSON) into Supabase.
// Usage:  node scripts/import-artifact.mjs hoose-export.json owner@email.com
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (from .env.local or the shell).
// The owner must have logged in to the new system once, so their profile exists.
// Uploaded files (PDF/logo) in the prototype cannot be copied automatically; links (https) are imported.
import { readFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

if (existsSync('.env.local')) for (const l of readFileSync('.env.local', 'utf8').split('\n')) { const m = /^([A-Z_]+)=(.*)$/.exec(l.trim()); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
const [file, ownerEmail] = process.argv.slice(2);
if (!file || !ownerEmail) { console.error('usage: node scripts/import-artifact.mjs <export.json> <owner-email>'); process.exit(1); }
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const raw = JSON.parse(readFileSync(file, 'utf8'));
const projects = Array.isArray(raw) ? raw : raw.projects || [];
const n = v => { const x = Number(String(v ?? '').replace(/[^0-9.]/g, '')); return Number.isFinite(x) ? x : 0; };
const d = v => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : null);
const t = v => (/^\d{2}:\d{2}/.test(v || '') ? v.slice(0, 5) : null);
const https = v => (/^https:\/\//i.test(v || '') ? v : null);
const KIND = { shoot: 'Shoot Day · วันถ่ายทำ', brief: 'Brief before Production', meeting: 'General Meeting' };
const STATUS = new Set(['confirmed', 'pending', 'open']);
const must = (r, what) => { if (r.error) throw new Error(what + ': ' + r.error.message); return r.data; };

const { data: owner } = await db.from('profiles').select('id').eq('email', ownerEmail.toLowerCase()).maybeSingle();
if (!owner) { console.error(`ไม่พบผู้ใช้ ${ownerEmail} — ให้เข้าสู่ระบบใหม่ครั้งแรกก่อนแล้วรันอีกครั้ง`); process.exit(1); }

let done = 0, skipped = 0, notCopied = 0;
for (const item of projects) {
  const p = item.data || item;
  if (!p.name && !(p.crew || []).length && !(p.events || []).length) { skipped++; continue; }
  const proj = must(await db.from('projects').insert({
    name: p.name || '', brand: p.brand || '', agency: p.agency || '', company: p.company || '', director: p.director || '', producer: p.producer || '',
    pm_name: p.pm || '', pm_phone: p.pmPhone || '', deliverables: p.deliverables || '', type: p.type || '', campaign: p.campaign || '', synopsis: p.synopsis || '',
    start_date: d(p.start), end_date: d(p.end), queues: n(p.queues) || null, call_time: t(p.call), wrap_time: t(p.wrap),
    setting: p.setting || '', time_of_day: p.tod || '', special: p.special || '', locations: p.locs || [], line_group_link: p.groupLink || '',
    created_by: owner.id
  }).select('id').single(), 'project');
  const pid = proj.id;
  // the trigger made default document categories; replace them with the imported ones
  must(await db.from('doc_categories').delete().eq('project_id', pid), 'clear categories');
  const crew = (p.crew || []).map((c, i) => ({
    project_id: pid, dept: c.dept || 'other', position: c.pos || 'ตำแหน่ง', status: STATUS.has(c.status) ? c.status : 'open',
    name: (c.name || '').trim(), phone: c.phone || '', line_id: (c.line || '').trim(), rate_type: c.rate === 'flat' ? 'flat' : 'day',
    budget: n(c.budget), days: n(c.days) || 1, scope: c.scope || '', scope_url: https(c.scopeUrl) || '', scope_file_name: c.scopeAsset ? (c.scopeName || '') + ' (ไฟล์เดิม ต้องอัปโหลดใหม่)' : (c.scopeName || ''), sort: i
  }));
  if (crew.length) must(await db.from('crew_positions').insert(crew), 'crew');
  const ev = (p.events || []).map(e => ({ project_id: pid, type: ['shoot', 'brief', 'meeting'].includes(e.type) ? e.type : 'meeting', kind: e.kind || KIND[e.type] || 'General Meeting', date: d(e.date), time: t(e.time), title: e.title || '' }));
  if (ev.length) must(await db.from('events').insert(ev), 'events');
  for (const [i, c] of (p.docs || []).entries()) {
    const cat = must(await db.from('doc_categories').insert({ project_id: pid, title: c.title || 'เอกสาร', sort: i }).select('id').single(), 'category');
    const files = (c.files || []).concat(c.asset || c.url ? [{ asset: c.asset, url: c.url, name: c.fileName }] : []);
    const rows = [];
    for (const f of files) { if (https(f.url)) rows.push({ category_id: cat.id, project_id: pid, url: f.url, name: f.name || f.url }); else if (f.asset) notCopied++; }
    if (rows.length) must(await db.from('doc_files').insert(rows), 'files');
  }
  const b = p.budget || {};
  must(await db.from('budgets').update({ total: n(b.total), crew_alloc: n(b.crewAlloc), crew_alloc_draft: !!b.crewDraft, drafted: !!b.drafted }).eq('project_id', pid), 'budget');
  const lines = (b.lines || []).map((l, i) => ({ project_id: pid, key: l.key || null, name: l.name || '', amount: n(l.amt), draft: !!l.draft, sort: i }));
  if (lines.length) must(await db.from('budget_lines').insert(lines), 'budget lines');
  if (p.detailsLocked) must(await db.from('projects').update({ details_locked: true }).eq('id', pid), 'lock');
  if (p.logo) notCopied++;
  console.log(`✓ ${p.name || '(ไม่มีชื่อ)'} → ${pid} · ทีมงาน ${crew.length} · นัด ${ev.length} · งบ ${lines.length + 1} รายการ`);
  done++;
}
console.log(`\nนำเข้า ${done} โปรเจกต์ · ข้ามโปรเจกต์ว่าง ${skipped}` + (notCopied ? ` · ไฟล์ที่อัปโหลดไว้ในต้นแบบ ${notCopied} ไฟล์ต้องอัปโหลดใหม่ (โลโก้/PDF)` : ''));
