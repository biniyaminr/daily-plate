import { validateBackup } from '@/lib/progress/handler';
import { requestDeps } from '@/lib/progress/supabase-store';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return validateBackup(request, await requestDeps());
}
