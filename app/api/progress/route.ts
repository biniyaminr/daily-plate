import { getProgress, putProgress } from '@/lib/progress/handler';
import { requestDeps } from '@/lib/progress/supabase-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  return getProgress(await requestDeps());
}

export async function PUT(request: Request) {
  return putProgress(request, await requestDeps());
}
