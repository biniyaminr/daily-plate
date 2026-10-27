import { z } from 'zod';

// Bounds are carried over unchanged from the original Daily Plate API so
// existing JSON backups stay valid.

const MAX_YEAR = 2100;

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const [y, m, d] = value.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    return (
      y >= 2000 &&
      y <= MAX_YEAR &&
      date.getUTCFullYear() === y &&
      date.getUTCMonth() === m - 1 &&
      date.getUTCDate() === d
    );
  }, 'Invalid calendar date');

const num = (min: number, max: number) => z.number().finite().min(min).max(max);

const setEntry = z.object({
  kg: num(0, 1000).nullable().optional(),
  reps: num(0, 200).nullable().optional(),
  done: z.boolean().optional(),
});

const dayLog = z.object({
  meals: z.array(z.boolean().nullable()).max(5),
  sets: z.record(z.string().regex(/^\d{1,2}-\d{1,2}$/), setEntry),
  walk: num(0, 1440),
  sleep: num(0, 24),
  recovery: z.boolean(),
  note: z.string().max(1000),
  shopping: z.array(z.boolean().nullable()).max(5).optional(),
});

export const fitnessSchema = z.object({
  profile: z.object({
    weight: num(30, 300),
    height: num(100, 250),
    start: isoDate,
    walk: num(0, 300),
    // Personal plan settings. Optional so older records and backups stay valid.
    name: z.string().trim().max(60).optional(),
    goal: z.enum(['lose', 'gain', 'recomp', 'maintain']).optional(),
    sex: z.enum(['female', 'male']).optional(),
    age: z.number().int().min(18).max(100).optional(),
    activity: z.enum(['sedentary', 'light', 'moderate', 'active', 'very']).optional(),
    fasting: z.enum(['none', 'wedfri', 'all']).optional(),
  }),
  weights: z.record(isoDate, num(30, 300)),
  logs: z.record(isoDate, dayLog),
});

const foodRow = z.object({
  id: z.string().regex(/^[a-zA-Z0-9-]+$/).max(100),
  // [name, kcal, protein, carbs, fat] per 100 g
  food: z.tuple([z.string().min(1).max(200), num(0, 1000), num(0, 100), num(0, 100), num(0, 100)]),
  grams: num(1, 5000),
  meal: z.enum(['Breakfast', 'Lunch', 'Dinner', 'Snacks']),
});

export const nutritionSchema = z.object({
  // [kcal, protein g, carbs g, fat g]
  goals: z.tuple([num(1, 20000), num(1, 1000), num(1, 2000), num(1, 1000)]),
  days: z.record(isoDate, z.array(foodRow).max(1000)),
});

export const KINDS = ['fitness', 'nutrition'] as const;
export type Kind = (typeof KINDS)[number];

export const schemas = { fitness: fitnessSchema, nutrition: nutritionSchema } as const;

export const saveRequestSchema = z.object({
  userId: z.string().min(1),
  kind: z.enum(KINDS),
  revision: z.number().int().min(0).max(2_000_000_000),
  value: z.unknown(),
});

/** The original backup file format: { version: 1, fitness, nutrition }. */
export const backupSchema = z.object({
  version: z.literal(1),
  fitness: z.unknown().optional(),
  nutrition: z.unknown().optional(),
});

/** Human-readable list of the first few validation problems. */
export function describeIssues(error: z.ZodError, limit = 5): string[] {
  return error.issues.slice(0, limit).map((issue) => {
    const where = issue.path.length ? issue.path.join(' › ') : 'file';
    return `${where}: ${issue.message}`;
  });
}
