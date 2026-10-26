import {
  backupSchema,
  describeIssues,
  KINDS,
  saveRequestSchema,
  schemas,
  type Kind,
} from './schema.ts';

export const MAX_BODY_BYTES = 2_000_000;
export const MAX_BACKUP_BYTES = 5_000_000;

export type StoredRecord = { kind: Kind; payload: unknown; revision: number };

/** Database access scoped to the signed-in user (row-level security applies). */
export interface ProgressStore {
  list(): Promise<StoredRecord[]>;
  /** Compare-and-swap save. Returns the new revision, or null when stale. */
  save(kind: Kind, expectedRevision: number, payload: unknown): Promise<number | null>;
}

export interface ProgressDeps {
  /** Verified user id from the session, or null when signed out/expired. */
  getUserId(): Promise<string | null>;
  store: ProgressStore | null;
}

const respond = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' },
  });

const SIGNED_OUT = { error: 'Your session has ended. Sign in again to keep saving.', code: 'signed_out' };
const UNAVAILABLE = { error: 'Cloud storage is temporarily unavailable.', code: 'unavailable' };

type Authorized = { response: Response } | { response?: undefined; userId: string; store: ProgressStore };

async function authorize(deps: ProgressDeps): Promise<Authorized> {
  let userId: string | null;
  try {
    userId = await deps.getUserId();
  } catch {
    return { response: respond(UNAVAILABLE, 503) };
  }
  if (!userId) return { response: respond(SIGNED_OUT, 401) };
  if (!deps.store) return { response: respond(UNAVAILABLE, 503) };
  return { userId, store: deps.store };
}

/** Same-origin JSON body, bounded by actual streamed bytes. */
async function readJson(
  request: Request,
  limit: number,
): Promise<{ response: Response } | { response?: undefined; body: unknown }> {
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    return { response: respond({ error: 'Invalid origin', code: 'bad_origin' }, 403) };
  }
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    return { response: respond({ error: 'JSON required', code: 'bad_request' }, 415) };
  }
  const reader = request.body?.getReader();
  if (!reader) return { response: respond({ error: 'Missing body', code: 'bad_request' }, 400) };

  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      return { response: respond({ error: 'This data is too large to save.', code: 'too_large' }, 413) };
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return { body: JSON.parse(new TextDecoder().decode(bytes)) as unknown };
  } catch {
    return { response: respond({ error: 'Invalid JSON', code: 'bad_request' }, 400) };
  }
}

export async function getProgress(deps: ProgressDeps): Promise<Response> {
  const auth = await authorize(deps);
  if (auth.response) return auth.response;
  try {
    const rows = await auth.store.list();
    const records = Object.fromEntries(
      rows.map((row) => [row.kind, { value: row.payload, revision: row.revision }]),
    );
    return respond({ userId: auth.userId, records });
  } catch {
    return respond(UNAVAILABLE, 503);
  }
}

export async function putProgress(request: Request, deps: ProgressDeps): Promise<Response> {
  const auth = await authorize(deps);
  if (auth.response) return auth.response;

  const read = await readJson(request, MAX_BODY_BYTES);
  if (read.response) return read.response;

  const base = saveRequestSchema.safeParse(read.body);
  if (!base.success) return respond({ error: 'Invalid record', code: 'invalid' }, 400);

  // The page was loaded for one account; refuse to write it into another.
  if (base.data.userId !== auth.userId) {
    return respond(
      { error: 'You signed in as a different account in another tab. Reload before saving.', code: 'account_changed' },
      403,
    );
  }

  const parsed = schemas[base.data.kind].safeParse(base.data.value);
  if (!parsed.success) {
    return respond(
      { error: 'Some values are outside the allowed range.', code: 'invalid', issues: describeIssues(parsed.error) },
      400,
    );
  }

  try {
    const revision = await auth.store.save(base.data.kind, base.data.revision, parsed.data);
    if (revision === null) {
      return respond(
        { error: 'Newer changes were saved from another tab or device.', code: 'conflict' },
        409,
      );
    }
    return respond({ revision });
  } catch {
    return respond(UNAVAILABLE, 503);
  }
}

/**
 * Validates a backup file without saving it, so the import preview uses the
 * exact rules the save endpoint enforces.
 */
export async function validateBackup(request: Request, deps: ProgressDeps): Promise<Response> {
  const auth = await authorize(deps);
  if (auth.response) return auth.response;

  const read = await readJson(request, MAX_BACKUP_BYTES);
  if (read.response) return read.response;

  const backup = backupSchema.safeParse(read.body);
  if (!backup.success) {
    return respond({
      valid: false,
      kinds: {},
      errors: ['This is not a Daily Plate backup file (expected "version": 1).'],
    });
  }

  const kinds: Partial<Record<Kind, { present: boolean; valid: boolean; errors: string[] }>> = {};
  for (const kind of KINDS) {
    const value = backup.data[kind];
    if (value === undefined || value === null) {
      kinds[kind] = { present: false, valid: true, errors: [] };
      continue;
    }
    const parsed = schemas[kind].safeParse(value);
    kinds[kind] = {
      present: true,
      valid: parsed.success,
      errors: parsed.success ? [] : describeIssues(parsed.error),
    };
  }

  const present = KINDS.filter((kind) => kinds[kind]?.present);
  const valid = present.length > 0 && present.every((kind) => kinds[kind]?.valid);
  return respond({
    valid,
    kinds,
    errors: present.length ? [] : ['The backup has no fitness or nutrition records.'],
  });
}
