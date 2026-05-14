import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CreateSavedSearchInputSchema,
  UpdateSavedSearchInputSchema,
  type AlertRadarSummary,
  type AlertRadarOpportunity,
  type SavedSearchSummary,
} from "@/lib/alerts/contracts";
import type { JobStatus } from "@/lib/jobs/contracts";

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

type RawSearchAlertEventRow = {
  id: string;
  created_at: string;
  saved_search_id: string | null;
  saved_searches:
    | {
        name: string;
      }
    | {
        name: string;
      }[]
    | null;
  search_alert_listings:
    | {
        id: string;
        listing_id: string | null;
        listing_url: string;
        title: string | null;
        created_at: string;
        is_new: boolean;
      }[]
    | null;
};

type RawJobEventJoinRow = {
  payload: Record<string, unknown> | null;
  jobs:
    | {
        id: string;
        target_url: string;
        status: JobStatus;
        created_at: string;
      }
    | {
        id: string;
        target_url: string;
        status: JobStatus;
        created_at: string;
      }[]
    | null;
};

type RawListingAnalysisRow = {
  job_id: string;
  payload_json: Record<string, unknown>;
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

function startOfTodayIso() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
}

function unwrapSingle<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function readNumericMetric(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getRadarPriority(opportunity: AlertRadarOpportunity) {
  if (opportunity.linkedJobStatus !== "completed") {
    return -1;
  }

  return (
    opportunity.cashOnCashRoi ??
    opportunity.cashOnCashNetRoi ??
    opportunity.netRoi ??
    opportunity.grossRoi ??
    -1
  );
}

export async function getAlertRadarSummary(client: SupabaseClient, userId: string): Promise<AlertRadarSummary> {
  const todayIso = startOfTodayIso();

  const { data: eventRows, error: eventRowsError } = await client
    .from("search_alert_events")
    .select(`
      id,
      created_at,
      saved_search_id,
      saved_searches (
        name
      ),
      search_alert_listings (
        id,
        listing_id,
        listing_url,
        title,
        created_at,
        is_new
      )
    `)
    .eq("user_id", userId)
    .gte("created_at", todayIso)
    .order("created_at", { ascending: false })
    .returns<RawSearchAlertEventRow[]>();

  if (eventRowsError) {
    throw new Error(eventRowsError.message);
  }

  const { data: autoJobEventRows, error: autoJobEventRowsError } = await client
    .from("job_events")
    .select(`
      payload,
      jobs (
        id,
        target_url,
        status,
        created_at
      )
    `)
    .eq("event_type", "created-from-alert")
    .gte("created_at", todayIso)
    .returns<RawJobEventJoinRow[]>();

  if (autoJobEventRowsError) {
    throw new Error(autoJobEventRowsError.message);
  }

  const linkedJobsByUrl = new Map<string, { id: string; status: JobStatus; createdAt: string }>();

  for (const row of autoJobEventRows ?? []) {
    const job = unwrapSingle(row.jobs);

    if (!job) {
      continue;
    }

    const current = linkedJobsByUrl.get(job.target_url);

    if (!current || new Date(job.created_at).getTime() > new Date(current.createdAt).getTime()) {
      linkedJobsByUrl.set(job.target_url, {
        id: job.id,
        status: job.status,
        createdAt: job.created_at,
      });
    }
  }

  const linkedJobIds = [...new Set([...linkedJobsByUrl.values()].map((job) => job.id))];
  const listingAnalysisByJobId = new Map<
    string,
    {
      cashOnCashRoi: number | null;
      cashOnCashNetRoi: number | null;
      grossRoi: number | null;
      netRoi: number | null;
    }
  >();

  if (linkedJobIds.length > 0) {
    const { data: analysisRows, error: analysisRowsError } = await client
      .from("listing_analyses")
      .select("job_id, payload_json")
      .in("job_id", linkedJobIds)
      .returns<RawListingAnalysisRow[]>();

    if (analysisRowsError) {
      throw new Error(analysisRowsError.message);
    }

    for (const analysisRow of analysisRows ?? []) {
      const profitability = (analysisRow.payload_json?.profitability ?? {}) as Record<string, unknown>;
      const metrics = (profitability.metrics ?? {}) as Record<string, unknown>;

      listingAnalysisByJobId.set(analysisRow.job_id, {
        cashOnCashRoi: readNumericMetric(metrics.cashOnCashRoi),
        cashOnCashNetRoi: readNumericMetric(metrics.cashOnCashNetRoi),
        grossRoi: readNumericMetric(metrics.grossRoi),
        netRoi: readNumericMetric(metrics.netRoi),
      });
    }
  }

  const opportunities: AlertRadarOpportunity[] = [];

  for (const eventRow of eventRows ?? []) {
    const savedSearch = unwrapSingle(eventRow.saved_searches);
    const listings = (eventRow.search_alert_listings ?? []).filter((listing) => listing.is_new);

    for (const listing of listings) {
      const linkedJob = linkedJobsByUrl.get(listing.listing_url);
      const linkedAnalysis = linkedJob ? listingAnalysisByJobId.get(linkedJob.id) : null;

      opportunities.push({
        id: listing.id,
        listingId: listing.listing_id,
        listingUrl: listing.listing_url,
        title: listing.title,
        createdAt: listing.created_at,
        savedSearchName: savedSearch?.name ?? null,
        alertEventId: eventRow.id,
        linkedJobId: linkedJob?.id ?? null,
        linkedJobStatus: linkedJob?.status ?? null,
        cashOnCashRoi: linkedAnalysis?.cashOnCashRoi ?? null,
        cashOnCashNetRoi: linkedAnalysis?.cashOnCashNetRoi ?? null,
        grossRoi: linkedAnalysis?.grossRoi ?? null,
        netRoi: linkedAnalysis?.netRoi ?? null,
      });
    }
  }

  return {
    opportunities: opportunities.sort((left, right) => {
      const leftCompleted = left.linkedJobStatus === "completed" ? 1 : 0;
      const rightCompleted = right.linkedJobStatus === "completed" ? 1 : 0;

      if (leftCompleted !== rightCompleted) {
        return rightCompleted - leftCompleted;
      }

      const priorityDiff = getRadarPriority(right) - getRadarPriority(left);

      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    }),
    newListingsToday: opportunities.length,
    searchesTriggeredToday: (eventRows ?? []).length,
    automaticJobsToday: autoJobEventRows?.length ?? 0,
  };
}
