import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CreatePisoInputSchema,
  UpdatePisoInputSchema,
  type PisoInteresante,
} from "@/lib/pisos-interesantes/contracts";

type RawPisoRow = {
  id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  title: string | null;
  listing_url: string | null;
  notes: string | null;
  price_eur: number | null;
  sqmeters: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  property_type: string | null;
  estimated_rent_eur: number | null;
  itp_rate: number | null;
  notary_registry_eur: number | null;
  mortgage_fees_eur: number | null;
  renovation_cost_eur: number | null;
  purchase_commission_eur: number | null;
  furniture_other_eur: number | null;
  loan_to_value: number | null;
  interest_rate: number | null;
  mortgage_term_years: number | null;
  ibi_basuras_eur: number | null;
  insurance_eur: number | null;
  community_eur: number | null;
  maintenance_eur: number | null;
  vacancy_months: number | null;
  gross_yield: number | null;
  net_yield: number | null;
  cash_on_cash_roi: number | null;
  cash_on_cash_net_roi: number | null;
  total_cash_needed_eur: number | null;
  monthly_mortgage_eur: number | null;
  monthly_net_cash_flow_eur: number | null;
};

function mapPisoRow(row: RawPisoRow): PisoInteresante {
  return {
    id: row.id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    title: row.title,
    listingUrl: row.listing_url,
    notes: row.notes,
    priceEur: row.price_eur,
    sqmeters: row.sqmeters,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    propertyType: row.property_type,
    estimatedRentEur: row.estimated_rent_eur,
    itpRate: row.itp_rate,
    notaryRegistryEur: row.notary_registry_eur,
    mortgageFeesEur: row.mortgage_fees_eur,
    renovationCostEur: row.renovation_cost_eur,
    purchaseCommissionEur: row.purchase_commission_eur,
    furnitureOtherEur: row.furniture_other_eur,
    loanToValue: row.loan_to_value,
    interestRate: row.interest_rate,
    mortgageTermYears: row.mortgage_term_years,
    ibiBasurasEur: row.ibi_basuras_eur,
    insuranceEur: row.insurance_eur,
    communityEur: row.community_eur,
    maintenanceEur: row.maintenance_eur,
    vacancyMonths: row.vacancy_months,
    grossYield: row.gross_yield,
    netYield: row.net_yield,
    cashOnCashRoi: row.cash_on_cash_roi,
    cashOnCashNetRoi: row.cash_on_cash_net_roi,
    totalCashNeededEur: row.total_cash_needed_eur,
    monthlyMortgageEur: row.monthly_mortgage_eur,
    monthlyNetCashFlowEur: row.monthly_net_cash_flow_eur,
  };
}

export async function listPisosInteresantes(
  client: SupabaseClient,
  _userId: string,
  options?: { limit?: number }
) {
  const { data, error } = await client
    .from("pisos_interesantes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(options?.limit ?? 100)
    .returns<RawPisoRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(mapPisoRow);
}

export async function createPisoInteresante(
  client: SupabaseClient,
  userId: string,
  rawInput: unknown
) {
  const input = CreatePisoInputSchema.parse(rawInput);

  const { data, error } = await client
    .from("pisos_interesantes")
    .insert({
      created_by: userId,
      title: input.title ?? null,
      listing_url: input.listingUrl ?? null,
      notes: input.notes ?? null,
      price_eur: input.priceEur ?? null,
      sqmeters: input.sqmeters ?? null,
      bedrooms: input.bedrooms ?? null,
      bathrooms: input.bathrooms ?? null,
      property_type: input.propertyType ?? null,
      estimated_rent_eur: input.estimatedRentEur ?? null,
      itp_rate: input.itpRate ?? null,
      notary_registry_eur: input.notaryRegistryEur ?? null,
      mortgage_fees_eur: input.mortgageFeesEur ?? null,
      renovation_cost_eur: input.renovationCostEur ?? null,
      purchase_commission_eur: input.purchaseCommissionEur ?? null,
      furniture_other_eur: input.furnitureOtherEur ?? null,
      loan_to_value: input.loanToValue ?? null,
      interest_rate: input.interestRate ?? null,
      mortgage_term_years: input.mortgageTermYears ?? null,
      ibi_basuras_eur: input.ibiBasurasEur ?? null,
      insurance_eur: input.insuranceEur ?? null,
      community_eur: input.communityEur ?? null,
      maintenance_eur: input.maintenanceEur ?? null,
      vacancy_months: input.vacancyMonths ?? null,
      gross_yield: input.grossYield ?? null,
      net_yield: input.netYield ?? null,
      cash_on_cash_roi: input.cashOnCashRoi ?? null,
      cash_on_cash_net_roi: input.cashOnCashNetRoi ?? null,
      total_cash_needed_eur: input.totalCashNeededEur ?? null,
      monthly_mortgage_eur: input.monthlyMortgageEur ?? null,
      monthly_net_cash_flow_eur: input.monthlyNetCashFlowEur ?? null,
    })
    .select("*")
    .single<RawPisoRow>();

  if (error) {
    throw new Error(error.message);
  }

  return mapPisoRow(data);
}

export async function updatePisoInteresante(
  client: SupabaseClient,
  userId: string,
  pisoId: string,
  rawInput: unknown
) {
  const input = UpdatePisoInputSchema.parse(rawInput);

  if (Object.keys(input).length === 0) {
    throw new Error("No hay campos que actualizar.");
  }

  const payload: Record<string, unknown> = {};

  if (input.title !== undefined) payload.title = input.title;
  if (input.listingUrl !== undefined) payload.listing_url = input.listingUrl;
  if (input.notes !== undefined) payload.notes = input.notes;
  if (input.priceEur !== undefined) payload.price_eur = input.priceEur;
  if (input.sqmeters !== undefined) payload.sqmeters = input.sqmeters;
  if (input.bedrooms !== undefined) payload.bedrooms = input.bedrooms;
  if (input.bathrooms !== undefined) payload.bathrooms = input.bathrooms;
  if (input.propertyType !== undefined) payload.property_type = input.propertyType;
  if (input.estimatedRentEur !== undefined) payload.estimated_rent_eur = input.estimatedRentEur;
  if (input.itpRate !== undefined) payload.itp_rate = input.itpRate;
  if (input.notaryRegistryEur !== undefined) payload.notary_registry_eur = input.notaryRegistryEur;
  if (input.mortgageFeesEur !== undefined) payload.mortgage_fees_eur = input.mortgageFeesEur;
  if (input.renovationCostEur !== undefined) payload.renovation_cost_eur = input.renovationCostEur;
  if (input.purchaseCommissionEur !== undefined) payload.purchase_commission_eur = input.purchaseCommissionEur;
  if (input.furnitureOtherEur !== undefined) payload.furniture_other_eur = input.furnitureOtherEur;
  if (input.loanToValue !== undefined) payload.loan_to_value = input.loanToValue;
  if (input.interestRate !== undefined) payload.interest_rate = input.interestRate;
  if (input.mortgageTermYears !== undefined) payload.mortgage_term_years = input.mortgageTermYears;
  if (input.ibiBasurasEur !== undefined) payload.ibi_basuras_eur = input.ibiBasurasEur;
  if (input.insuranceEur !== undefined) payload.insurance_eur = input.insuranceEur;
  if (input.communityEur !== undefined) payload.community_eur = input.communityEur;
  if (input.maintenanceEur !== undefined) payload.maintenance_eur = input.maintenanceEur;
  if (input.vacancyMonths !== undefined) payload.vacancy_months = input.vacancyMonths;
  if (input.grossYield !== undefined) payload.gross_yield = input.grossYield;
  if (input.netYield !== undefined) payload.net_yield = input.netYield;
  if (input.cashOnCashRoi !== undefined) payload.cash_on_cash_roi = input.cashOnCashRoi;
  if (input.cashOnCashNetRoi !== undefined) payload.cash_on_cash_net_roi = input.cashOnCashNetRoi;
  if (input.totalCashNeededEur !== undefined) payload.total_cash_needed_eur = input.totalCashNeededEur;
  if (input.monthlyMortgageEur !== undefined) payload.monthly_mortgage_eur = input.monthlyMortgageEur;
  if (input.monthlyNetCashFlowEur !== undefined) payload.monthly_net_cash_flow_eur = input.monthlyNetCashFlowEur;

  const { data, error } = await client
    .from("pisos_interesantes")
    .update(payload)
    .eq("id", pisoId)
    .select("*")
    .single<RawPisoRow>();

  if (error) {
    throw new Error(error.message);
  }

  return mapPisoRow(data);
}

export async function deletePisoInteresante(
  client: SupabaseClient,
  _userId: string,
  pisoId: string
) {
  const { error } = await client
    .from("pisos_interesantes")
    .delete()
    .eq("id", pisoId);

  if (error) {
    throw new Error(error.message);
  }
}
