import type { LineMessage } from './line';

// Flex cards for HOOSE Official. Brand: HOOSE blue #0D00FF, black and greys only (no green / yellow / orange / red).

const BLUE = '#0D00FF';
const INK = '#0E0E1A';
const GREY = '#6B6E7E';
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.hooseofficial.site';

type Btn = { label: string; data?: string; display?: string; uri?: string; primary?: boolean };

function button(b: Btn) {
  const action = b.uri
    ? { type: 'uri', label: b.label, uri: b.uri }
    : { type: 'postback', label: b.label, data: b.data, displayText: b.display || b.label };
  return b.primary ? { type: 'button', style: 'primary', color: BLUE, height: 'sm', action }
    : { type: 'button', style: 'secondary', height: 'sm', action };
}

function card(alt: string, title: string, lines: string[], buttons: Btn[]): LineMessage {
  return {
    type: 'flex',
    altText: alt,
    contents: {
      type: 'bubble',
      header: { type: 'box', layout: 'vertical', paddingAll: '16px', backgroundColor: BLUE,
        contents: [{ type: 'text', text: 'HOOSE', color: '#FFFFFF', weight: 'bold', size: 'sm' }] },
      body: { type: 'box', layout: 'vertical', spacing: 'md', contents: [
        { type: 'text', text: title, weight: 'bold', size: 'lg', color: INK, wrap: true },
        ...lines.map(t => ({ type: 'text', text: t, size: 'sm', color: GREY, wrap: true }))
      ] },
      ...(buttons.length ? { footer: { type: 'box', layout: 'vertical', spacing: 'sm', contents: buttons.map(button) } } : {})
    }
  };
}

export function welcomeCard(name?: string): LineMessage {
  return card('ยินดีต้อนรับสู่ HOOSE · เลือกบทบาทของคุณ',
    `ยินดีต้อนรับ${name ? ' คุณ' + name : ''} สู่ HOOSE`,
    ['ผู้ช่วยทำงานของทีมงาน HOOSE', 'คุณมาในฐานะอะไรครับ?'],
    [
      { label: 'นักตัดต่อ (Editor)', data: 'action=role&v=editor', display: 'ฉันเป็นนักตัดต่อ', primary: true },
      { label: 'ทีมโปรดักชัน', data: 'action=role&v=crew', display: 'ฉันเป็นทีมโปรดักชัน' },
      { label: 'PM / Producer', data: 'action=role&v=manager', display: 'ฉันเป็น PM / Producer' }
    ]);
}

/** LIFF app id from Vercel env (either name works). Server only. */
export function liffId() { return process.env.NEXT_PUBLIC_LIFF_ID || process.env.NEXT_LIFF_ID || ''; }

/** Opens the application form (LIFF) inside LINE. */
export function applyUrl(role: string) {
  const id = liffId();
  return id ? `https://liff.line.me/${id}?role=${encodeURIComponent(role)}` : '';
}

export function nextStepCard(role: string): LineMessage {
  if (role === 'editor' || role === 'crew') {
    const url = applyUrl(role);
    const who = role === 'editor' ? 'นักตัดต่อ' : 'ทีมโปรดักชัน';
    return card(`สมัคร${who} · กรอกใบสมัคร`, `สมัคร${who}กับ HOOSE`,
      url
        ? ['ขั้นที่ 1 กรอกใบสมัคร: ชื่อ เบอร์ อีเมล ตำแหน่ง และลิงก์ผลงาน (ใช้เวลาประมาณ 1 นาที)',
           role === 'editor' ? 'ถัดไป: แบบสอบถาม · นัดสัมภาษณ์ · แจ้งผล · ลงทะเบียนรับงาน' : 'เมื่อได้รับอนุมัติ คุณจะได้รับประกาศ Open Call ที่ตรงตำแหน่งในแชทนี้']
        : [role === 'editor' ? 'ขั้นที่ 1 ส่งลิงก์ผลงาน (Portfolio หรือ Showreel) มาในแชทนี้' : 'ขั้นที่ 1 พิมพ์ตำแหน่งงานของคุณ (เช่น DOP, Gaffer, Props Master, PA) พร้อมลิงก์ผลงาน'],
      url ? [{ label: 'กรอกใบสมัคร', uri: url, primary: true }] : []);
  }
  return card('PM / Producer · เปิดแอป HOOSE', 'สำหรับ PM / Producer',
    ['จัดการโปรเจกต์ ทีมงาน ปฏิทิน และงบ ได้ที่แอป HOOSE', 'ยังไม่มีบัญชี? สมัครได้ฟรี แล้วส่ง Open Call จากหน้าทีมงานผ่าน LINE ได้เลย'],
    [{ label: 'สมัคร / เข้าแอป HOOSE', uri: SITE + '/login?mode=signup', primary: true }]);
}

export function appliedCard(name: string, role: string): LineMessage {
  return card('ได้รับใบสมัครแล้ว', `ได้รับใบสมัครของคุณ${name ? ' ' + name : ''}แล้ว`,
    [role === 'editor' ? 'ทีม HOOSE จะตรวจผลงานและแจ้งขั้นถัดไป (แบบสอบถาม / นัดสัมภาษณ์) ในแชทนี้' : 'ทีม HOOSE จะตรวจผลงานและแจ้งผลในแชทนี้',
     'ระหว่างนี้พิมพ์ถามเรื่องขั้นตอนได้ตลอด'], []);
}
