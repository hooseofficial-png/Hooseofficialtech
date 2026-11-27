import type { SupabaseClient } from '@supabase/supabase-js';

// The LINE AI assistant: Claude with a few tools that read and write HOOSE data for ONE LINE user.
// The user id always comes from the verified webhook, never from the model, so a user can only
// see and change their own record. Env: ANTHROPIC_API_KEY, ANTHROPIC_MODEL (optional).

export type LineUser = {
  line_user_id: string; display_name: string; full_name: string; role: string | null; status: string;
  position: string; portfolio_url: string;
};

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5';
const HISTORY = 20;
const MAX_STEPS = 4;

const ROLE_TH: Record<string, string> = { editor: 'นักตัดต่อ', crew: 'ทีมโปรดักชัน', manager: 'PM / Producer' };

function system(u: LineUser) {
  return `คุณคือ "ผู้ช่วย HOOSE" ผู้ช่วยทำงานส่วนตัวของทีมงาน HOOSE ทั้งนักตัดต่อ (Editor) และทีมโปรดักชัน (Crew) ผ่าน LINE

ข้อมูลผู้ใช้ (ระบบยืนยันแล้ว):
- ชื่อ: ${u.full_name || u.display_name || 'ยังไม่ทราบ'}
- บทบาท: ${u.role ? ROLE_TH[u.role] : 'ยังไม่เลือก'}
- สถานะการสมัคร: ${u.status}
- ตำแหน่ง: ${u.position || '-'}
- ลิงก์ผลงาน: ${u.portfolio_url || '-'}

ขั้นตอนนักตัดต่อ: 1 ส่งลิงก์ผลงาน → 2 แบบสอบถาม → 3 นัดสัมภาษณ์ → 4 แจ้งผล → 5 ลงทะเบียนรับงาน แล้วติดตามสถานะงานตัด
ขั้นตอนทีมโปรดักชัน: 1 แจ้งตำแหน่ง + ลิงก์ผลงาน → 2 ทีมพิจารณา → 3 อนุมัติ → 4 รับประกาศ Open Call และกดตอบรับหรือปฏิเสธ

วิธีทำงาน:
- ถ้ายังไม่เลือกบทบาท ให้บอกให้พิมพ์ "เมนู" แล้วกดเลือกบทบาท ห้ามเดาบทบาทเอง
- ถ้าเลือกบทบาทแล้วแต่ยังไม่ได้ส่งใบสมัคร ให้บอกให้พิมพ์ "สมัคร" แล้วกดปุ่ม "กรอกใบสมัคร" (ฟอร์มเก็บชื่อ เบอร์ อีเมล ตำแหน่ง ลิงก์ผลงาน)
- ถ้าผู้ใช้ส่งลิงก์ผลงานหรือบอกตำแหน่งในแชท ให้เรียก update_my_application เพื่อบันทึกทันที
- ถ้าถามถึงงานที่เปิดรับ ให้เรียก list_open_calls
- ถ้าถามสถานะของตัวเอง ให้เรียก get_my_profile

กฎ:
- ตอบภาษาเดียวกับผู้ใช้ สั้น กระชับ ไม่เกิน 3-4 ประโยค ห้ามใช้ Markdown (ไม่มี ** หรือ #) ห้ามใช้หัวข้อหรือรายการยาว
- ห้ามขอเลขบัญชี เลขบัตรประชาชน หรือข้อมูลอ่อนไหวในแชท บอกว่าจะได้แบบฟอร์มที่ปลอดภัยเมื่อถึงขั้นนั้น
- ห้ามแจ้งผลคัดเลือก ยืนยันงาน หรือรับปากค่าตัวเอง ทีม HOOSE เป็นผู้แจ้งผ่านระบบเท่านั้น
- ข้อมูลที่ไม่มีเครื่องมือดึงได้ ห้ามเดาหรือแต่งขึ้น ให้บอกว่าจะส่งเรื่องให้ทีมตรวจสอบ`;
}

const TOOLS = [
  { name: 'get_my_profile', description: 'ดูบทบาท สถานะการสมัคร ตำแหน่ง และลิงก์ผลงานของผู้ใช้คนนี้', input_schema: { type: 'object', properties: {} } },
  {
    name: 'update_my_application',
    description: 'บันทึกตำแหน่งงานและ/หรือลิงก์ผลงาน (https) ของผู้ใช้คนนี้ เมื่อมีบทบาทและลิงก์ผลงานครบ สถานะจะเป็น applied (ส่งใบสมัครแล้ว)',
    input_schema: { type: 'object', properties: {
      position: { type: 'string', description: 'ตำแหน่ง เช่น Editor, Colorist, DOP, Gaffer, Props Master, PA' },
      portfolio_url: { type: 'string', description: 'ลิงก์ผลงาน ต้องขึ้นต้นด้วย https://' }
    } }
  },
  {
    name: 'list_open_calls',
    description: 'ดูตำแหน่งที่เปิดรับ (Open Call) ในโปรเจกต์ของ HOOSE ใช้ได้เฉพาะทีมงานที่ได้รับอนุมัติแล้ว',
    input_schema: { type: 'object', properties: { position: { type: 'string', description: 'กรองตามชื่อตำแหน่ง (ไม่บังคับ)' } } }
  }
];

async function runTool(db: SupabaseClient, u: LineUser, name: string, input: Record<string, unknown>) {
  if (name === 'get_my_profile') {
    const { data } = await db.from('line_users').select('role, status, position, portfolio_url').eq('line_user_id', u.line_user_id).maybeSingle();
    return data || { error: 'not found' };
  }
  if (name === 'update_my_application') {
    const patch: Record<string, string> = {};
    if (typeof input.position === 'string' && input.position.trim()) patch.position = input.position.trim().slice(0, 80);
    if (typeof input.portfolio_url === 'string') {
      const url = input.portfolio_url.trim();
      if (!/^https:\/\/\S+$/i.test(url)) return { error: 'ลิงก์ต้องขึ้นต้นด้วย https://' };
      patch.portfolio_url = url.slice(0, 500);
    }
    if (!Object.keys(patch).length) return { error: 'nothing to save' };
    const portfolio = patch.portfolio_url || u.portfolio_url;
    if (u.role && u.role !== 'manager' && portfolio && ['new', 'applying'].includes(u.status)) patch.status = 'applied';
    else if (u.status === 'new') patch.status = 'applying';
    const { data, error } = await db.from('line_users').update(patch).eq('line_user_id', u.line_user_id)
      .select('role, status, position, portfolio_url').single();
    if (error) return { error: error.message };
    Object.assign(u, data);
    return { saved: true, ...data };
  }
  if (name === 'list_open_calls') {
    if (u.role !== 'crew' && u.role !== 'editor') return { error: 'เฉพาะทีมงาน HOOSE' };
    if (!['approved', 'active'].includes(u.status)) return { error: 'ต้องได้รับอนุมัติเป็นทีมงาน HOOSE ก่อน จึงจะเห็นงานที่เปิดรับ', status: u.status };
    let q = db.from('crew_positions')
      .select('position, rate_type, budget, days, scope, projects(name, type, brand, start_date, end_date, locations)')
      .eq('status', 'open').order('created_at', { ascending: false }).limit(10);
    if (typeof input.position === 'string' && input.position.trim()) q = q.ilike('position', '%' + input.position.trim().replace(/[%_]/g, '') + '%');
    const { data, error } = await q;
    return error ? { error: error.message } : { open_calls: data || [] };
  }
  return { error: 'unknown tool' };
}

type Block = { type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> };

async function claude(body: unknown): Promise<{ content: Block[]; stop_reason: string }> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY || '', 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`Claude ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

/** Answers one text message. Stores both turns as chat memory and returns the reply text. */
export async function answer(db: SupabaseClient, u: LineUser, userText: string): Promise<string> {
  const { data: past } = await db.from('line_messages').select('role, content')
    .eq('line_user_id', u.line_user_id).order('created_at', { ascending: false }).limit(HISTORY);
  const history = (past || []).reverse().map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
  while (history.length && history[0].role !== 'user') history.shift();

  const messages: { role: 'user' | 'assistant'; content: unknown }[] = [...history, { role: 'user', content: userText }];
  let out = '';
  for (let step = 0; step < MAX_STEPS; step++) {
    const r = await claude({ model: MODEL, max_tokens: 700, system: system(u), tools: TOOLS, messages });
    out = r.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    const calls = r.content.filter(b => b.type === 'tool_use');
    if (r.stop_reason !== 'tool_use' || !calls.length) break;
    messages.push({ role: 'assistant', content: r.content });
    const results = [];
    for (const c of calls) results.push({ type: 'tool_result', tool_use_id: c.id, content: JSON.stringify(await runTool(db, u, c.name!, c.input || {})) });
    messages.push({ role: 'user', content: results });
  }
  out = out || 'ขอโทษครับ ตอนนี้ตอบไม่ได้ ลองพิมพ์ใหม่อีกครั้งนะครับ';
  await db.from('line_messages').insert([
    { line_user_id: u.line_user_id, role: 'user', content: userText.slice(0, 4000) },
    { line_user_id: u.line_user_id, role: 'assistant', content: out.slice(0, 4000) }
  ]);
  return out;
}
