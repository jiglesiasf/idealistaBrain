import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CreateSavedSearchInputSchema,
  UpdateSavedSearchInputSchema,
  type SavedSearchSummary,
} from "@/lib/alerts/contracts";

type RawSavedSearchRow = {
  id: string;
  user_id: string;
  name: string;
  idealista_search_url: string;
  idealista_alert_label: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function mapSavedSearchRow(row: RawSavedSearchRow): SavedSearchSummary {
  return {
    id: row.id,
    name: row.name,
    idealistaSearchUrl: row.idealista_search_url,
    idealistaAlertLabel: row.idealista_alert_label,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listSavedSearches(client: SupabaseClient, userId: string, limit = 50) {
  const { data, error } = await client
    .from("saved_searches")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<RawSavedSearchRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(mapSavedSearchRow);
}

export async function createSavedSearch(client: SupabaseClient, userId: string, rawInput: unknown) {
  const input = CreateSavedSearchInputSchema.parse(rawInput);

  const { data, error } = await client
    .from("saved_searches")
    .insert({
      user_id: userId,
      name: input.name,
      idealista_search_url: input.idealistaSearchUrl,
      idealista_alert_label: input.idealistaAlertLabel?.trim() || null,
    })
    .select("*")
    .single<RawSavedSearchRow>();

  if (error) {
    throw new Error(error.message);
  }

  return mapSavedSearchRow(data);
}

export async function updateSavedSearch(client: SupabaseClient, userId: string, savedSearchId: string, rawInput: unknown) {
  const input = UpdateSavedSearchInputSchema.parse(rawInput);

  if (Object.keys(input).length === 0) {
    throw new Error("At least one field must be provided.");
  }

  const updatePayload: Record<string, unknown> = {};

  if (typeof input.name === "string") {
    updatePayload.name = input.name;
  }

  if (typeof input.idealistaSearchUrl === "string") {
    updatePayload.idealista_search_url = input.idealistaSearchUrl;
  }

  if (input.idealistaAlertLabel !== undefined) {
    updatePayload.idealista_alert_label = input.idealistaAlertLabel?.trim() || null;
  }

  if (typeof input.isActive === "boolean") {
    updatePayload.is_active = input.isActive;
  }

  const { data, error } = await client
    .from("saved_searches")
    .update(updatePayload)
    .eq("id", savedSearchId)
    .eq("user_id", userId)
    .select("*")
    .single<RawSavedSearchRow>();

  if (error) {
    throw new Error(error.message);
  }

  return mapSavedSearchRow(data);
}
