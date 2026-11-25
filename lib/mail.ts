import nodemailer from 'nodemailer';

// Outgoing e-mail through HOOSE's own SMTP (e.g. Gmail of hooseofficial with an App Password).
// Env: SMTP_HOST, SMTP_PORT (465/587), SMTP_USER, SMTP_PASS, SMTP_FROM (e.g. "HOOSE <hooseofficial@gmail.com>").
export const mailConfigured = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

let tx: nodemailer.Transporter | null = null;
function transport() {
  if (!tx) {
    const port = Number(process.env.SMTP_PORT || 465);
    tx = nodemailer.createTransport({ host: process.env.SMTP_HOST, port, secure: port === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
  }
  return tx;
}

export async function sendMail(to: string, subject: string, html: string, text: string) {
  await transport().sendMail({ from: process.env.SMTP_FROM || `HOOSE <${process.env.SMTP_USER}>`, to, subject, html, text });
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** Branded invitation e-mail (Thai). */
export function inviteEmail(o: { inviter: string; project: string; role: string; link: string; hasAccount: boolean; site: string }) {
  const roleTh = o.role === 'editor' ? 'Editor (แก้ไขได้ทุกหน้า)' : o.role === 'owner' ? 'Owner (เจ้าของโปรเจกต์)' : 'Viewer (ดูหน้าสรุปผล)';
  const cta = o.hasAccount ? 'เปิดโปรเจกต์' : 'สมัครและเข้าร่วม';
  const subject = `${o.inviter} เชิญคุณเข้าร่วมโปรเจกต์ “${o.project}” บน HOOSE`;
  const html = `<!doctype html><html><body style="margin:0;background:#F3F3F8;font-family:Inter,'IBM Plex Sans Thai',Arial,sans-serif;color:#0E0E1A">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #E7E7EE">
<tr><td style="background:#0D00FF;padding:22px 28px"><div style="color:#fff;font:700 20px/1 Poppins,Arial,sans-serif;letter-spacing:.14em;margin-top:2px">HOOSE</div></td></tr>
<tr><td style="padding:28px">
<p style="margin:0 0 6px;font-size:13px;color:#6B6E7E">คำเชิญเข้าร่วมโปรเจกต์</p>
<h1 style="margin:0 0 14px;font:600 22px/1.3 Poppins,Arial,sans-serif">${esc(o.project)}</h1>
<p style="margin:0 0 18px;font-size:15px;line-height:1.6"><b>${esc(o.inviter)}</b> เชิญคุณเข้าร่วมทีมในฐานะ <b>${roleTh}</b> บน HOOSE ระบบวางแผนพรีโปรดักชันและโปรดักชัน</p>
<a href="${o.link}" style="display:inline-block;background:#0D00FF;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px">${cta}</a>
<p style="margin:18px 0 0;font-size:12px;color:#6B6E7E;line-height:1.6">${o.hasAccount ? 'เข้าสู่ระบบด้วยอีเมลนี้แล้วจะเห็นโปรเจกต์ทันที' : 'สมัครด้วยอีเมลนี้ แล้วโปรเจกต์จะขึ้นในบัญชีของคุณทันทีหลังยืนยันอีเมล'}<br>ถ้าปุ่มกดไม่ได้ คัดลอกลิงก์นี้: <a href="${o.link}" style="color:#0D00FF;word-break:break-all">${o.link}</a></p>
</td></tr></table>
<p style="font-size:11px;color:#8B8E9C;margin:14px 0 0">ถ้าไม่ได้คาดว่าจะได้รับอีเมลนี้ ไม่ต้องทำอะไร</p>
</td></tr></table></body></html>`;
  const text = `${o.inviter} เชิญคุณเข้าร่วมโปรเจกต์ "${o.project}" บน HOOSE ในฐานะ ${roleTh}\n${cta}: ${o.link}`;
  return { subject, html, text };
}
