import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';
export async function GET() { return NextResponse.json({ admin: !!(await requireAdmin()) }); }
