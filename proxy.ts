import type { NextRequest } from 'next/server';
import { updateSession } from './lib/supabase/proxy';

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Skip static assets; everything else gets a refreshed session.
  matcher: ['/((?!_next/static|_next/image|plate/|favicon\\.svg|robots\\.txt).*)'],
};
