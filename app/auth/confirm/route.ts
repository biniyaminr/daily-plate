import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeNextPath } from '@/lib/supabase/env';

const OTP_TYPES: EmailOtpType[] = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'];

/**
 * Landing point for links in confirmation and password-reset emails.
 * Prefers token_hash links (work on any device); also accepts the default
 * PKCE ?code= links (work in the browser that requested them).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeNextPath(searchParams.get('next'));
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const code = searchParams.get('code');

  const fail = (reason: string) => {
    const url = new URL('/login', request.url);
    url.searchParams.set('error', reason);
    return NextResponse.redirect(url, { headers: { 'Cache-Control': 'private, no-store' } });
  };

  const supabase = await createClient();
  if (!supabase) return fail('not_configured');

  if (tokenHash && type && OTP_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) return fail('link_expired');
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail('link_other_device');
  } else {
    return fail('link_invalid');
  }

  return NextResponse.redirect(new URL(next, request.url), {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
