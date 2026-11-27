import LineApp from './LineApp';
import { liffId } from '@/lib/line-cards';

// Same LIFF app at /line (if the LIFF endpoint is set to /line instead of /line/apply).
export const dynamic = 'force-dynamic';
export const metadata = { title: 'HOOSE' };

export default function Page() { return <LineApp liffId={liffId()} view="status" />; }
