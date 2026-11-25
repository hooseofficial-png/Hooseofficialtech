// HOOSE domain: types, constants and pure helpers shared by every page.

export type Role = 'owner' | 'editor' | 'viewer';
export type CrewStatus = 'confirmed' | 'pending' | 'open';
export type EventType = 'shoot' | 'brief' | 'meeting';

export interface Project {
  id: string; name: string; brand: string; agency: string; company: string; director: string; producer: string;
  pm_name: string; pm_phone: string; deliverables: string; type: string; campaign: string; synopsis: string;
  start_date: string | null; end_date: string | null; queues: number | null; call_time: string | null; wrap_time: string | null;
  setting: string; time_of_day: string; special: string; locations: string[]; logo_path: string | null; line_group_link: string;
  details_locked: boolean; locked_at: string | null; share_enabled: boolean; share_budget: boolean; party_code?: string;
  created_at: string; updated_at: string;
}
export interface Crew {
  id: string; project_id: string; dept: string; position: string; status: CrewStatus; name: string; phone: string; line_id: string;
  rate_type?: 'day' | 'flat'; budget?: number; days?: number; scope: string; scope_file_path: string | null; scope_file_name: string; scope_url: string; sort: number;
}
export interface HEvent { id: string; project_id: string; kind: string; type: EventType; date: string | null; time: string | null; title: string; }
export interface DocFile { id: string; category_id?: string; name: string; url: string | null; storage_path: string | null; size_bytes?: number | null; created_at?: string; }
export interface DocCategory { id: string; title: string; sort?: number; files: DocFile[]; }
export interface Budget { project_id: string; total: number; crew_alloc: number; crew_alloc_draft: boolean; drafted: boolean; }
export interface BudgetLine { id: string; project_id: string; key: string | null; name: string; amount: number; draft: boolean; sort: number; }
export interface Announcement { id: string; status: string; created_at: string; positions?: number; position_ids?: string[]; message?: string; }

/** Everything about one project, as the pages and the PDF need it. */
export interface ProjectData {
  project: Project; crew: Crew[]; events: HEvent[]; docs: DocCategory[];
  budget: Budget | null; lines: BudgetLine[] | null; announcements: Announcement[]; withMoney: boolean; members?: number;
}

export const DEPTS: [string, string, string[]][] = [
  ['dir', 'ฝ่ายกำกับ', ['Director', '1st AD', '2nd AD', 'Script Supervisor']],
  ['cam', 'กล้อง', ['DOP', 'Camera Operator', '1st AC', '2nd AC', 'DIT']],
  ['light', 'ไฟและกริป', ['Gaffer', 'Best Boy', 'Electrician', 'Key Grip']],
  ['art', 'ฝ่ายศิลป์และพร็อพ', ['Production Designer', 'Art Director', 'Props Master', 'Set Dresser']],
  ['ward', 'เสื้อผ้าและแต่งหน้า', ['Stylist', 'Make-up Artist', 'Hair Stylist']],
  ['sound', 'เสียง', ['Sound Recordist', 'Boom Operator']],
  ['prod', 'โปรดักชัน', ['Line Producer', 'Production Manager', 'Location Manager', 'Production Assistant']],
  ['other', 'อื่น ๆ', []]
];
export const deptName = (k: string) => (DEPTS.find(d => d[0] === k) || DEPTS[DEPTS.length - 1])[1];
export const RATE: Record<string, number> = { 'Director': 45000, '1st AD': 9000, '2nd AD': 5000, 'Script Supervisor': 6000, 'DOP': 30000, 'Camera Operator': 8000, '1st AC': 6000, '2nd AC': 4000, 'DIT': 5000, 'Gaffer': 7000, 'Best Boy': 4500, 'Electrician': 3500, 'Key Grip': 4500, 'Production Designer': 15000, 'Art Director': 9000, 'Props Master': 6000, 'Set Dresser': 4000, 'Stylist': 8000, 'Make-up Artist': 6000, 'Hair Stylist': 5000, 'Sound Recordist': 7000, 'Boom Operator': 4000, 'Line Producer': 12000, 'Production Manager': 10000, 'Location Manager': 6000, 'Production Assistant': 2500 };
export const PRESETS: Record<string, string[]> = {
  small: ['dir:Director', 'cam:DOP', 'cam:1st AC', 'light:Gaffer', 'art:Art Director', 'ward:Stylist', 'sound:Sound Recordist', 'prod:Production Manager'],
  medium: ['dir:Director', 'dir:1st AD', 'cam:DOP', 'cam:Camera Operator', 'cam:1st AC', 'cam:DIT', 'light:Gaffer', 'light:Best Boy', 'art:Production Designer', 'art:Props Master', 'ward:Stylist', 'ward:Make-up Artist', 'sound:Sound Recordist', 'prod:Line Producer', 'prod:Production Manager', 'prod:Production Assistant']
};
export const STATUS: Record<CrewStatus, [string, string]> = { confirmed: ['ยืนยันแล้ว', 'b'], pending: ['รอยืนยัน', 'lb'], open: ['Open Call', 'k'] };
export const ET: Record<EventType, [string, string]> = { shoot: ['ถ่ายทำ', 'var(--blue)'], brief: ['บรีฟ', 'var(--ink)'], meeting: ['ประชุม', '#8B8E9C'] };
export const KINDS: [string, EventType][] = [['Kick-Off Meeting', 'meeting'], ['Inner Team Meeting', 'meeting'], ['General Meeting', 'meeting'], ['Client Meeting', 'meeting'], ['Brief before Production', 'brief'], ['Shoot Day · วันถ่ายทำ', 'shoot']];
export const TYPES = ['TVC / โฆษณา', 'ออนไลน์คอนเทนต์', 'มิวสิกวิดีโอ', 'ภาพยนตร์', 'ซีรีส์', 'สารคดี', 'ถ่ายภาพนิ่ง'];
export const SPLIT_CATS: [string, string][] = [
  ['crew', 'งบทีมงาน (Crew)'], ['phs', 'ค่าบริการโปรดักชันเฮาส์ (Production House Service)'], ['equip', 'อุปกรณ์กล้อง ไฟ กริป'], ['loc', 'สถานที่และใบอนุญาต'],
  ['art', 'ฝ่ายศิลป์ พร็อพ เสื้อผ้า'], ['talent', 'นักแสดงและแคสติ้ง'], ['logi', 'เดินทาง อาหาร ที่พัก'], ['cont', 'สำรองฉุกเฉิน (Contingency)']
];
export const SPLITS: Record<string, number[]> = {
  'TVC / โฆษณา': [40, 20, 12, 7, 7, 6, 5, 3], 'ออนไลน์คอนเทนต์': [40, 20, 12, 8, 7, 5, 5, 3], 'มิวสิกวิดีโอ': [38, 20, 14, 8, 9, 4, 4, 3],
  'ถ่ายภาพนิ่ง': [35, 20, 15, 10, 8, 6, 3, 3], 'ภาพยนตร์': [45, 15, 12, 8, 7, 6, 4, 3], 'ซีรีส์': [45, 15, 12, 8, 7, 6, 4, 3], 'สารคดี': [45, 15, 14, 8, 3, 2, 10, 3]
};
export const DOW = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

// ---------- format ----------
export const pad = (n: number) => String(n).padStart(2, '0');
export const iso = (d: Date) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const todayISO = () => iso(new Date());
export const D = (s: string) => new Date(s + 'T00:00:00');
export const fmtS = (s?: string | null) => (s ? D(s).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) : '');
export const fmtL = (s?: string | null) => (s ? D(s).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: '2-digit' }) : '');
export const hm = (t?: string | null) => (t ? t.slice(0, 5) : '');
export const money = (n: number | string | null | undefined) => '฿' + Math.round(Number(n) || 0).toLocaleString('en-US');
export const num = (v: unknown) => { const n = Number(String(v ?? '').replace(/[^0-9.]/g, '')); return isFinite(n) ? n : 0; };
export const safeUrl = (u?: string | null) => (/^https:\/\//i.test(String(u || '').trim()) ? String(u).trim() : '');
export const ini = (name?: string | null) => String(name || '?').trim().split(/\s+/).slice(0, 2).map(x => (x.replace(/^[เแโใไ]/, '') || x)[0] || '').join('').toUpperCase() || '?';
export const daysTo = (s?: string | null) => (s ? Math.round((D(s).getTime() - D(todayISO()).getTime()) / 864e5) : null);
export const evKey = (e: HEvent) => (e.date || '9999-12-31') + (e.time || '99:99');
export const evLabel = (e: HEvent) => e.title || e.kind || ET[e.type][0];
export const dateRange = (p: Project) => (!p.start_date ? '' : p.end_date && p.end_date !== p.start_date ? fmtS(p.start_date) + ' – ' + fmtS(p.end_date) : fmtS(p.start_date));

// ---------- derived ----------
export const crewCost = (c: Crew) => { const b = num(c.budget); return c.rate_type === 'flat' ? b : b * (num(c.days) || 1); };
export const shootDays = (d: ProjectData) => d.events.filter(e => e.type === 'shoot' && e.date).sort((a, b) => evKey(a).localeCompare(evKey(b)));
export const firstShoot = (d: ProjectData) => { const s = shootDays(d); return s.length ? s[0].date : d.project.start_date; };
export const crewAllCost = (d: ProjectData) => d.crew.reduce((a, c) => a + crewCost(c), 0);
export const crewCommitted = (d: ProjectData) => d.crew.filter(c => c.status !== 'open').reduce((a, c) => a + crewCost(c), 0);
export const crewLine = (d: ProjectData) => num(d.budget?.crew_alloc) || crewAllCost(d);
export const budgetAllocated = (d: ProjectData) => crewLine(d) + (d.lines || []).reduce((a, l) => a + num(l.amount), 0);
export const docOk = (c: DocCategory) => c.files.length > 0;

export function readiness(d: ProjectData): [string, string, number, string][] {
  const p = d.project;
  const fields = [p.name, p.start_date, p.locations.length, p.queues, p.brand, p.director || p.producer];
  const fN = fields.filter(Boolean).length;
  const sd = shootDays(d); const q = num(p.queues);
  const cf = d.crew.filter(c => c.status === 'confirmed').length; const open = d.crew.filter(c => c.status === 'open').length;
  const dN = d.docs.filter(docOk).length;
  const meet = d.events.some(e => e.type !== 'shoot' && e.date); const meetTbd = d.events.some(e => e.type !== 'shoot');
  const queued = d.announcements.length > 0;
  const rows: [string, string, number, string][] = [
    ['details', 'รายละเอียดโปรเจกต์', p.details_locked ? 1 : fN / fields.length, p.details_locked ? 'ยืนยันแล้ว' : fN + '/' + fields.length],
    ['calendar', 'นัดบรีฟ / ประชุมเตรียมงาน', meet ? 1 : 0, meet ? 'นัดแล้ว' : meetTbd ? 'ยังไม่ระบุวัน' : 'ยังไม่นัด'],
    ['calendar', 'วันถ่ายในปฏิทินครบคิว', q ? Math.min(1, sd.length / q) : sd.length ? 1 : 0, sd.length + (q ? '/' + q + ' คิว' : ' วัน')],
    ['crew', 'ทีมงานยืนยัน', d.crew.length ? cf / d.crew.length : 0, d.crew.length ? cf + '/' + d.crew.length : 'ยังไม่มีตำแหน่ง'],
    ['crew', 'ประกาศหาตำแหน่งที่ว่าง', d.crew.length ? (open === 0 || queued ? 1 : 0) : 0, !d.crew.length ? 'ยังไม่มีตำแหน่ง' : open === 0 ? 'ไม่มีที่ว่าง' : queued ? 'เข้าคิวประกาศแล้ว' : open + ' ที่ว่าง'],
    ['docs', 'อัปโหลดเอกสาร', d.docs.length ? dN / d.docs.length : 0, dN + '/' + d.docs.length]
  ];
  if (d.withMoney) {
    const T = num(d.budget?.total); const al = budgetAllocated(d);
    rows.push(['budget', 'งบไม่เกินงบรวม', T ? (al <= T ? 1 : 0.5) : 0, T ? (al <= T ? Math.round((al / T) * 100) + '% จัดสรร' : 'เกินงบรวม') : 'ยังไม่ตั้งงบ']);
  }
  const mem = d.members || 0;
  rows.push(['share', 'ทีมเข้าร่วมด้วย Party Code', mem > 1 ? 1 : 0, mem > 1 ? (mem - 1) + ' คนเข้าร่วม' : 'ยังไม่มีทีมเข้าร่วม']);
  return rows;
}
export const readyPct = (d: ProjectData) => { const r = readiness(d); return Math.round((r.reduce((a, x) => a + x[2], 0) / r.length) * 100); };

export const splitFor = (p: Project) => SPLITS[p.type] || SPLITS['TVC / โฆษณา'];
export const suggestion = (d: ProjectData) => { const T = num(d.budget?.total); const sp = splitFor(d.project); return SPLIT_CATS.map(([key, name], i) => ({ key, name, pct: sp[i], amount: Math.round((T * sp[i]) / 100) })); };

export function confirmMsg(p: Project, c: Crew) {
  return [
    'HOOSE · ' + (p.name || 'โปรเจกต์'), 'สวัสดีค่ะ/ครับ คุณ' + (c.name || ''),
    c.status === 'pending' ? 'ขอยืนยันตำแหน่ง ' + c.position + ' กรุณาตอบกลับว่ารับงานหรือไม่' : 'ตำแหน่ง ' + c.position + ' ของคุณได้รับการยืนยันแล้ว',
    p.start_date ? 'วันถ่าย: ' + dateRange(p) + (p.queues ? ' (' + p.queues + ' คิว)' : '') : '', p.locations[0] ? 'สถานที่: ' + p.locations[0] : '',
    p.call_time ? 'เวลาคอล: ' + hm(p.call_time) : '', num(c.budget) ? 'ค่าตัว: ' + money(c.budget) + (c.rate_type === 'day' ? ' / วัน' : ' (เหมา)') : '',
    c.status === 'confirmed' && safeUrl(p.line_group_link) ? 'เข้ากลุ่ม LINE ทีม: ' + safeUrl(p.line_group_link) : ''
  ].filter(Boolean).join('\n');
}
export function ocMessage(d: ProjectData) {
  const p = d.project; const open = d.crew.filter(c => c.status === 'open');
  const head = ['ประกาศหาทีมงานเพิ่ม · ' + (p.name || 'โปรเจกต์'), [p.type, p.brand].filter(Boolean).join(' · '), p.synopsis].filter(Boolean);
  const info = [p.start_date ? 'วันถ่าย: ' + dateRange(p) + (p.queues ? ' (' + p.queues + ' คิว)' : '') : '', p.locations.length ? 'สถานที่: ' + p.locations.join(', ') : '',
    [p.setting, p.time_of_day].filter(Boolean).join(' · '), p.call_time ? 'เวลาคอล: ' + hm(p.call_time) : ''].filter(Boolean);
  const pos = ['ตำแหน่งที่เปิดรับ:'].concat(open.map(c => '• ' + c.position + (num(c.budget) ? ' — ' + money(c.budget) + (c.rate_type === 'day' ? '/วัน' + (num(c.days) ? ' × ' + num(c.days) + ' วัน' : '') : ' เหมา') : '') + (c.scope ? ' · ' + c.scope : '')));
  const tail = [p.special ? 'หมายเหตุ: ' + p.special : '', 'ผู้สนใจส่งชื่อ ตำแหน่ง และผลงาน' + (p.pm_name ? ' · ติดต่อ ' + p.pm_name + (p.pm_phone ? ' ' + p.pm_phone : '') : '')].filter(Boolean);
  return [head, info, pos, tail].filter(x => x.length).map(x => x.join('\n')).join('\n\n');
}
export function gcalLink(p: Project, e: HEvent) {
  if (!e.date) return '';
  const d = e.date.replace(/-/g, ''); let dates: string;
  if (e.time) { const [h, m] = e.time.split(':').map(Number); dates = d + 'T' + pad(h) + pad(m) + '00/' + d + 'T' + pad(Math.min(23, h + 2)) + pad(m) + '00'; }
  else { const n = D(e.date); n.setDate(n.getDate() + 1); dates = d + '/' + iso(n).replace(/-/g, ''); }
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent((p.name || 'HOOSE') + ' · ' + evLabel(e)) + '&dates=' + dates + '&ctz=Asia/Bangkok&details=' + encodeURIComponent('HOOSE · ' + (e.kind || ET[e.type][0]));
}
export const lineShare = (t: string) => 'https://line.me/R/share?text=' + encodeURIComponent(t);

/** Normalise the JSON returned by project_summary() / shared_summary(). */
export function fromSummaryJson(j: any): ProjectData {
  return {
    project: j.project, crew: j.crew || [], events: j.events || [],
    docs: (j.docs || []).map((c: any) => ({ id: c.id, title: c.title, files: c.files || [] })),
    budget: j.budget || null, lines: j.budget_lines || null, announcements: j.announcements || [], withMoney: !!j.with_money
  };
}

/** Job titles a HOOSE account can hold (stored in profiles.position). */
export const POSITIONS = ['Director', 'Producer', 'Production Manager'] as const;
export const POSITION_TH: Record<string, string> = { Director: 'ผู้กำกับ', Producer: 'โปรดิวเซอร์', 'Production Manager': 'ผู้จัดการกองถ่าย' };

/** Positions a member can hold inside one project (account position + common crew / client roles). */
export const PROJECT_POSITIONS = ['Production Manager', 'Producer', 'Director', 'Assistant Director', 'Director of Photography', 'Art Director', 'Production Coordinator', 'ทีมงาน (Crew)', 'ลูกค้า / แบรนด์', 'เอเจนซี่'] as const;
export const POSITION_DESC: Record<string, string> = {
  'Production Manager': 'วางแผนพรีโปรดักชัน ทีมงาน คิวถ่าย งบ และเอกสารทั้งหมด',
  Producer: 'ดูแลลูกค้า งบประมาณ และให้งานเดินตามแผน',
  Director: 'ดูแลความคิดสร้างสรรค์ Treatment และการถ่ายทำ',
  'Assistant Director': 'คุมตารางถ่ายทำและคิวในกองให้เป็นไปตามแผน',
  'Director of Photography': 'ดูแลภาพ กล้อง และไฟ',
  'Art Director': 'ดูแลฉาก พร็อพ และเสื้อผ้า',
  'Production Coordinator': 'ประสานงานทีม เอกสาร และการเดินทาง',
  'ทีมงาน (Crew)': 'ติดตามนัด คิวถ่าย และเอกสารที่เกี่ยวกับงานของคุณ',
  'ลูกค้า / แบรนด์': 'ติดตามความคืบหน้า ตารางนัด และสรุปงาน',
  'เอเจนซี่': 'ประสานระหว่างลูกค้าและทีมผลิต ติดตามความคืบหน้า'
};
export const ROLE_TH: Record<string, string> = { owner: 'Owner · จัดการได้ทุกอย่าง', editor: 'Editor · แก้ไขได้ทุกหน้า', viewer: 'Viewer · ดูสรุปผล' };
/** Normalise what people type as a Party Code: letters/digits only, upper case, max 6. */
export const cleanCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
