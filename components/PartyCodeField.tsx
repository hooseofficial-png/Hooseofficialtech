'use client';
import { cleanCode } from '@/lib/domain';

/** Big 6-character Party Code input (accepts paste like "hx7-k2p"). */
export default function PartyCodeField({ value, onChange, onEnter, autoFocus, compact }: { value: string; onChange: (v: string) => void; onEnter?: () => void; autoFocus?: boolean; compact?: boolean }) {
  return (
    <input className={'in-t party-in' + (compact ? ' compact' : '')} value={value} autoFocus={autoFocus} placeholder="XXXXXX" aria-label="Party Code"
      inputMode="text" autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={8}
      onChange={e => onChange(cleanCode(e.target.value))} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onEnter?.(); } }} />
  );
}
