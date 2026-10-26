import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProgressDeps, ProgressStore, StoredRecord } from './handler.ts';
import { KINDS, type Kind } from './schema.ts';
import { getVerifiedUser } from '../supabase/server.ts';

/** Store backed by the user's own Supabase session; RLS limits it to their rows. */
export function supabaseStore(supabase: SupabaseClient): ProgressStore {
  return {
    async list() {
      const { data, error } = await supabase.from('progress').select('kind, payload, revision');
      if (error) throw error;
      return (data ?? []).filter((row): row is StoredRecord =>
        (KINDS as readonly string[]).includes(row.kind),
      );
    },
    async save(kind: Kind, expectedRevision: number, payload: unknown) {
      const { data, error } = await supabase.rpc('save_progress', {
        p_kind: kind,
        p_expected_revision: expectedRevision,
        p_payload: payload,
      });
      if (error) throw error;
      return typeof data === 'number' ? data : null;
    },
  };
}

/** Request-scoped dependencies for the progress handlers. */
export async function requestDeps(): Promise<ProgressDeps> {
  const { supabase, user } = await getVerifiedUser();
  return {
    getUserId: async () => user?.id ?? null,
    store: supabase ? supabaseStore(supabase) : null,
  };
}
