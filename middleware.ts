import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PUBLIC = [/^\/login/, /^\/auth\//, /^\/s\//, /^\/api\/share\//, /^\/api\/line\//, /^\/line\//, /^\/api\/calendar\//];

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  // API routes check the session themselves; skip the extra auth round-trip here.
  if (path.startsWith('/api/')) return NextResponse.next();
  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      }
    }
  });
  // Reads (and refreshes when expired) the session cookie without calling the auth server on every navigation.
  // Pages fetch data client-side under Row Level Security, so this check only decides the /login redirect.
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user && !PUBLIC.some(r => r.test(path))) {
    const url = req.nextUrl.clone(); url.pathname = '/login'; url.search = ''; url.searchParams.set('next', path + req.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.png|hoose-logo.*\\.png).*)'] };
