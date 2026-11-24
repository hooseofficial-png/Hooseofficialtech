'use client';
import { useEffect, useState } from 'react';

export default function Toaster() {
  const [msg, setMsg] = useState('');
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const on = (e: Event) => { setMsg((e as CustomEvent).detail); clearTimeout(t); t = setTimeout(() => setMsg(''), 2800); };
    window.addEventListener('hoose:toast', on);
    return () => { window.removeEventListener('hoose:toast', on); clearTimeout(t); };
  }, []);
  return <div id="toast" className={msg ? 'on' : ''} role="status" aria-live="polite">{msg}</div>;
}
