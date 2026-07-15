import { z } from "zod";

export const CreatePisoInputSchema = z.object({
  title: z.string().trim().max(200).optional().nullable(),
  listingUrl: z.string().max(2048).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),

  priceEur: z.number().int().min(0).optional().nullable(),
  sqmeters: z.number().min(0).optional().nullable(),
  bedrooms: z.number().int().min(0).optional().nullable(),
  bathrooms: z.number().int().min(0).optional().nullable(),
  propertyType: z.string().max(100).optional().nullable(),

  estimatedRentEur: z.number().int().min(0).optional().nullable(),

  itpRate: z.number().min(0).max(1).optional().nullable(),
  notaryRegistryEur: z.number().int().min(0).optional().nullable(),
  mortgageFeesEur: z.number().int().min(0).optional().nullable(),
  renovationCostEur: z.number().int().min(0).optional().nullable(),
  purchaseCommissionEur: z.number().int().min(0).optional().nullable(),
  furnitureOtherEur: z.number().int().min(0).optional().nullable(),

  loanToValue: z.number().min(0).max(1).optional().nullable(),
  interestRate: z.number().min(0).max(1).optional().nullable(),
  mortgageTermYears: z.number().int().min(0).max(50).optional().nullable(),

  ibiBasurasEur: z.number().int().min(0).optional().nullable(),
  insuranceEur: z.number().int().min(0).optional().nullable(),
  communityEur: z.number().int().min(0).optional().nullable(),
  maintenanceEur: z.number().int().min(0).optional().nullable(),
  vacancyMonths: z.number().min(0).max(12).optional().nullable(),

  grossYield: z.number().min(-1).max(10).optional().nullable(),
  netYield: z.number().min(-1).max(10).optional().nullable(),
  cashOnCashRoi: z.number().min(-1).max(10).optional().nullable(),
  cashOnCashNetRoi: z.number().min(-1).max(10).optional().nullable(),
  totalCashNeededEur: z.number().int().min(0).optional().nullable(),
  monthlyMortgageEur: z.number().int().optional().nullable(),
  monthlyNetCashFlowEur: z.number().int().optional().nullable(),
});

export const UpdatePisoInputSchema = CreatePisoInputSchema.partial();

export type CreatePisoInput = z.infer<typeof CreatePisoInputSchema>;
export type UpdatePisoInput = z.infer<typeof UpdatePisoInputSchema>;

export type PisoInteresante = {
  id: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;

  title: string | null;
  listingUrl: string | null;
  notes: string | null;

  priceEur: number | null;
  sqmeters: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  propertyType: string | null;

  estimatedRentEur: number | null;

  itpRate: number | null;
  notaryRegistryEur: number | null;
  mortgageFeesEur: number | null;
  renovationCostEur: number | null;
  purchaseCommissionEur: number | null;
  furnitureOtherEur: number | null;

  loanToValue: number | null;
  interestRate: number | null;
  mortgageTermYears: number | null;

  ibiBasurasEur: number | null;
  insuranceEur: number | null;
  communityEur: number | null;
  maintenanceEur: number | null;
  vacancyMonths: number | null;

  grossYield: number | null;
  netYield: number | null;
  cashOnCashRoi: number | null;
  cashOnCashNetRoi: number | null;
  totalCashNeededEur: number | null;
  monthlyMortgageEur: number | null;
  monthlyNetCashFlowEur: number | null;
};
