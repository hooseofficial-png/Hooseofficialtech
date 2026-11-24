'use client';
import { useState } from 'react';
import { useProject } from '@/components/ProjectProvider';
import Modal from '@/components/Modal';
import { sb, BUCKET } from '@/lib/supabase/client';
import { docOk, safeUrl, type DocCategory } from '@/lib/domain';
import { toast } from '@/lib/ui';

export default function Docs() {
  const { id, data, act, upload, openFile, reload } = useProject();
  const [newCat, setNewCat] = useState('');
  const [link, setLink] = useState<DocCategory | null>(null);
  const [url, setUrl] = useState(''); const [name, setName] = useState('');
  const [delCat, setDelCat] = useState<DocCategory | null>(null);
  if (!data) return null;
  const docs = data.docs; const dn = docs.filter(docOk).length; const fc = docs.reduce((a, c) => a + c.files.length, 0);

  async function addFiles(c: DocCategory, list: FileList | null) {
    const files = [...(list || [])]; let ok = 0;
    for (const f of files) {
      toast('กำลังอัปโหลด ' + f.name + '…');
      const r = await upload(f, 'docs');
      if (r) { const { error } = await sb().from('doc_files').insert({ category_id: c.id, project_id: id, storage_path: r.path, name: r.name, size_bytes: r.size }); if (!error) ok++; }
    }
    if (ok) toast('อัปโหลดแล้ว ' + ok + ' ไฟล์'); reload();
  }
  async function removeFile(fid: string, path: string | null) {
    if (path) await sb().storage.from(BUCKET).remove([path]);
    act(() => sb().from('doc_files').delete().eq('id', fid), 'นำไฟล์ออกแล้ว');
  }
  return (
    <>
      <section className="card">
        <div className="between"><h2>คลังเอกสาร</h2><div className="row w"><span className="chip lb num">{dn}/{docs.length} หมวดมีไฟล์</span><span className="chip num">{fc} ไฟล์</span></div></div>
        <div className="bar"><i style={{ width: (docs.length ? dn / docs.length * 100 : 0) + '%' }} /></div>
        <div className="mut" style={{ fontSize: 12 }}>เพิ่มไฟล์ในแต่ละหมวดได้ไม่จำกัด (ไฟล์ละไม่เกิน 50 MB) หรือวางลิงก์ เช่น Google Drive</div>
      </section>
      <div className="docs">
        {docs.map(c => {
          const on = c.files.length > 0;
          return (
            <div key={c.id} className={'doc' + (on ? ' on' : '')}>
              <div className="between"><b>{c.title}{on && <span className="num" style={{ fontWeight: 500, opacity: .8 }}> · {c.files.length}</span>}</b>
                <button className="btn sm ghost" style={{ padding: '0 6px' }} onClick={() => setDelCat(c)} aria-label={'ลบหมวด ' + c.title}>✕</button></div>
              {on ? <div className="list">{c.files.map(f =>
                <div className="row" key={f.id} style={{ gap: 6, fontSize: 12 }}>
                  <button className="link-btn grow ell" style={{ color: 'inherit', textAlign: 'left', fontWeight: 500 }} onClick={() => openFile(f.storage_path, safeUrl(f.url))}>{f.name || f.url} ↗</button>
                  <button className="btn sm ghost" style={{ height: 24, padding: '0 6px' }} onClick={() => removeFile(f.id, f.storage_path)} aria-label="นำไฟล์ออก">✕</button>
                </div>)}</div> : <div className="mut" style={{ fontSize: 12 }}>ยังไม่มีไฟล์</div>}
              <div className="row w" style={{ marginTop: 'auto' }}>
                <label className={'btn sm' + (on ? '' : ' p')} htmlFor={'up-' + c.id}>+ ไฟล์</label>
                <input type="file" id={'up-' + c.id} hidden multiple onChange={e => { addFiles(c, e.target.files); e.target.value = ''; }} />
                <button className="btn sm" onClick={() => { setLink(c); setUrl(''); setName(''); }}>+ ลิงก์</button>
              </div>
            </div>
          );
        })}
        <form className="doc" style={{ justifyContent: 'center' }} onSubmit={e => { e.preventDefault(); const v = newCat.trim(); if (v) { act(() => sb().from('doc_categories').insert({ project_id: id, title: v, sort: docs.length })); setNewCat(''); } }}>
          <label className="f" htmlFor="doc-new">หมวดเอกสารใหม่<input className="in-t" id="doc-new" value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="เช่น ประกันภัย" /></label>
          <button className="btn sm">+ เพิ่มหมวด</button>
        </form>
      </div>
      {link && <Modal title={'เพิ่มลิงก์ · ' + link.title} onClose={() => setLink(null)}>
        <label className="f" htmlFor="lk-url">ลิงก์ (https://)<input className="in-t" id="lk-url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://drive.google.com/…" /></label>
        <label className="f" htmlFor="lk-name">ชื่อที่แสดง (ไม่บังคับ)<input className="in-t" id="lk-name" value={name} onChange={e => setName(e.target.value)} placeholder="เช่น Storyboard v3" /></label>
        <div className="row"><button className="btn p" onClick={() => { const u = safeUrl(url); if (!u) { toast('ลิงก์ต้องขึ้นต้นด้วย https://'); return; } const c = link; setLink(null); act(() => sb().from('doc_files').insert({ category_id: c.id, project_id: id, url: u, name: name.trim() || u }), 'เพิ่มลิงก์แล้ว'); }}>บันทึก</button><button className="btn" onClick={() => setLink(null)}>ยกเลิก</button></div>
      </Modal>}
      {delCat && <Modal title={'ลบหมวด ' + delCat.title + '?'} onClose={() => setDelCat(null)}>
        <p className="mut" style={{ margin: 0 }}>{delCat.files.length ? 'ไฟล์ ' + delCat.files.length + ' ไฟล์ในหมวดนี้จะถูกลบด้วย' : 'หมวดนี้ยังไม่มีไฟล์'}</p>
        <div className="row"><button className="btn k" onClick={async () => { const c = delCat; setDelCat(null); const paths = c.files.map(f => f.storage_path).filter(Boolean) as string[]; if (paths.length) await sb().storage.from(BUCKET).remove(paths); act(() => sb().from('doc_categories').delete().eq('id', c.id), 'ลบหมวดแล้ว'); }}>ลบหมวด</button><button className="btn" onClick={() => setDelCat(null)}>ยกเลิก</button></div>
      </Modal>}
    </>
  );
}
