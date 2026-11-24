'use client';
// A4 PDF of the สรุปผล page: each section is laid out as real A4 pages (794×1123 px),
// captured with html2canvas and stitched with jsPDF. HOOSE logo in every header, page numbers in every footer.
import {
  DEPTS, ET, STATUS, budgetAllocated, crewAllCost, crewCost, crewLine, dateRange, daysTo, docOk, evKey, firstShoot,
  fmtL, hm, money, num, readiness, readyPct, suggestion, type ProjectData
} from './domain';

type Row = string[] | { tot: true; cells: string[] };
type Block = { html: string } | { table: true; head: string[]; rows: Row[]; cls: string; cap: string; right: number[] };
interface Section { title: string; en: string; blocks: (Block | null)[] }

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const T_ = (head: string[], rows: Row[], o: { cls?: string; cap?: string; right?: number[] } = {}): Block => ({ table: true, head, rows, cls: o.cls || '', cap: o.cap || '', right: o.right || [] });
const H_ = (html: string): Block => ({ html });
const kv = (cap: string, pairs: [string, string | null | undefined][]) => T_(['', ''], pairs.map(([k, v]) => [k, v || '—']), { cls: 'pp-kv', cap });
const kpis = (items: [string, string][]) => H_('<div class="pp-kpi">' + items.map(([v, l]) => `<div><b>${esc(v)}</b>${esc(l)}</div>`).join('') + '</div>');
const evRows = (d: ProjectData) => d.events.slice().sort((a, b) => evKey(a).localeCompare(evKey(b))).map(e => [fmtL(e.date) || 'ยังไม่ระบุวัน', hm(e.time) || '—', e.kind || ET[e.type][0], e.title || '—']);

function sections(d: ProjectData): Section[] {
  const p = d.project; const m = d.withMoney; const cr = d.crew; const n = daysTo(firstShoot(d));
  const T = num(d.budget?.total); const al = budgetAllocated(d); const cl = crewLine(d); const pc = (v: number) => (T ? ((v / T) * 100).toFixed(1) + '%' : '—');
  const out: Section[] = [];
  out.push({ title: 'สรุปโปรเจกต์', en: 'PROJECT SUMMARY', blocks: [
    kpis([[n == null ? '–' : String(Math.max(0, n)), 'วันก่อนวันถ่ายวันแรก'], [readyPct(d) + '%', 'ความพร้อมพรีโปรดักชัน'], [cr.filter(c => c.status === 'confirmed').length + '/' + cr.length, 'ทีมงานยืนยัน'], [d.docs.filter(docOk).length + '/' + d.docs.length, 'หมวดเอกสารมีไฟล์']]),
    T_(['รายการตรวจ', 'สถานะ', 'ผล'], readiness(d).map(([, l, r, v]) => [l, r >= 1 ? '✓ ครบ' : r > 0 ? 'บางส่วน' : 'ยังไม่ทำ', v]), { cap: 'ความพร้อมพรีโปรดักชัน' }),
    m ? T_(['สถานะ', 'จำนวน', 'งบรวม'], (Object.keys(STATUS) as (keyof typeof STATUS)[]).map(k => { const l = cr.filter(c => c.status === k); return [STATUS[k][0], l.length + ' ตำแหน่ง', money(l.reduce((a, c) => a + crewCost(c), 0))]; }), { cap: 'ทีมงาน', right: [1, 2] })
      : T_(['สถานะ', 'จำนวน'], (Object.keys(STATUS) as (keyof typeof STATUS)[]).map(k => [STATUS[k][0], cr.filter(c => c.status === k).length + ' ตำแหน่ง']), { cap: 'ทีมงาน', right: [1] }),
    m ? kv('งบประมาณ', [['งบรวมที่ได้รับ', T ? money(T) : 'ยังไม่ตั้ง'], ['จัดสรรแล้ว', money(al) + (T ? ' (' + pc(al) + ')' : '')], [T && al > T ? 'เกินงบ' : 'คงเหลือ', T ? money(Math.abs(T - al)) : '—']]) : null
  ] });
  out.push({ title: 'รายละเอียดโปรเจกต์', en: 'PROJECT DETAILS', blocks: [
    kv('ลูกค้าและแบรนด์', [['แบรนด์ / ลูกค้า', p.brand], ['เอเจนซี่', p.agency], ['บริษัทโปรดักชัน', p.company], ['ผู้กำกับ', p.director], ['โปรดิวเซอร์', p.producer], ['Production Manager', [p.pm_name, p.pm_phone].filter(Boolean).join(' · ')], ['ชิ้นงานที่ส่งมอบ', p.deliverables]]),
    kv('ข้อมูลพื้นฐาน', [['สถานะรายละเอียด', p.details_locked ? 'ยืนยันแล้ว' + (p.locked_at ? ' · ' + fmtL(p.locked_at.slice(0, 10)) : '') : 'ร่าง (ยังไม่ยืนยัน)'], ['ชื่อโปรเจกต์', p.name], ['ประเภท', p.type], ['แคมเปญ / เลขที่งาน', p.campaign], ['เรื่องย่อ', p.synopsis]]),
    kv('การถ่ายทำ', [['วันถ่าย', dateRange(p)], ['จำนวนคิว', p.queues ? p.queues + ' คิว' : ''], ['เวลาคอล', hm(p.call_time)], ['เลิกกองโดยประมาณ', hm(p.wrap_time)], ['รูปแบบกอง', [p.setting, p.time_of_day].filter(Boolean).join(' · ')], ['ข้อกำหนดพิเศษ', p.special]]),
    T_(['#', 'สถานที่'], p.locations.map((l, i) => [String(i + 1), l]), { cap: 'สถานที่' })
  ] });
  const rows: Row[] = [];
  DEPTS.forEach(([dk, dn]) => cr.filter(c => (c.dept || 'other') === dk).forEach(c => {
    const base = [dn, c.position, c.name || (c.status === 'open' ? '(รอคน)' : '—'), [c.phone, c.line_id ? 'LINE ' + c.line_id : ''].filter(Boolean).join('\n') || '—', STATUS[c.status][0]];
    rows.push(m ? base.concat([num(c.budget) ? money(c.budget) + (c.rate_type === 'day' ? '/วัน × ' + (num(c.days) || 1) : ' เหมา') : '—', money(crewCost(c)), c.scope_file_name || c.scope || '—']) : base.concat([c.scope_file_name || c.scope || '—']));
  }));
  if (m) rows.push({ tot: true, cells: ['รวม', cr.length + ' ตำแหน่ง', '', '', cr.filter(c => c.status === 'confirmed').length + ' ยืนยัน', '', money(crewAllCost(d)), ''] });
  out.push({ title: 'รายชื่อทีมงาน', en: 'CREW LIST', blocks: [
    kpis([[String(cr.filter(c => c.status === 'confirmed').length), 'ยืนยันแล้ว'], [String(cr.filter(c => c.status === 'pending').length), 'รอยืนยัน'], [String(cr.filter(c => c.status === 'open').length), 'ตำแหน่งว่าง'], [m ? money(cl) : String(cr.length), m ? 'งบทีมงาน' : 'ตำแหน่งทั้งหมด']]),
    m ? T_(['ฝ่าย', 'ตำแหน่ง', 'ชื่อ', 'ติดต่อ', 'สถานะ', 'เรท', 'รวม', 'Workscope'], rows, { cap: 'ทีมงานทั้งหมด', right: [6] }) : T_(['ฝ่าย', 'ตำแหน่ง', 'ชื่อ', 'ติดต่อ', 'สถานะ', 'Workscope'], rows, { cap: 'ทีมงานทั้งหมด' })
  ] });
  out.push({ title: 'ตารางนัดหมายทีม', en: 'TEAM SCHEDULE', blocks: [
    kpis([...(Object.keys(ET) as (keyof typeof ET)[]).map(k => [String(d.events.filter(e => e.type === k).length), ET[k][0]] as [string, string]), [String(d.events.length), 'นัดทั้งหมด']]),
    T_(['วันที่', 'เวลา', 'ประเภท', 'หัวข้อ / สถานที่'], evRows(d), { cap: 'นัดหมายทั้งหมด' })
  ] });
  out.push({ title: 'รายการเอกสาร', en: 'DOCUMENT CHECKLIST', blocks: [T_(['หมวดเอกสาร', 'สถานะ', 'ไฟล์ / ลิงก์'], d.docs.map(c => [c.title, c.files.length ? '✓ ' + c.files.length + ' ไฟล์' : 'ยังไม่มี', c.files.map(f => f.name || f.url || '').join('\n') || '—']), { cap: 'คลังเอกสาร' })] });
  if (m) {
    const br: Row[] = [['งบทีมงาน', money(cl), pc(cl)] as string[]].concat((d.lines || []).map(l => [l.name || '—', money(l.amount), pc(num(l.amount))]));
    br.push({ tot: true, cells: ['รวมที่จัดสรร', money(al), pc(al)] });
    if (T) br.push({ tot: true, cells: [al > T ? 'เกินงบ' : 'คงเหลือ', money(Math.abs(T - al)), pc(Math.abs(T - al))] });
    out.push({ title: 'งบประมาณโปรเจกต์', en: 'BUDGET', blocks: [
      kpis([[T ? money(T) : '—', 'งบรวมที่ได้รับ'], [pc(al), 'จัดสรรแล้ว'], [money(cl), 'งบทีมงาน'], [T ? money(T - al) : '—', 'คงเหลือ']]),
      T_(['รายการ', 'จำนวนเงิน', '% ของงบรวม'], br, { cap: 'รายการงบ', right: [1, 2] }),
      T ? T_(['หมวด', 'สัดส่วนแนะนำ', 'จำนวนเงินแนะนำ'], suggestion(d).map(x => [x.name, x.pct + '%', money(x.amount)]), { cap: 'สัดส่วนที่แนะนำ (' + (p.type || 'TVC / โฆษณา') + ')', right: [1, 2] }) : null
    ] });
  }
  return out;
}

function table(b: Extract<Block, { table: true }>, withCap: boolean) {
  const w = document.createElement('div');
  w.innerHTML = (withCap && b.cap ? `<div class="pp-h">${esc(b.cap)}</div>` : '') + `<table class="pp-t ${b.cls}">` +
    (b.cls === 'pp-kv' ? '' : '<thead><tr>' + b.head.map((h, i) => `<th${b.right.includes(i) ? ' class="r"' : ''}>${esc(h)}</th>`).join('') + '</tr></thead>') + '<tbody></tbody></table>';
  return w;
}
function row(b: Extract<Block, { table: true }>, r: Row) {
  const tr = document.createElement('tr'); const cells = Array.isArray(r) ? r : r.cells; if (!Array.isArray(r)) tr.className = 'tot';
  tr.innerHTML = cells.map((c, i) => `<td${b.right.includes(i) ? ' class="r"' : ''}>${esc(c).replace(/\n/g, '<br>')}</td>`).join('');
  return tr;
}

function layout(root: HTMLElement, s: Section, d: ProjectData, author: string): HTMLElement[] {
  const p = d.project; const pages: HTMLElement[] = []; let body!: HTMLElement;
  const now = new Date();
  const gen = now.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  const meta: [string, string][] = [['โปรเจกต์', p.name || 'ไม่มีชื่อ'], ['ลูกค้า', [p.brand, p.agency].filter(Boolean).join(' · ') || '—'], ['วันถ่าย', (dateRange(p) || '—') + (p.queues ? ' · ' + p.queues + ' คิว' : '')], ['ผู้จัดทำ', author || p.pm_name || '—']];
  const newPage = () => {
    const pg = document.createElement('div'); pg.className = 'pp-page';
    pg.innerHTML = `<div class="pp-head"><img alt="HOOSE" src="/hoose-logo.png"><div class="pp-title"><span>${esc(s.en)}</span><b>${esc(s.title)}</b></div></div>` +
      '<div class="pp-meta">' + meta.map(([k, v]) => `<div><span>${esc(k)}</span>${esc(v)}</div>`).join('') + '</div><div class="pp-body"></div>' +
      `<div class="pp-foot"><span><b>HOOSE™</b> · Production Management · สร้างเมื่อ ${esc(gen)}</span><span class="pp-pn"></span></div>`;
    root.appendChild(pg); pages.push(pg); body = pg.querySelector('.pp-body') as HTMLElement;
  };
  const fits = () => body.scrollHeight <= body.clientHeight + 1;
  newPage();
  s.blocks.forEach(b => {
    if (!b) return;
    if ('table' in b) {
      if (!b.rows.length) b.rows = [b.head.map((_, i) => (i ? '' : 'ยังไม่มีข้อมูล'))];
      let w = table(b, true); body.appendChild(w); let tb = w.querySelector('tbody')!;
      if (!fits()) { w.remove(); newPage(); w = table(b, true); body.appendChild(w); tb = w.querySelector('tbody')!; }
      b.rows.forEach(r => {
        const tr = row(b, r); tb.appendChild(tr);
        if (!fits()) {
          tr.remove(); const empty = !tb.children.length; if (empty) w.remove();
          newPage(); w = table(b, empty); body.appendChild(w); tb = w.querySelector('tbody')!; tb.appendChild(tr);
        }
      });
    } else {
      const w = document.createElement('div'); w.innerHTML = b.html; body.appendChild(w);
      if (!fits() && body.children.length > 1) { w.remove(); newPage(); body.appendChild(w); }
    }
  });
  return pages;
}

/** Build and download the full สรุปผล PDF. */
export async function downloadSummaryPdf(d: ProjectData, author: string, onProgress?: (t: string) => void) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
  const root = document.createElement('div'); root.className = 'pp-root'; document.body.appendChild(root);
  try {
    let pages: HTMLElement[] = [];
    sections(d).forEach(s => { pages = pages.concat(layout(root, s, d, author)); });
    pages.forEach((pg, i) => { (pg.querySelector('.pp-pn') as HTMLElement).textContent = 'หน้า ' + (i + 1) + ' / ' + pages.length; });
    try { await (document as any).fonts.ready; } catch { /* fonts optional */ }
    await Promise.all([...root.querySelectorAll('img')].map(img => (img as HTMLImageElement).complete ? 0 : new Promise(r => { img.addEventListener('load', r); img.addEventListener('error', r); })));
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    for (let i = 0; i < pages.length; i++) {
      onProgress?.('กำลังสร้าง PDF… หน้า ' + (i + 1) + '/' + pages.length);
      const c = await html2canvas(pages[i], { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true });
      if (i) pdf.addPage();
      pdf.addImage(c.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 210, 297);
    }
    pdf.setProperties({ title: 'สรุปผล · ' + (d.project.name || 'โปรเจกต์'), creator: 'HOOSE', author: author || 'HOOSE' });
    const name = ('HOOSE_สรุปผล_' + (d.project.name || 'project')).replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '_') + '_' + new Date().toISOString().slice(0, 10) + '.pdf';
    const url = URL.createObjectURL(pdf.output('blob'));
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } finally { root.remove(); }
}
