import ApplyForm from './ApplyForm';
import { liffId } from '@/lib/line-cards';

// Read the LIFF id at request time so a Vercel env change needs no rebuild.
export const dynamic = 'force-dynamic';
export const metadata = { title: 'HOOSE · ใบสมัคร' };

export default function Page() { return <ApplyForm liffId={liffId()} />; }
