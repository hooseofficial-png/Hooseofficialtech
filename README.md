# HOOSE · Production Management Platform

ระบบวางแผนพรีโปรดักชันและโปรดักชันของ HOOSE ใช้สำหรับ Production Manager และ Producer

- **หน้าเว็บ:** Next.js 14 (App Router, TypeScript)
- **ฐานข้อมูล ล็อกอิน และไฟล์:** Supabase (Postgres + Row Level Security + Storage)
- **โฮสต์:** Vercel แผนฟรีได้ลิงก์ `*.vercel.app` ยังไม่ต้องซื้อโดเมน

## ฟีเจอร์
| หน้า | ทำอะไรได้ |
|---|---|
| ภาพรวม | ทุกโปรเจกต์ที่คุณดูแล · % ความพร้อม · ทีมงานและเอกสาร · นัดถัดไป · ปฏิทินรวม · ลบโปรเจกต์ (เจ้าของเท่านั้น) |
| แดชบอร์ด | การ์ดโปรเจกต์ · ความพร้อมพรีโปรดักชัน · นัดที่จะถึง · ทีมงาน · งบ · เอกสาร |
| รายละเอียด | ลูกค้า/แบรนด์ + โลโก้ · ข้อมูลพื้นฐาน · การถ่ายทำ · สถานที่ · ลิงก์กลุ่ม LINE · สร้างวันถ่ายตามจำนวนคิว · **ยืนยันแล้วล็อก (ฐานข้อมูลปฏิเสธการแก้ไขจนกว่าจะปลดล็อก)** |
| ทีมงาน | ตำแหน่งตามฝ่าย · สถานะ · เรท/งบ/วัน · ไฟล์ Workscope · เทมเพลตทีม · ลบพร้อมยืนยัน · **ประกาศหาตำแหน่งเพิ่ม → เข้าคิว `announcements` รอส่งผ่าน HOOSE Official LINE OA** |
| เอกสาร | หมวดเอกสาร ใส่ไฟล์/ลิงก์ได้ไม่จำกัด (ไฟล์ละ ≤ 50 MB, เก็บใน bucket ส่วนตัว) |
| ปฏิทินทีม | Kick-Off / Inner Team / General / Client Meeting · Brief before Production · Shoot Day · ยังไม่ระบุวัน (TBD) · เพิ่มลง Google Calendar |
| งบประมาณ | ใส่งบรวม → ร่างการแบ่งงบตามประเภทงานอัตโนมัติ · % ของงบรวม · คงเหลือ/เกินงบ |
| สรุปผล | ทุกส่วนในหน้าเดียว + **PDF A4 ไฟล์เดียว** มีโลโก้ HOOSE และเลขหน้า |
| สมาชิก | เชิญด้วยอีเมล (ส่งอีเมลเชิญอัตโนมัติ) · Owner / Editor / Viewer |
| ลิงก์แชร์ `/s/<token>` | หน้าสรุปผลแบบดูอย่างเดียว ไม่ต้องล็อกอิน · เปิด/ปิด · ซ่อนงบได้ · สร้างลิงก์ใหม่ได้ |

**สิทธิ์ (บังคับที่ฐานข้อมูลด้วย RLS ไม่ใช่แค่ซ่อนปุ่ม)**
- **Owner:** ทุกอย่าง รวมถึงลบโปรเจกต์
- **Editor:** แก้ไขทุกหน้า และเชิญสมาชิกได้
- **Viewer:** อ่านได้เฉพาะหน้าสรุปผลผ่าน `project_summary()` และไม่เห็นตัวเลขเงิน ถ้าไม่ได้เปิดให้เห็นงบ
- **คนนอกที่ไม่ใช่สมาชิก:** ไม่เห็นอะไรเลย

## โครงสร้างฐานข้อมูล
อยู่ในไฟล์ `supabase/migrations/0001_init.sql` (รันครั้งเดียว)

| ตาราง | เก็บอะไร |
|---|---|
| `profiles` | ผู้ใช้ (สร้างอัตโนมัติเมื่อล็อกอินครั้งแรก) |
| `projects` | รายละเอียดโปรเจกต์ สถานะล็อก การตั้งค่าลิงก์แชร์ |
| `project_members` / `project_invites` | สิทธิ์ต่อโปรเจกต์ / คำเชิญที่ยังไม่ล็อกอิน |
| `crew_positions` | ตำแหน่ง สถานะ ติดต่อ เรท งบ Workscope |
| `events` | นัดหมาย (`date` ว่าง = ยังไม่ระบุวัน) |
| `doc_categories` / `doc_files` | หมวดเอกสาร / ไฟล์หรือลิงก์ในหมวด |
| `budgets` / `budget_lines` | งบรวม งบทีมงาน / รายการงบ (`draft` = ร่างอัตโนมัติ) |
| `announcements` | คิวประกาศ `queued → sending → sent/failed` สำหรับ LINE OA |

**ไฟล์:** bucket `project-files` (ส่วนตัว) เก็บที่ `projects/<project_id>/{logo,docs,workscope}/…` เปิดดูผ่าน signed URL ที่หมดอายุใน 1 ชั่วโมง

---

## ติดตั้งครั้งแรก (ประมาณ 15 นาที)

### 1) Supabase
1. ไปที่ supabase.com แล้ว **New project** ตั้งชื่อ `hoose` และเลือก Region **Singapore**
2. เปิด **SQL Editor** วางเนื้อหาไฟล์ `supabase/migrations/0001_init.sql` ทั้งหมด แล้วกด **Run**
3. ไปที่ **Authentication → URL Configuration**
   - **Site URL** = ลิงก์ Vercel ของคุณ (ใส่หลังขั้นที่ 2) เช่น `https://hoose-app.vercel.app`
   - **Redirect URLs** เพิ่ม `https://hoose-app.vercel.app/auth/callback` และ `http://localhost:3000/auth/callback`
4. ไปที่ **Project Settings → API** แล้วจดค่าเหล่านี้ไว้: `Project URL`, `anon public` key และ `service_role` key (ห้ามเปิดเผย service_role)
5. (แนะนำ) ไปที่ **Authentication → Emails → SMTP** แล้วตั้ง SMTP ของ HOOSE เพื่อให้อีเมลเข้าสู่ระบบส่งจากโดเมนของคุณ เพราะ SMTP ในตัวของ Supabase ส่งได้จำนวนจำกัดต่อชั่วโมง

### 2) Vercel
1. ไปที่ vercel.com แล้วกด **Add New → Project** เลือก repo `hoose-app` จาก GitHub
2. ใส่ **Environment Variables** ตามตารางนี้ แล้วกด **Deploy**

| ชื่อ | ค่า |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key |
| `NEXT_PUBLIC_SITE_URL` | ลิงก์ Vercel เช่น `https://hoose-app.vercel.app` |

3. กลับไปตั้ง Site URL และ Redirect URLs ใน Supabase ให้ตรงกับลิงก์ Vercel (ข้อ 1.3)
4. เปิดลิงก์ Vercel → ใส่อีเมล → กดลิงก์ในอีเมล → ใช้งานได้

### 3) ย้ายข้อมูลจากต้นแบบ claude.ai (ถ้าต้องการ)
1. เปิดต้นแบบ "HOOSE ใช้งานภายใน" → หน้าภาพรวม → กด **ส่งออกข้อมูล (JSON)**
2. เข้าสู่ระบบใหม่ด้วยอีเมลของเจ้าของ 1 ครั้ง
3. ในเครื่องที่มีโค้ดนี้ ใส่ค่า `.env.local` (ดู `.env.example`) แล้วรัน:
   ```bash
   npm install
   node scripts/import-artifact.mjs hoose-export-YYYY-MM-DD.json owner@hoose.co
   ```
   ลิงก์เอกสารจะย้ายมาให้ แต่ไฟล์ที่อัปโหลดไว้ในต้นแบบ (โลโก้ / PDF) ต้องอัปโหลดใหม่

## พัฒนาในเครื่อง
```bash
cp .env.example .env.local   # ใส่ค่า Supabase
npm install
npm run dev                  # http://localhost:3000
npm run typecheck && npm run build
```

## ระยะถัดไป · HOOSE Official LINE OA
- ตาราง `announcements` เป็นคิวที่เตรียมไว้แล้ว รอบถัดไปจะเพิ่ม 2 ส่วน:
  - **worker:** route ฝั่งเซิร์ฟเวอร์หรือ cron ของ Vercel อ่านแถวสถานะ `queued` แล้วส่งผ่าน LINE Messaging API (ใช้ `LINE_CHANNEL_ACCESS_TOKEN`) และเปลี่ยนสถานะเป็น `sent` หรือ `failed`
  - **webhook `/api/line/webhook`:** รับการตอบรับงานและการยืนยันตำแหน่ง ตรวจลายเซ็นด้วย `LINE_CHANNEL_SECRET`
- เตรียมไว้ก่อน: เปิด Messaging API channel ของ Hooseofficial แล้วจด Channel access token (long-lived) และ Channel secret
