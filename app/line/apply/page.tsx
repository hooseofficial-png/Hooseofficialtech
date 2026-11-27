import LineApp from '../LineApp';
import { liffId } from '@/lib/line-cards';

// LIFF endpoint (current setting). Works for every view: ?view=apply|status|projects
export const dynamic = 'force-dynamic';
export const metadata = { title: 'HOOSE' };

export default function Page() { return <LineApp liffId={liffId()} view="apply" />; }
