import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  // Only accept sign-out from our own pages.
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  }
  const supabase = await createClient();
  await supabase?.auth.signOut({ scope: 'local' });
  return NextResponse.redirect(new URL('/login?signed_out=1', request.url), {
    status: 303,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
