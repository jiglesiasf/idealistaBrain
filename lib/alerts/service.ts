import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CreateSavedSearchInputSchema,
  UpdateSavedSearchInputSchema,
  type AlertRadarSummary,
  type AlertRadarOpportunity,
  type SavedSearchSummary,
  type RadarSummary,
  type RadarListingSummary,
  CreateRadarInputSchema,
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

type RawRadarRow = {
  id: string;
  user_id: string;
  name: string;
  idealista_search_url: string;
  is_active: boolean;
  location_name: string | null;
  location_type: "district" | "neighborhood" | "municipality" | "area" | null;
  last_scan_at: string | null;
  scan_count: number;
  last_scan_status: "idle" | "scanning" | "completed" | "failed" | null;
  created_at: string;
  updated_at: string;
};

type RawRadarListingRow = {
  id: string;
  user_id: string;
  listing_id: string | null;
  listing_url: string;
  title: string | null;
  price_eur: number | null;
  sqmeters: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  estimated_rent_eur: number | null;
  cash_on_cash_roi: number | null;
  cash_on_cash_net_roi: number | null;
  gross_roi: number | null;
  net_roi: number | null;
  source: "scan" | "alert";
  is_new: boolean;
  first_seen_at: string;
  last_seen_at: string;
  created_at: string;
};

function mapRadarRow(row: RawRadarRow, newListingsCount: number, topRoi: number | null): RadarSummary {
  return {
    id: row.id,
    name: row.name,
    idealistaSearchUrl: row.idealista_search_url,
    isActive: row.is_active,
    locationName: row.location_name,
    locationType: row.location_type,
    lastScanAt: row.last_scan_at,
    scanCount: row.scan_count,
    lastScanStatus: row.last_scan_status,
    newListingsCount,
    topRoi,
    createdAt: row.created_at,
  };
}

function mapRadarListingRow(row: RawRadarListingRow): RadarListingSummary {
  return {
    id: row.id,
    listingId: row.listing_id,
    listingUrl: row.listing_url,
    title: row.title,
    priceEur: row.price_eur,
    sqmeters: row.sqmeters,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    estimatedRentEur: row.estimated_rent_eur,
    source: row.source,
    isNew: row.is_new,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    cashOnCashRoi: row.cash_on_cash_roi,
    cashOnCashNetRoi: row.cash_on_cash_net_roi,
    grossRoi: row.gross_roi,
    netRoi: row.net_roi,
    linkedJobId: null,
    linkedJobStatus: null,
  };
}

export async function listUserRadars(client: SupabaseClient, userId: string, limit = 10) {
  const { data: radarRows, error: radarError } = await client
    .from("saved_searches")
    .select("*")
    .eq("user_id", userId)
    .eq("is_radar", true)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<RawRadarRow[]>();

  if (radarError) {
    throw new Error(radarError.message);
  }

  if (!radarRows || radarRows.length === 0) {
    return [];
  }

  const radarIds = radarRows.map((r) => r.id);

  const { data: countRows, error: countError } = await client
    .from("radar_listings")
    .select("radar_id, is_new")
    .in("radar_id", radarIds)
    .eq("is_new", true);

  if (countError) {
    throw new Error(countError.message);
  }

  const newListingsCountMap = new Map<string, number>();

  for (const row of countRows ?? []) {
    newListingsCountMap.set(
      row.radar_id,
      (newListingsCountMap.get(row.radar_id) ?? 0) + 1
    );
  }

  return radarRows.map((row) =>
    mapRadarRow(row, newListingsCountMap.get(row.id) ?? 0, null)
  );
}

export async function createRadar(client: SupabaseClient, userId: string, rawInput: unknown) {
  const input = CreateRadarInputSchema.parse(rawInput);

  const { data, error } = await client
    .from("saved_searches")
    .insert({
      user_id: userId,
      name: input.name,
      idealista_search_url: input.idealistaSearchUrl,
      is_radar: true,
      last_scan_status: "idle",
    })
    .select("*")
    .single<RawRadarRow>();

  if (error) {
    throw new Error(error.message);
  }

  return mapRadarRow(data, 0, null);
}

export async function getRadarDetail(client: SupabaseClient, userId: string, radarId: string) {
  const { data: radarRow, error: radarError } = await client
    .from("saved_searches")
    .select("*")
    .eq("id", radarId)
    .eq("user_id", userId)
    .single<RawRadarRow>();

  if (radarError) {
    throw new Error(radarError.message);
  }

  const { data: listingRows, error: listingError } = await client
    .from("radar_listings")
    .select("*")
    .eq("radar_id", radarId)
    .order("first_seen_at", { ascending: false })
    .limit(50)
    .returns<RawRadarListingRow[]>();

  if (listingError) {
    throw new Error(listingError.message);
  }

  const { data: countData, error: countError } = await client
    .from("radar_listings")
    .select("id", { count: "exact", head: true })
    .eq("radar_id", radarId)
    .eq("is_new", true);

  if (countError) {
    throw new Error(countError.message);
  }

  const listings = (listingRows ?? []).map(mapRadarListingRow);

  return {
    radar: mapRadarRow(radarRow, countData?.length ?? 0, null),
    listings,
  };
}

export async function updateRadarScanStatus(
  client: SupabaseClient,
  userId: string,
  radarId: string,
  status: "idle" | "scanning" | "completed" | "failed"
) {
  const updatePayload: Record<string, unknown> = {
    last_scan_status: status,
  };

  if (status === "scanning") {
    updatePayload.last_scan_at = new Date().toISOString();
  }

  if (status === "completed") {
    const { data: current } = await client
      .from("saved_searches")
      .select("scan_count")
      .eq("id", radarId)
      .eq("user_id", userId)
      .single<{ scan_count: number }>();

    updatePayload.scan_count = (current?.scan_count ?? 0) + 1;
  }

  const { error } = await client
    .from("saved_searches")
    .update(updatePayload)
    .eq("id", radarId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteRadar(client: SupabaseClient, userId: string, radarId: string) {
  const { error } = await client
    .from("saved_searches")
    .delete()
    .eq("id", radarId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function ingestRadarListings(
  client: SupabaseClient,
  userId: string,
  radarId: string,
  listings: Array<{
    listingUrl: string;
    listingId?: string | null;
    title?: string | null;
    priceEur?: number | null;
    sqmeters?: number | null;
    bedrooms?: number | null;
    bathrooms?: number | null;
    estimatedRentEur?: number | null;
    cashOnCashRoi?: number | null;
    cashOnCashNetRoi?: number | null;
    grossRoi?: number | null;
    netRoi?: number | null;
  }>,
  source: "scan" | "alert"
) {
  const rows = listings.map((l) => ({
    radar_id: radarId,
    user_id: userId,
    listing_id: l.listingId || null,
    listing_url: l.listingUrl,
    title: l.title || null,
    price_eur: l.priceEur ?? null,
    sqmeters: l.sqmeters ?? null,
    bedrooms: l.bedrooms ?? null,
    bathrooms: l.bathrooms ?? null,
    estimated_rent_eur: l.estimatedRentEur ?? null,
    cash_on_cash_roi: l.cashOnCashRoi ?? null,
    cash_on_cash_net_roi: l.cashOnCashNetRoi ?? null,
    gross_roi: l.grossRoi ?? null,
    net_roi: l.netRoi ?? null,
    source,
  }));

  const { error } = await client.from("radar_listings").upsert(rows, {
    onConflict: "radar_id, listing_url",
    ignoreDuplicates: false,
  });

  if (error) {
    throw new Error(error.message);
  }
}
