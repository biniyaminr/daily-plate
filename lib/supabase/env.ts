// Only public values live here. The service-role / secret key is never used
// by this app: every query runs as the signed-in user under row-level security.

export function supabaseEnv(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // The Vercel Supabase integration injects the legacy anon key name; newer
  // projects use a publishable key. Either is safe to expose to the browser.
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url, key };
}

/** Paths that only make sense when signed in. */
export const PROTECTED_PREFIXES = ['/app', '/reset-password'];

/**
 * Accept only same-site relative paths as post-login destinations, so a link
 * like /login?next=https://evil.example cannot redirect off the site.
 */
export function safeNextPath(value: string | null | undefined, fallback = '/app'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return fallback;
  }
  try {
    const url = new URL(value, 'https://local.invalid');
    if (url.origin !== 'https://local.invalid') return fallback;
    if (url.pathname.startsWith('/auth/')) return fallback;
    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
}
