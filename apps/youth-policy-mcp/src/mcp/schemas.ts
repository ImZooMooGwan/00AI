import * as z from "zod/v4";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 형식이어야 합니다.");

export const commonOutputSchema = z
  .object({
    ok: z.boolean(),
    data: z.unknown().optional(),
    error: z
      .object({
        code: z.string(),
        message: z.string(),
        retryable: z.boolean(),
      })
      .optional(),
    meta: z.object({
      as_of: z.string().optional(),
      retrieved_at: z.string(),
      sources: z.array(z.record(z.string(), z.unknown())).optional(),
      warnings: z.array(z.string()).optional(),
      is_cached: z.boolean().optional(),
    }),
  })
  .passthrough();

export const searchInputSchema = z.object({
  query: z.string().trim().min(1).max(200).optional(),
  region_codes: z.array(z.string().trim().min(1).max(30)).max(20).optional(),
  large_categories: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
  medium_categories: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
  age: z.number().int().min(0).max(120).optional(),
  employment_status: z.string().trim().min(1).max(100).optional(),
  application_status: z
    .enum(["open", "closing_soon", "upcoming", "closed", "always_open", "unknown"])
    .optional(),
  as_of: isoDate.optional(),
  page: z.number().int().min(1).max(10_000).default(1),
  page_size: z.number().int().min(1).max(50).default(20),
});

export const getPolicyInputSchema = z.object({
  policy_id: z.string().trim().min(1).max(200),
  as_of: isoDate.optional(),
});

export const eligibilityInputSchema = z.object({
  policy_id: z.string().trim().min(1).max(200),
  as_of: isoDate.optional(),
  profile: z.object({
    age: z.number().int().min(0).max(120).optional(),
    region: z.string().trim().min(1).max(50).optional(),
    income: z.number().nonnegative().max(10_000_000_000).optional(),
    income_band: z.string().trim().min(1).max(100).optional(),
    employment_status: z.string().trim().min(1).max(100).optional(),
    enrollment_status: z.string().trim().min(1).max(100).optional(),
    education: z.string().trim().min(1).max(100).optional(),
    major: z.string().trim().min(1).max(100).optional(),
    marital_status: z.string().trim().min(1).max(100).optional(),
    special_conditions: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
  }),
});

export const compareInputSchema = z
  .object({
    policy_ids: z.array(z.string().trim().min(1).max(200)).min(2).max(10).optional(),
    regions: z.array(z.string().trim().min(1).max(50)).min(1).max(20).optional(),
    category: z.string().trim().min(1).max(100).optional(),
    fields: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
    as_of: isoDate.optional(),
  })
  .refine(
    (input) => Boolean(input.policy_ids?.length || (input.regions?.length && input.category)),
    "policy_ids 또는 regions와 category를 함께 입력해야 합니다.",
  );

export const changesInputSchema = z.object({
  policy_id: z.string().trim().min(1).max(200),
  from: isoDate.optional(),
  to: isoDate.optional(),
});

export const evidenceInputSchema = z.object({
  policy_id: z.string().trim().min(1).max(200),
  fields: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
});
