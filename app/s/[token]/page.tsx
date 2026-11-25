import Link from 'next/link';

// Old public share links. Sharing now needs an account + the project's Party Code.
export default function SharedPage() {
  return (
    <>
      <header className="top"><div className="in"><img src="/hoose-logo.png" alt="HOOSE" style={{ height: 28 }} /></div></header>
      <main className="wrap" style={{ maxWidth: 560 }}>
        <div className="card join-card">
          <h1>ลิงก์แชร์เปลี่ยนเป็น Party Code แล้ว</h1>
          <p className="mut" style={{ margin: 0 }}>เพื่อความปลอดภัยของข้อมูลโปรเจกต์ ทุกคนต้องมีบัญชี HOOSE และใส่ Party Code 6 ตัวของโปรเจกต์ ขอ Code จาก Production Manager หรือ Producer</p>
          <Link className="btn p lg" href="/join">ใส่ Party Code</Link>
          <Link className="btn lg" href="/login?mode=signup&next=%2Fjoin">ยังไม่มีบัญชี? สมัครสมาชิก</Link>
        </div>
      </main>
    </>
  );
}
