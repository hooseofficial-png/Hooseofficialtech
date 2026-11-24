'use client';
import { useEffect } from 'react';

export default function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="modal" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="card" role="dialog" aria-modal="true" aria-label={title}>
        <div className="between"><h2>{title}</h2><button className="btn sm ghost" onClick={onClose} aria-label="ปิด">✕</button></div>
        {children}
      </div>
    </div>
  );
}
