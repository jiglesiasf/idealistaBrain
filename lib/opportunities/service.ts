import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CreateOpportunityInputSchema,
  UpdateOpportunityInputSchema,
  type OpportunitySummary,
  type OpportunityStatus,
} from "@/lib/opportunities/contracts";

type RawOpportunityRow = {
  id: string;
  user_id: string;
  listing_url: string;
  listing_id: string | null;
  title: string | null;
  price_eur: number | null;
  estimated_rent_eur: number | null;
  total_cash_needed_eur: number | null;
  sqmeters: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  cash_on_cash_roi: number | null;
  cash_on_cash_net_roi: number | null;
  gross_roi: number | null;
  net_roi: number | null;
  notes: string | null;
  status: OpportunityStatus;
  source: "manual" | "analysis";
  source_job_id: string | null;
  created_at: string;
  updated_at: string;
};

function mapOpportunityRow(row: RawOpportunityRow): OpportunitySummary {
  return {
    id: row.id,
    listingUrl: row.listing_url,
    listingId: row.listing_id,
    title: row.title,
    priceEur: row.price_eur,
    estimatedRentEur: row.estimated_rent_eur,
    totalCashNeededEur: row.total_cash_needed_eur,
    sqmeters: row.sqmeters,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    cashOnCashRoi: row.cash_on_cash_roi,
    cashOnCashNetRoi: row.cash_on_cash_net_roi,
    grossRoi: row.gross_roi,
    netRoi: row.net_roi,
    notes: row.notes,
    status: row.status,
    source: row.source,
    sourceJobId: row.source_job_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listUserOpportunities(
  client: SupabaseClient,
  userId: string,
  options?: { status?: OpportunityStatus; limit?: number }
) {
  let query = client
    .from("opportunities")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(options?.limit ?? 50);

  if (options?.status) {
    query = query.eq("status", options.status);
  }

  const { data, error } = await query.returns<RawOpportunityRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(mapOpportunityRow);
}

export async function createOpportunity(
  client: SupabaseClient,
  userId: string,
  rawInput: unknown
) {
  const input = CreateOpportunityInputSchema.parse(rawInput);

  const { data, error } = await client
    .from("opportunities")
    .insert({
      user_id: userId,
      listing_url: input.listingUrl,
      listing_id: null,
      title: input.title ?? null,
      price_eur: input.priceEur ?? null,
      estimated_rent_eur: input.estimatedRentEur ?? null,
      total_cash_needed_eur: input.totalCashNeededEur ?? null,
      sqmeters: input.sqmeters ?? null,
      bedrooms: input.bedrooms ?? null,
      bathrooms: input.bathrooms ?? null,
      cash_on_cash_roi: input.cashOnCashRoi ?? null,
      cash_on_cash_net_roi: input.cashOnCashNetRoi ?? null,
      gross_roi: input.grossRoi ?? null,
      net_roi: input.netRoi ?? null,
      notes: input.notes ?? null,
      source: input.source,
      source_job_id: input.sourceJobId ?? null,
    })
    .select("*")
    .single<RawOpportunityRow>();

  if (error) {
    if (error.code === "23505") {
      throw new Error("Esta oportunidad ya está en tu lista de seguimiento.");
    }
    throw new Error(error.message);
  }

  return mapOpportunityRow(data);
}

export async function updateOpportunity(
  client: SupabaseClient,
  userId: string,
  opportunityId: string,
  rawInput: unknown
) {
  const input = UpdateOpportunityInputSchema.parse(rawInput);

  if (Object.keys(input).length === 0) {
    throw new Error("No hay campos que actualizar.");
  }

  const updatePayload: Record<string, unknown> = {};

  if (input.status) updatePayload.status = input.status;
  if (input.notes !== undefined) updatePayload.notes = input.notes;
  if (input.title !== undefined) updatePayload.title = input.title;

  const { data, error } = await client
    .from("opportunities")
    .update(updatePayload)
    .eq("id", opportunityId)
    .eq("user_id", userId)
    .select("*")
    .single<RawOpportunityRow>();

  if (error) {
    throw new Error(error.message);
  }

  return mapOpportunityRow(data);
}

export async function deleteOpportunity(
  client: SupabaseClient,
  userId: string,
  opportunityId: string
) {
  const { error } = await client
    .from("opportunities")
    .delete()
    .eq("id", opportunityId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }
}
