import { serveShell } from '@/lib/shell';

export const dynamic = 'force-dynamic';

export function GET() {
  return serveShell('nutrition.html', '/app/nutrition');
}
