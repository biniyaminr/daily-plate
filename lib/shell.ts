import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { claudeConfigured } from './food/claude';
import { getVerifiedUser } from './supabase/server';

const escapeAttr = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * Serves one of the original Daily Plate pages to a verified user. The HTML
 * holds no personal records; those load from /api/progress after sign-in.
 * The account id is embedded so the sync script can tell which account's
 * local cache belongs to this page. The photo log only shows when the
 * server has an AI key, so nobody sees a button that can't work.
 */
export async function serveShell(file: 'index.html' | 'nutrition.html', pathname: string) {
  const { user } = await getVerifiedUser();
  if (!user) {
    const login = new URL('/login', 'https://placeholder.invalid');
    login.searchParams.set('next', pathname);
    return new NextResponse(null, {
      status: 307,
      headers: { Location: `${login.pathname}${login.search}`, 'Cache-Control': 'private, no-store' },
    });
  }

  const html = await readFile(path.join(process.cwd(), 'shell', file), 'utf8');
  const meta =
    `<meta name="plate-user" content="${escapeAttr(user.id)}">` +
    `<meta name="plate-email" content="${escapeAttr(user.email ?? '')}">` +
    (claudeConfigured() ? '<meta name="plate-photo" content="on">' : '');

  return new NextResponse(html.replace('</head>', `${meta}</head>`), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
    },
  });
}
