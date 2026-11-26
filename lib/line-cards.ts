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

export function nextStepCard(role: string): LineMessage {
  if (role === 'editor') return card('สมัครนักตัดต่อ · ขั้นที่ 1', 'สมัครนักตัดต่อกับ HOOSE',
    ['ขั้นที่ 1 ส่งลิงก์ผลงาน (Portfolio หรือ Showreel) มาในแชทนี้', '2 ทำแบบสอบถาม · 3 นัดสัมภาษณ์ · 4 แจ้งผล · 5 ลงทะเบียนรับงาน'], []);
  if (role === 'crew') return card('สมัครทีมโปรดักชัน · ขั้นที่ 1', 'สมัครทีมโปรดักชัน HOOSE',
    ['ขั้นที่ 1 พิมพ์ตำแหน่งงานของคุณ (เช่น DOP, Gaffer, Props Master, PA) พร้อมลิงก์ผลงาน', 'เมื่อได้รับอนุมัติ คุณจะได้รับประกาศ Open Call ที่ตรงตำแหน่งในแชทนี้'], []);
  return card('PM / Producer · เปิดแอป HOOSE', 'สำหรับ PM / Producer',
    ['จัดการโปรเจกต์ ทีมงาน ปฏิทิน และงบ ได้ที่แอป HOOSE', 'ส่ง Open Call จากหน้าทีมงาน แล้วระบบจะประกาศผ่าน LINE ให้'],
    [{ label: 'เปิดแอป HOOSE', uri: SITE, primary: true }]);
}
