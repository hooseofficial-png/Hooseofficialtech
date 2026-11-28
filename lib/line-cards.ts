import type { LineMessage } from './line';

// Flex cards and quick replies for HOOSE Official.
// Brand: HOOSE blue #0D00FF, black and greys only (no green / yellow / orange / red).

const BLUE = '#0D00FF';
const INK = '#0E0E1A';
const GREY = '#6B6E7E';
export const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.hooseofficial.site';
/** Editor application (Google Form), opened from the "กรอกใบสมัคร" button. */
export const EDITOR_APPLY_FORM = 'https://docs.google.com/forms/d/e/1FAIpQLScDwPK3KVaD4aiR8Kig3Cu3h7sb2yeuxWp4SQNznXCkgfVkUQ/viewform?usp=dialog';
/** Step 5 for editors who passed: onboarding form. */
export const EDITOR_ONBOARD_FORM = 'https://docs.google.com/forms/d/e/1FAIpQLSdHE25F9u1ZPgTdwRUk_jWRhKETLMuz2BH0WR3XSatNxs2qqA/viewform?usp=header';

type Btn = { label: string; data?: string; display?: string; uri?: string; primary?: boolean };

function button(b: Btn) {
  const action = b.uri
    ? { type: 'uri', label: b.label, uri: b.uri }
    : { type: 'postback', label: b.label, data: b.data, displayText: b.display || b.label };
  return b.primary ? { type: 'button', style: 'primary', color: BLUE, height: 'sm', action }
    : { type: 'button', style: 'secondary', height: 'sm', action };
}

function card(alt: string, title: string, lines: string[], buttons: Btn[], tag = 'HOOSE'): LineMessage {
  return {
    type: 'flex',
    altText: alt,
    contents: {
      type: 'bubble',
      header: { type: 'box', layout: 'vertical', paddingAll: '16px', backgroundColor: BLUE,
        contents: [{ type: 'text', text: tag, color: '#FFFFFF', weight: 'bold', size: 'sm' }] },
      body: { type: 'box', layout: 'vertical', spacing: 'md', contents: [
        { type: 'text', text: title, weight: 'bold', size: 'lg', color: INK, wrap: true },
        ...lines.map(t => ({ type: 'text', text: t, size: 'sm', color: GREY, wrap: true }))
      ] },
      ...(buttons.length ? { footer: { type: 'box', layout: 'vertical', spacing: 'sm', contents: buttons.map(button) } } : {})
    }
  };
}

// ---------- LIFF links ----------

/** LIFF app id from Vercel env (either name works). Server only. */
export function liffId() { return process.env.NEXT_PUBLIC_LIFF_ID || process.env.NEXT_LIFF_ID || ''; }

/** Opens a page of the HOOSE LIFF app: apply (form), status (my application), projects. Empty when LIFF is not set up. */
export function liffUrl(view: 'apply' | 'status' | 'projects' | 'work', params: Record<string, string> = {}) {
  const id = liffId();
  if (!id) return '';
  return `https://liff.line.me/${id}?` + new URLSearchParams({ view, ...params }).toString();
}
export const applyUrl = (role: string) => liffUrl('apply', { role });

// ---------- quick replies (the round buttons above the keyboard) ----------

type QR = { label: string; uri?: string; text?: string };

/** Adds quick-reply buttons for people who already passed (status / projects). Others get the message unchanged. */
export function withQuickMenu(m: LineMessage, u: { role: string | null; status: string; survey_done_at?: string | null }): LineMessage {
  if (!['approved', 'active'].includes(u.status)) return m;
  const items: QR[] = [];
  const status = liffUrl('status'); const projects = liffUrl('projects'); const work = liffUrl('work');
  if (u.role === 'editor' && work) items.push({ label: '✂️ งานตัดของฉัน', uri: work });
  else if (status) items.push({ label: '📋 สถานะงานของฉัน', uri: status });
  if (projects && u.role !== 'editor') items.push({ label: '🎬 อัปเดตโปรเจกต์', uri: projects });
  if (!items.length) return m;
  return { ...m, quickReply: { items: items.map(i => ({ type: 'action', action: { type: 'uri', label: i.label, uri: i.uri } })) } };
}

/** Sent (as 2 bubbles) when an applicant finishes: a compliment, then what happens next. */
export const DONE_TEXTS = [
  'เยี่ยมมากเลยค่ะ 👏 ขอบคุณที่เลือกผลงานที่ภูมิใจที่สุดมาให้ดูนะคะ',
  'เราได้รับคำตอบของคุณเรียบร้อยแล้วค่ะ ✅ ทีมงานกำลังรีวิวตำแหน่งงานในกองถ่ายนี้ หากได้รับการอนุมัติ เราจะแจ้งกลับทันทีพร้อมตำแหน่งงานในอนาคต ขอบคุณนะคะ :))'
];
export const DONE_TEXT = DONE_TEXTS.join('\n');

// ---------- funnel cards ----------

export function welcomeCard(name?: string): LineMessage {
  return card('ยินดีต้อนรับสู่ HOOSE · เลือกบทบาทของคุณ',
    `ยินดีต้อนรับ${name ? 'คุณ' + name : ''} สู่ HOOSE 👋`,
    ['ดีใจที่ได้เจอกันนะคะ 😊 น้องฮูสจะช่วยดูแลเรื่องสมัครงานและอัปเดตงานให้', 'คุณมาในฐานะอะไรคะ?'],
    [
      { label: '🎬 นักตัดต่อ (Editor)', data: 'action=role&v=editor', display: 'ฉันเป็นนักตัดต่อ', primary: true },
      { label: '🎥 ทีมโปรดักชัน', data: 'action=role&v=crew', display: 'ฉันเป็นทีมโปรดักชัน' },
      { label: '📁 PM / Producer', data: 'action=role&v=manager', display: 'ฉันเป็น PM / Producer' }
    ]);
}

export function nextStepCard(role: string): LineMessage {
  if (role === 'editor') return card('สมัครนักตัดต่อ · กรอกใบสมัคร', 'มาเริ่มสมัครนักตัดต่อกันเลย ✨',
    ['① กดกรอกใบสมัครด้านล่าง (ใช้เวลาไม่กี่นาที)', '② จากนั้นเลือกผลงานที่คุณคิดว่าดีที่สุด 1 ชิ้น แล้วส่งลิงก์มาในแชทนี้ได้เลยค่ะ 🎬'],
    [{ label: '📝 กรอกใบสมัคร', uri: EDITOR_APPLY_FORM, primary: true }]);
  if (role === 'crew') return { type: 'text', text: 'ยินดีต้อนรับทีมโปรดักชันค่ะ 🎥 ขอทราบชื่อ-นามสกุลก่อนนะคะ 😊' };
  return card('PM / Producer · เปิดแอป HOOSE', 'สำหรับ PM / Producer 📁',
    ['จัดการโปรเจกต์ ทีมงาน ปฏิทิน และงบ ได้ที่แอป HOOSE', 'ยังไม่มีบัญชี? สมัครฟรี แล้วส่ง Open Call ผ่าน LINE ได้เลยค่ะ'],
    [{ label: 'สมัคร / เข้าแอป HOOSE', uri: SITE + '/login?mode=signup', primary: true }]);
}

export function appliedCard(name: string, role: string): LineMessage {
  return card('ได้รับใบสมัครแล้ว', `ได้รับใบสมัครของคุณ${name ? name : ''}แล้วค่ะ 🎉`,
    role === 'editor'
      ? ['ขอบคุณที่ส่งผลงานมานะคะ 🙏', 'อีกนิดเดียว! ตอบแบบสอบถาม 4 ข้อด้านล่าง แค่กดเลือก ไม่ต้องพิมพ์ค่ะ']
      : ['ขอบคุณที่ส่งผลงานมานะคะ 🙏', 'ทีม HOOSE จะดูผลงานและแจ้งผลในแชทนี้ภายใน 1-3 วันทำการค่ะ'], []);
}

/** "My status" card with a button to the LIFF status page (works like a mini dashboard). */
export function statusCard(u: { full_name?: string; display_name?: string; status: string; role: string | null }): LineMessage {
  const url = liffUrl('status');
  const line: Record<string, string> = {
    new: 'ยังไม่ได้เริ่มสมัคร', applying: 'เลือกบทบาทแล้ว รอกรอกใบสมัคร', applied: 'ส่งใบสมัครแล้ว ทีมกำลังดูผลงาน 👀',
    interview: 'ผ่านรอบผลงานแล้ว รอสัมภาษณ์ 🗓️', approved: 'ผ่านการคัดเลือกแล้ว 🎉', rejected: 'รอบนี้ยังไม่ผ่าน',
    active: 'เป็นทีมงาน HOOSE แล้ว 💙', blocked: 'บัญชีถูกระงับ'
  };
  return card('สถานะของฉัน', 'สถานะของฉัน 📋', [line[u.status] || u.status, 'กดดูรายละเอียดและอัปเดตโปรเจกต์ได้ที่นี่ค่ะ'],
    url ? [{ label: 'เปิดดูสถานะ', uri: url, primary: true }] : []);
}

// ---------- editor questionnaire (tap to answer; no AI cost) ----------

export const SURVEY = [
  { key: 'style', title: 'สไตล์งานตัดที่ถนัดที่สุดคือแบบไหนคะ? 🎞️', multi: false,
    options: [['lifestyle', 'ไลฟ์สไตล์'], ['clinic', 'คลินิก / ความงาม'], ['brand', 'Personal Brand'], ['vlog', 'Vlog']] },
  { key: 'per_week', title: 'หนึ่งสัปดาห์ตัดได้ประมาณกี่คลิปคะ? ⏱️', multi: false,
    options: [['1-2', '1-2 คลิป'], ['3-5', '3-5 คลิป'], ['6-10', '6-10 คลิป'], ['10+', 'มากกว่า 10 คลิป']] },
  { key: 'work', title: 'สะดวกทำงานรูปแบบไหนคะ? 💼', multi: false,
    options: [['fulltime', 'Full-time'], ['parttime', 'Part-time']] },
  { key: 'apps', title: 'ใช้โปรแกรมตัดต่ออะไรบ้างคะ? 💻', multi: true,
    options: [['premiere', 'Adobe Premiere Pro'], ['capcut', 'CapCut'], ['aftereffects', 'After Effects']] }
] as const;

export const SURVEY_LABEL: Record<string, Record<string, string>> = Object.fromEntries(
  SURVEY.map(q => [q.key, Object.fromEntries(q.options.map(([v, l]) => [v, l]))]));

/** One question card. For the multi-choice question, tapped options show a check and a "done" button appears. */
export function surveyCard(index: number, picked: string[] = []): LineMessage {
  const q = SURVEY[index];
  const btns: Btn[] = q.options.map(([v, l]) => ({
    label: (picked.includes(v) ? '✅ ' : '') + l,
    data: `action=survey&q=${q.key}&v=${v}`,
    display: l,
    primary: false
  }));
  if (q.multi) btns.push({ label: picked.length ? 'เสร็จแล้ว ➜' : 'เลือกอย่างน้อย 1 ข้อ', data: `action=survey&q=${q.key}&v=__done`, display: 'เลือกเสร็จแล้ว', primary: true });
  return card(`แบบสอบถาม ข้อ ${index + 1}/${SURVEY.length}`, q.title,
    [q.multi ? 'เลือกได้หลายข้อ แล้วกด "เสร็จแล้ว" ค่ะ' : 'กดเลือก 1 ข้อได้เลยค่ะ'], btns, `แบบสอบถาม ${index + 1}/${SURVEY.length}`);
}

export function surveyDoneCard(): LineMessage {
  return card('ตอบแบบสอบถามครบแล้ว', 'ครบแล้ว ขอบคุณมาก ๆ เลยค่ะ 🙌',
    ['ทีม HOOSE จะดูผลงานและแจ้งผลในแชทนี้ภายใน 1-3 วันทำการนะคะ', 'ระหว่างรอ ถามน้องฮูสได้ตลอดเลยค่ะ 💙'], []);
}

// ---------- results sent from the admin dashboard ----------

/** Opens the app sign-up and links the new account to this LINE user (signed token from lib/line). */
export const accountUrl = (token: string) => `${SITE}/line/link?t=${encodeURIComponent(token)}`;

export function resultCard(status: string, role: string | null, message: string, interviewUrl = '', linkToken = ''): LineMessage | null {
  if (status === 'interview') return card('ผ่านรอบผลงาน · นัดสัมภาษณ์', 'ผ่านรอบผลงานแล้วค่ะ 🎉', [message],
    interviewUrl ? [{ label: '🗓️ นัดเวลาสัมภาษณ์', uri: interviewUrl, primary: true }] : []);
  if (status === 'approved') {
    const btns: Btn[] = linkToken ? [{ label: '🎬 สร้างบัญชีกองถ่าย HOOSE', uri: accountUrl(linkToken), primary: true }] : [];
    if (role === 'editor') btns.push({ label: '📝 กรอกข้อมูลทีมงาน', uri: EDITOR_ONBOARD_FORM });
    return card('ผ่านการคัดเลือก · สร้างบัญชีกองถ่าย', 'ยินดีด้วยค่ะ ผ่านการคัดเลือกแล้ว 🎉', [message, 'ขั้นต่อไป: สร้างบัญชีกองถ่าย HOOSE (ใช้เวลา 1 นาที) เพื่อรับงานและเข้าร่วมกองถ่ายค่ะ'], btns);
  }
  if (status === 'rejected') return card('ผลการสมัคร', 'ขอบคุณที่สนใจ HOOSE นะคะ 🙏', [message], []);
  if (status === 'active') return card('ลงทะเบียนทีมงานแล้ว', 'เป็นทีมงาน HOOSE แล้ว 💙', [message],
    liffUrl('projects') ? [{ label: '🎬 ดูโปรเจกต์', uri: liffUrl('projects'), primary: true }] : []);
  return null;
}

/** After the app account is linked. */
export const ACCOUNT_DONE_TEXTS = [
  'บัญชีกองถ่าย Hooseofficial ของคุณเสร็จสิ้นแล้วค่ะ 🎉',
  'ต่อจากนี้ น้องฮูสจะเป็นผู้ช่วยการทำงานของคุณตลอดงาน คอยอัปเดตกองถ่ายและตอบคำถามให้นะคะ มีอะไรสงสัยพิมพ์ถามได้เลยค่ะ 💙'
];

// ---------- Open Call ----------

export type OcProject = { name: string; brand: string; type: string; start_date: string | null; end_date: string | null; locations: string[] | null; call_time: string | null };
const thDate = (d: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) : '';
export const dateRangeTh = (p: { start_date: string | null; end_date: string | null }) =>
  !p.start_date ? 'ยังไม่กำหนดวัน' : thDate(p.start_date) + (p.end_date && p.end_date !== p.start_date ? ' – ' + thDate(p.end_date) : '');

/** One Open Call position, with accept / decline postbacks. */
export function openCallCard(p: OcProject, pos: { id: string; position: string; scope: string; days: number | null }, announcementId: string): LineMessage {
  const lines = [
    [p.type, p.brand].filter(Boolean).join(' · '),
    '📅 ' + dateRangeTh(p) + (pos.days ? ` (${pos.days} วัน)` : ''),
    p.locations?.length ? '📍 ' + p.locations.join(', ') : '',
    pos.scope ? '📝 ' + pos.scope : ''
  ].filter(Boolean);
  return card(`Open Call · ${pos.position} · ${p.name}`, `${pos.position} · ${p.name}`, lines, [
    { label: '✋ สนใจรับงาน', data: `action=oc&a=accept&pos=${pos.id}&ann=${announcementId}`, display: 'สนใจรับงานนี้ค่ะ/ครับ', primary: true },
    { label: 'ไม่สะดวกรอบนี้', data: `action=oc&a=decline&pos=${pos.id}&ann=${announcementId}`, display: 'รอบนี้ไม่สะดวก' }
  ], 'HOOSE · OPEN CALL');
}

/** Sent when the team picks this person for a position: party code + project brief. */
export function partyCodeCard(p: OcProject & { party_code: string | null }, position: string): LineMessage {
  const code = p.party_code || '';
  return card(`ยืนยันงาน · ${p.name} · Party Code ${code}`, `ยืนยันแล้ว! ${position} · ${p.name} 🎬`, [
    code ? `Party Code: ${code}` : 'ทีมงานจะส่ง Party Code ให้เร็ว ๆ นี้ค่ะ',
    'กดปุ่มด้านล่าง ใส่ Party Code เพื่อเข้ากองถ่ายในแอป HOOSE แล้วจะเห็นคิว สถานที่ และเอกสารทั้งหมดค่ะ'
  ], code ? [{ label: 'เข้าร่วมกองถ่าย', uri: `${SITE}/join?code=${encodeURIComponent(code)}`, primary: true }] : [], 'HOOSE · ยืนยันงาน');
}

/** Short brief that follows the party code card (plain text, split into 2 bubbles if long). */
export function projectBrief(p: OcProject & { synopsis?: string | null; deliverables?: string | null; pm_name?: string | null; pm_phone?: string | null; special?: string | null }) {
  return [
    `📋 สรุปโปรเจกต์ ${p.name}`,
    [p.type, p.brand].filter(Boolean).join(' · '),
    '📅 ' + dateRangeTh(p) + (p.call_time ? ' · คอล ' + p.call_time.slice(0, 5) : ''),
    p.locations?.length ? '📍 ' + p.locations.join(', ') : '',
    p.synopsis ? '🎬 ' + p.synopsis.slice(0, 200) : '',
    p.deliverables ? '📦 ' + p.deliverables.slice(0, 120) : '',
    p.special ? '⚠️ ' + p.special.slice(0, 120) : '',
    p.pm_name ? `☎️ PM: ${p.pm_name}${p.pm_phone ? ' ' + p.pm_phone : ''}` : ''
  ].filter(Boolean).join('\n');
}

// ---------- Editing projects (ClickUp) ----------

const thDay = (ms: number | null) => ms ? new Date(ms).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'Asia/Bangkok' }) : 'ยังไม่กำหนด';
const daysLeft = (ms: number | null) => ms ? Math.ceil((ms - Date.now()) / 864e5) : null;

export type ProjectCall = { id: string; task_name: string; due_date: string | null; detail: string; rate: string; clips: number; reason: string; refs: string[] };

/** New (or re-opened) editing project for editors. First to tap "รับโปรเจกต์นี้" gets every open clip in ClickUp. */
export function projectCallCard(c: ProjectCall): LineMessage {
  const due = c.due_date ? +new Date(c.due_date) : null;
  const late = due !== null && due < Date.now();
  const btns: Btn[] = [{ label: '✋ รับโปรเจกต์นี้', data: `action=ed&c=${c.id}`, display: 'รับโปรเจกต์นี้ค่ะ/ครับ', primary: true }];
  c.refs.slice(0, 2).forEach((u, i) => btns.push({ label: `▶ ดู REF ${c.refs.length > 1 ? i + 1 : ''}`.trim(), uri: u }));
  return card(`${c.reason === 'reassign' ? 'ด่วน · หาคนตัดแทน' : 'โปรเจกต์ใหม่'} · ${c.task_name}`,
    `${c.reason === 'reassign' ? 'ด่วน! หาคนตัดแทน' : 'โปรเจกต์ใหม่มาแล้ว'} ✂️ ${c.task_name}`, [
      c.clips > 1 ? `🎬 ${c.clips} คลิป` : '🎬 1 งาน',
      late ? '⏰ เลยกำหนดเดิมแล้ว ทีมงานจะแจ้งกำหนดส่งใหม่กับคนที่รับ' : `⏰ Deadline: ${thDay(due)}`,
      c.rate ? '💰 ' + c.rate : '',
      c.detail ? '📝 ' + c.detail.slice(0, 280) + (c.detail.length > 280 ? '…' : '') : '',
      'คนแรกที่กดรับ ได้โปรเจกต์นี้ค่ะ'
    ].filter(Boolean), btns, 'HOOSE · งานตัดต่อ');
}

export function projectAssignedCard(c: { task_name: string; due_date: string | null; clips: number }, url: string, inClickUp: boolean): LineMessage {
  return card(`ได้โปรเจกต์ ${c.task_name} แล้ว`, 'โปรเจกต์นี้เป็นของคุณแล้วค่ะ 🎉', [
    `${c.task_name}${c.clips > 1 ? ` · ${c.clips} คลิป` : ''}`,
    '⏰ Deadline: ' + thDay(c.due_date ? +new Date(c.due_date) : null),
    inClickUp ? 'เปิด ClickUp เพื่อดูรายละเอียดทุกคลิปและอัปเดตสถานะได้เลยค่ะ' : 'ทีมงานจะส่งคำเชิญ ClickUp ให้ แล้วจะเห็นงานในนั้นค่ะ'
  ], inClickUp ? [{ label: 'เปิดโปรเจกต์ใน ClickUp', uri: url, primary: true }] : [], 'HOOSE · งานตัดต่อ');
}

/** Individual heads-up: one project close to its deadline, with the clips not delivered yet. */
export function dueSoonCard(p: { name: string; url: string; due: number | null; open: { name: string }[]; total: number }, person: string): LineMessage {
  const d = daysLeft(p.due);
  const left = p.open.map(c => c.name).slice(0, 6).join(', ') + (p.open.length > 6 ? ` และอีก ${p.open.length - 6}` : '');
  return card(`ใกล้ครบกำหนด · ${p.name}`, `${p.name} ใกล้ครบกำหนดแล้วนะคะ ⏰`, [
    `คุณ${person} · Deadline ${thDay(p.due)}${d !== null ? (d <= 0 ? ' (วันนี้)' : ` (อีก ${d} วัน)`) : ''}`,
    p.total > 1 ? `ยังไม่ได้ส่ง ${p.open.length} จาก ${p.total} คลิป: ${left}` : 'ยังไม่ได้ส่งงานนี้',
    'อัปเดตสถานะใน ClickUp ได้เลย ติดอะไรบอกน้องฮูสได้ค่ะ 💙'
  ], [{ label: 'เปิดใน ClickUp', uri: p.url, primary: true }], 'HOOSE · งานตัดต่อ');
}

/** To the editor whose overdue project was handed to someone else. */
export function reassignedCard(p: { name: string; due: number | null }, person: string): LineMessage {
  return card(`ส่งต่อโปรเจกต์ ${p.name}`, 'โปรเจกต์นี้ขอส่งต่อให้คนอื่นนะคะ 🙏', [
    `คุณ${person} · ${p.name} เลยกำหนด ${thDay(p.due)} แล้ว`,
    'ทีมงานจึงขอส่งต่อให้คนอื่นช่วยตัดต่อ ถ้าทำเสร็จไปบางคลิปแล้ว หรือมีเหตุจำเป็น พิมพ์บอกน้องฮูสได้เลยค่ะ'
  ], [], 'HOOSE · งานตัดต่อ');
}

export function projectDoneCard(p: { name: string }, person: string): LineMessage {
  return card(`โปรเจกต์ ${p.name} เสร็จสิ้น`, 'โปรเจกต์เสร็จสิ้นแล้ว ขอบคุณมาก ๆ เลยค่ะ 🙌', [
    `คุณ${person} · ${p.name}`, 'ขอบคุณในความร่วมมือนะคะ มีโปรเจกต์ใหม่เมื่อไหร่ น้องฮูสจะส่งมาให้ก่อนเลย 💙'
  ], [], 'HOOSE · งานตัดต่อ');
}
