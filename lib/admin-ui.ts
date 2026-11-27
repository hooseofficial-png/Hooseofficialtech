// Labels shared by the admin pages (client safe).
export const ROLE_TH: Record<string, string> = { editor: 'นักตัดต่อ', crew: 'ทีมโปรดักชัน', manager: 'PM / Producer' };
export const STATUS_TH: Record<string, string> = {
  new: 'ใหม่', applying: 'กำลังสมัคร', applied: 'ส่งใบสมัคร', interview: 'สัมภาษณ์',
  approved: 'อนุมัติ', rejected: 'ไม่ผ่าน', active: 'รับงานอยู่', blocked: 'บล็อก'
};
/** chip class per status: blue = needs action / positive, ink = done, outline = closed. */
export const STATUS_CHIP: Record<string, string> = {
  new: 'chip o', applying: 'chip', applied: 'chip b', interview: 'chip lb', approved: 'chip k', rejected: 'chip o', active: 'chip k', blocked: 'chip o'
};
/** Default LINE message offered when an admin moves someone to that status (editable before sending). */
export const NOTIFY: Record<string, (name: string) => string> = {
  interview: n => `สวัสดีคุณ${n} ทีม HOOSE ดูผลงานแล้วและอยากนัดคุยเพิ่มเติม สะดวกวันและเวลาไหนบ้าง ตอบกลับในแชทนี้ได้เลย`,
  approved: n => `ยินดีด้วยคุณ${n} ใบสมัครของคุณผ่านการพิจารณากับ HOOSE แล้ว จากนี้คุณจะได้รับประกาศ Open Call ที่ตรงตำแหน่งในแชทนี้`,
  rejected: n => `ขอบคุณคุณ${n} ที่สนใจร่วมงานกับ HOOSE รอบนี้ยังไม่ตรงกับงานที่เปิดอยู่ ทีมจะเก็บข้อมูลไว้และติดต่อกลับเมื่อมีงานที่เหมาะ`,
  active: n => `คุณ${n} ลงทะเบียนเป็นทีมงาน HOOSE เรียบร้อยแล้ว เมื่อมีงานที่ตรงตำแหน่ง ระบบจะส่ง Open Call มาในแชทนี้`
};
export const fmt = (s?: string | null) => s ? new Date(s).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '–';
