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
export function liffUrl(view: 'apply' | 'status' | 'projects', params: Record<string, string> = {}) {
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
  const status = liffUrl('status'); const projects = liffUrl('projects');
  if (status) items.push({ label: '📋 สถานะงานของฉัน', uri: status });
  if (projects) items.push({ label: '🎬 อัปเดตโปรเจกต์', uri: projects });
  if (!items.length) return m;
  return { ...m, quickReply: { items: items.map(i => ({ type: 'action', action: { type: 'uri', label: i.label, uri: i.uri } })) } };
}

/** Sent when an applicant finishes (portfolio received). */
export const DONE_TEXT = 'เสร็จสิ้นแล้วค่ะ ✅ ทีมงานกำลังรีวิวคำตอบของคุณ รอรับการอัปเดตในแชทนี้ได้เลยนะคะ 💙';

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
    ['① กดกรอกใบสมัครด้านล่าง (ใช้เวลาไม่กี่นาที)', '② กรอกเสร็จแล้ว ส่งลิงก์ผลงานมาในแชทนี้ได้เลยค่ะ 🎬'],
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

export function resultCard(status: string, role: string | null, message: string, interviewUrl = ''): LineMessage | null {
  if (status === 'interview') return card('ผ่านรอบผลงาน · นัดสัมภาษณ์', 'ผ่านรอบผลงานแล้วค่ะ 🎉', [message],
    interviewUrl ? [{ label: '🗓️ นัดเวลาสัมภาษณ์', uri: interviewUrl, primary: true }] : []);
  if (status === 'approved') return role === 'editor'
    ? card('ผ่านการคัดเลือก · กรอกข้อมูลเพิ่มเติม', 'ยินดีต้อนรับสู่ทีม HOOSE 🎉', [message], [{ label: '📝 กรอกข้อมูลทีมงาน', uri: EDITOR_ONBOARD_FORM, primary: true }])
    : card('ผ่านการคัดเลือก · สมัครบัญชี HOOSE', 'ผ่านการคัดเลือกแล้วค่ะ 🎉', [message], [{ label: 'สมัครบัญชีในแอป HOOSE', uri: SITE + '/login?mode=signup', primary: true }]);
  if (status === 'rejected') return card('ผลการสมัคร', 'ขอบคุณที่สนใจ HOOSE นะคะ 🙏', [message], []);
  if (status === 'active') return card('ลงทะเบียนทีมงานแล้ว', 'เป็นทีมงาน HOOSE แล้ว 💙', [message],
    liffUrl('projects') ? [{ label: '🎬 ดูโปรเจกต์', uri: liffUrl('projects'), primary: true }] : []);
  return null;
}
