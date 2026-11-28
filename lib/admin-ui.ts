// Labels shared by the admin pages (client safe).
export const ROLE_TH: Record<string, string> = { editor: 'นักตัดต่อ', crew: 'ทีมโปรดักชัน', manager: 'PM / Producer' };
export const STATUS_TH: Record<string, string> = {
  new: 'ใหม่', applying: 'กำลังสมัคร', applied: 'ส่งใบสมัคร', interview: 'สัมภาษณ์',
  onboarding: 'ส่งเอกสารแล้ว', approved: 'รอสร้างบัญชี', rejected: 'ไม่ผ่าน', active: 'ทีมงาน', blocked: 'บล็อก'
};
/** chip class per status: blue = needs action / positive, ink = done, outline = closed. */
export const STATUS_CHIP: Record<string, string> = {
  new: 'chip o', applying: 'chip', applied: 'chip b', interview: 'chip lb', onboarding: 'chip lb', approved: 'chip k', rejected: 'chip o', active: 'chip k', blocked: 'chip o'
};
/** Default LINE message per status (editable before sending). It goes out inside a Flex card with the right button. */
export const NOTIFY: Record<string, (name: string, role?: string | null) => string> = {
  interview: n => `คุณ${n} ผ่านการพิจารณาผลงานแล้วค่ะ ทีม HOOSE ขอนัดคุย 30 นาที`,
  onboarding: n => `ขอบคุณคุณ${n} ที่สละเวลาคุยกับทีม HOOSE ค่ะ`,
  approved: n => `ได้รับข้อมูลของคุณ${n} ครบถ้วนแล้วค่ะ`,
  rejected: n => `ขอบคุณคุณ${n} ที่สนใจร่วมงานกับ HOOSE ค่ะ รอบนี้ยังไม่ตรงกับงานที่เปิดรับ ทีมจะเก็บผลงานไว้และติดต่อกลับเมื่อมีงานที่เหมาะสมค่ะ`,
  active: n => `คุณ${n} เป็นทีมงาน HOOSE เรียบร้อยแล้ว 💙 มีงานที่ตรงตำแหน่งเมื่อไหร่ น้องฮูสจะส่งมาในแชทนี้ทันทีค่ะ ✨`
};
export const SURVEY_Q: Record<string, string> = { style: 'สไตล์', per_week: 'ต่อสัปดาห์', work: 'รูปแบบงาน', apps: 'โปรแกรม' };
export const fmt = (s?: string | null) => s ? new Date(s).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '–';
