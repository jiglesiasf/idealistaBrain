import { z } from "zod";

export const CreateSavedSearchInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  idealistaSearchUrl: z.url().max(2048),
  idealistaAlertLabel: z.string().trim().max(160).optional().nullable(),
});

export const UpdateSavedSearchInputSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  idealistaSearchUrl: z.url().max(2048).optional(),
  idealistaAlertLabel: z.string().trim().max(160).nullable().optional(),
  isActive: z.boolean().optional(),
});

export type CreateSavedSearchInput = z.infer<typeof CreateSavedSearchInputSchema>;
export type UpdateSavedSearchInput = z.infer<typeof UpdateSavedSearchInputSchema>;

export type SavedSearchSummary = {
  id: string;
  name: string;
  idealistaSearchUrl: string;
  idealistaAlertLabel: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AlertRadarOpportunity = {
  id: string;
  listingId: string | null;
  listingUrl: string;
  title: string | null;
  createdAt: string;
  savedSearchName: string | null;
  alertEventId: string;
  linkedJobId: string | null;
  linkedJobStatus: "queued" | "dispatching" | "running" | "completed" | "failed" | null;
  cashOnCashRoi: number | null;
  cashOnCashNetRoi: number | null;
  grossRoi: number | null;
  netRoi: number | null;
};

export type AlertRadarSummary = {
  opportunities: AlertRadarOpportunity[];
  newListingsToday: number;
  searchesTriggeredToday: number;
  automaticJobsToday: number;
};
