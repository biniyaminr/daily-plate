import { z } from 'zod';
import { readJson, respond } from '../progress/handler.ts';

export const MAX_PHOTO_BYTES = 3_000_000;
export const DAILY_PHOTO_LIMIT = 20;

export const photoRequestSchema = z.object({
  image: z
    .string()
    .max(MAX_PHOTO_BYTES)
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/, 'Expected a JPEG, PNG or WebP photo'),
  note: z.string().trim().max(300).optional(),
  goal: z.enum(['lose', 'gain', 'recomp', 'maintain']).optional(),
});
export type PhotoRequest = z.infer<typeof photoRequestSchema>;

export interface FoodEstimate {
  name: string;
  local_name: string;
  grams: number;
  kcal_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  confidence: 'high' | 'medium' | 'low';
  portion_note: string;
}
export interface PhotoAnalysis {
  is_food: boolean;
  meal_summary: string;
  items: FoodEstimate[];
  tips: string[];
}

/** Why the model call failed, in terms the handler can answer with. */
export class AnalysisError extends Error {
  readonly kind: 'busy' | 'declined' | 'failed';
  constructor(kind: 'busy' | 'declined' | 'failed', message: string) {
    super(message);
    this.kind = kind;
  }
}

export interface PhotoDeps {
  getUserId(): Promise<string | null>;
  /** False when the model isn't configured (no API key on the server). */
  configured: boolean;
  /** Takes one analysis from today's allowance; false when it is used up. */
  useQuota(limit: number): Promise<boolean>;
  analyze(request: PhotoRequest): Promise<PhotoAnalysis>;
}

const round = (n: number, step = 0.1) => Math.round(n / step) * step;
const clamp = (n: number, lo: number, hi: number) => (Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo);

/** Keeps model output inside the food log's own validation bounds. */
export function cleanAnalysis(raw: PhotoAnalysis): PhotoAnalysis {
  const items = raw.is_food
    ? raw.items.slice(0, 12).map((item) => ({
        name: item.name.trim().slice(0, 80) || 'Food',
        local_name: item.local_name.trim().slice(0, 40),
        grams: Math.round(clamp(item.grams, 1, 5000)),
        kcal_per_100g: round(clamp(item.kcal_per_100g, 0, 1000)),
        protein_per_100g: round(clamp(item.protein_per_100g, 0, 100)),
        carbs_per_100g: round(clamp(item.carbs_per_100g, 0, 100)),
        fat_per_100g: round(clamp(item.fat_per_100g, 0, 100)),
        confidence: item.confidence,
        portion_note: item.portion_note.trim().slice(0, 200),
      }))
    : [];
  return {
    is_food: raw.is_food && items.length > 0,
    meal_summary: raw.meal_summary.trim().slice(0, 300),
    items,
    tips: raw.tips.slice(0, 2).map((tip) => tip.trim().slice(0, 240)),
  };
}

/** POST /api/food/analyze: estimate the foods in one photo. Nothing is stored. */
export async function analyzePhoto(request: Request, deps: PhotoDeps): Promise<Response> {
  const read = await readJson(request, MAX_PHOTO_BYTES + 2_000);
  if (read.response) return read.response;
  const parsed = photoRequestSchema.safeParse(read.body);
  if (!parsed.success) return respond({ error: 'Send one JPEG, PNG or WebP photo.', code: 'bad_request' }, 400);

  let userId: string | null;
  try {
    userId = await deps.getUserId();
  } catch {
    return respond({ error: 'Your account is temporarily unavailable.', code: 'unavailable' }, 503);
  }
  if (!userId) return respond({ error: 'Your session has ended. Sign in again.', code: 'signed_out' }, 401);
  if (!deps.configured) {
    return respond({ error: 'Photo analysis isn’t switched on for this site yet.', code: 'not_configured' }, 503);
  }

  let allowed: boolean;
  try {
    allowed = await deps.useQuota(DAILY_PHOTO_LIMIT);
  } catch {
    return respond({ error: 'Photo analysis isn’t set up yet.', code: 'not_configured' }, 503);
  }
  if (!allowed) {
    return respond(
      { error: `You’ve used today’s ${DAILY_PHOTO_LIMIT} photo analyses. Add foods by hand, or try again tomorrow.`, code: 'limit' },
      429,
    );
  }

  try {
    return respond({ analysis: cleanAnalysis(await deps.analyze(parsed.data)) });
  } catch (error) {
    if (error instanceof AnalysisError) {
      const status = error.kind === 'busy' ? 503 : error.kind === 'declined' ? 422 : 502;
      return respond({ error: error.message, code: error.kind }, status);
    }
    return respond({ error: 'The photo couldn’t be analysed. Try again.', code: 'failed' }, 502);
  }
}
