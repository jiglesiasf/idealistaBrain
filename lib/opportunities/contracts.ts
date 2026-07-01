import { z } from "zod";

export const OPPORTUNITY_STATUSES = ["active", "archived"] as const;
export const OPPORTUNITY_SOURCES = ["manual", "analysis"] as const;

export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];
export type OpportunitySource = (typeof OPPORTUNITY_SOURCES)[number];

export const CreateOpportunityInputSchema = z.object({
  listingUrl: z.string().url().max(2048),
  title: z.string().trim().max(200).optional().nullable(),
  priceEur: z.number().int().min(0).optional().nullable(),
  estimatedRentEur: z.number().int().min(0).optional().nullable(),
  totalCashNeededEur: z.number().int().min(0).optional().nullable(),
  sqmeters: z.number().min(0).optional().nullable(),
  bedrooms: z.number().int().min(0).optional().nullable(),
  bathrooms: z.number().int().min(0).optional().nullable(),
  cashOnCashRoi: z.number().min(-1).max(10).optional().nullable(),
  cashOnCashNetRoi: z.number().min(-1).max(10).optional().nullable(),
  grossRoi: z.number().min(-1).max(10).optional().nullable(),
  netRoi: z.number().min(-1).max(10).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  source: z.enum(OPPORTUNITY_SOURCES).default("manual"),
  sourceJobId: z.string().uuid().optional().nullable(),
});

export const UpdateOpportunityInputSchema = z.object({
  listingUrl: z.string().url().max(2048).optional(),
  title: z.string().trim().max(200).optional().nullable(),
  priceEur: z.number().int().min(0).optional().nullable(),
  estimatedRentEur: z.number().int().min(0).optional().nullable(),
  totalCashNeededEur: z.number().int().min(0).optional().nullable(),
  sqmeters: z.number().min(0).optional().nullable(),
  bedrooms: z.number().int().min(0).optional().nullable(),
  bathrooms: z.number().int().min(0).optional().nullable(),
  cashOnCashRoi: z.number().min(-1).max(10).optional().nullable(),
  cashOnCashNetRoi: z.number().min(-1).max(10).optional().nullable(),
  grossRoi: z.number().min(-1).max(10).optional().nullable(),
  netRoi: z.number().min(-1).max(10).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  status: z.enum(OPPORTUNITY_STATUSES).optional(),
});

export type CreateOpportunityInput = z.infer<typeof CreateOpportunityInputSchema>;
export type UpdateOpportunityInput = z.infer<typeof UpdateOpportunityInputSchema>;

export type OpportunitySummary = {
  id: string;
  listingUrl: string;
  listingId: string | null;
  title: string | null;
  priceEur: number | null;
  estimatedRentEur: number | null;
  totalCashNeededEur: number | null;
  sqmeters: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  cashOnCashRoi: number | null;
  cashOnCashNetRoi: number | null;
  grossRoi: number | null;
  netRoi: number | null;
  notes: string | null;
  status: OpportunityStatus;
  source: OpportunitySource;
  sourceJobId: string | null;
  createdAt: string;
  updatedAt: string;
};
