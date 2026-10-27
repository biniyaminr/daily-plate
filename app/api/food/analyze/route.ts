import { analyzePhoto } from '@/lib/food/analyze';
import { analyzeWithClaude, claudeConfigured } from '@/lib/food/claude';
import { getVerifiedUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(request: Request) {
  const { supabase, user } = await getVerifiedUser();
  return analyzePhoto(request, {
    getUserId: async () => user?.id ?? null,
    configured: claudeConfigured(),
    async useQuota(limit) {
      if (!supabase) throw new Error('No database client');
      const { data, error } = await supabase.rpc('use_ai_quota', { p_limit: limit });
      if (error) throw error;
      return data === true;
    },
    analyze: analyzeWithClaude,
  });
}
