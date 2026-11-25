import { NextResponse } from 'next/server';
import { googleConfigured } from '@/lib/google';

export const dynamic = 'force-dynamic';
// Whether Google Calendar API (OAuth) has been set up on the server. UI hides "เชื่อมบัญชี Google" until it is.
export function GET() { return NextResponse.json({ configured: googleConfigured() }); }
