import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CompanionAcceptedSchema,
  CompanionCompletedSchema,
  CompanionFailedSchema,
  CompanionProgressSchema,
  CreateJobInputSchema,
  type CreateJobInput,
  type JobEventRecord,
  type JobSummary,
  type JobType,
  type JobView,
} from "@/lib/jobs/contracts";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestRadarListings, updateRadarScanStatus } from "@/lib/alerts/service";

type RawJobRow = {
  id: string;
  user_id: string;
  job_type: JobType;
  status: JobSummary["status"];
  target_url: string;
  progress: number | null;
  last_progress_stage: string | null;
  last_progress_message: string | null;
  result_type: JobType | null;
  execution_token_hash: string;
  execution_token_expires_at: string;
  radar_id: string | null;
  created_at: string;
  updated_at: string;
};

type RawJobEventRow = {
  id: string;
  event_type: string;
  payload: Record<string, unknown> | null;
  created_at: string;
};

const COMPANION_TOKEN_TTL_MS = 15 * 60 * 1000;
const IDEALISTA_HOSTNAME_PATTERN = /^https:\/\/www\.idealista\.com\//i;
const LISTING_URL_PATTERN = /^https:\/\/www\.idealista\.com\/inmueble\/\d+/i;
const ZONE_URL_PATTERN = /^https:\/\/www\.idealista\.com\/(?:geo\/|multi\/)?venta-viviendas\//i;

function createExecutionToken() {
  return randomBytes(24).toString("base64url");
}

function hashExecutionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function inferJobType(targetUrl: string, mode: CreateJobInput["mode"]): JobType {
  if (!IDEALISTA_HOSTNAME_PATTERN.test(targetUrl)) {
    throw new Error("The submitted URL must belong to www.idealista.com.");
  }

  if (mode === "listing-analysis") {
    return "listing-analysis";
  }

  if (mode === "zone-scan") {
    return "zone-scan";
  }

  if (LISTING_URL_PATTERN.test(targetUrl)) {
    return "listing-analysis";
  }

  if (ZONE_URL_PATTERN.test(targetUrl)) {
    return "zone-scan";
  }

  throw new Error("The URL could not be classified. Use a listing URL or a sale-results URL.");
}

function mapJobRow(row: RawJobRow): JobSummary {
  return {
    id: row.id,
    jobType: row.job_type,
    status: row.status,
    targetUrl: row.target_url,
    progress: row.progress,
    lastProgressStage: row.last_progress_stage,
    lastProgressMessage: row.last_progress_message,
    resultType: row.result_type,
    radarId: row.radar_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapJobEventRow(row: RawJobEventRow): JobEventRecord {
  return {
    id: row.id,
    eventType: row.event_type,
    payload: row.payload ?? {},
    createdAt: row.created_at,
  };
}

async function appendJobEvent(
  client: SupabaseClient,
  jobId: string,
  eventType: string,
  payload: Record<string, unknown>
) {
  const { error } = await client.from("job_events").insert({
    job_id: jobId,
    event_type: eventType,
    payload,
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function getAuthorizedCompanionJob(jobId: string, executionToken: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("jobs").select("*").eq("id", jobId).maybeSingle<RawJobRow>();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Job not found.");
  }

  if (data.execution_token_hash !== hashExecutionToken(executionToken)) {
    throw new Error("Invalid execution token.");
  }

  if (new Date(data.execution_token_expires_at).getTime() <= Date.now()) {
    throw new Error("Execution token has expired.");
  }

  return { admin, job: data };
}

export async function createJob(client: SupabaseClient, userId: string, rawInput: unknown, radarId?: string | null) {
  const input = CreateJobInputSchema.parse(rawInput);
  const jobType = inferJobType(input.targetUrl, input.mode);
  const executionToken = createExecutionToken();
  const executionTokenHash = hashExecutionToken(executionToken);
  const executionTokenExpiresAt = new Date(Date.now() + COMPANION_TOKEN_TTL_MS).toISOString();

  const { data, error } = await client
    .from("jobs")
    .insert({
      user_id: userId,
      job_type: jobType,
      status: "queued",
      target_url: input.targetUrl,
      execution_token_hash: executionTokenHash,
      execution_token_expires_at: executionTokenExpiresAt,
      radar_id: radarId ?? null,
    })
    .select("*")
    .single<RawJobRow>();

  if (error) {
    throw new Error(error.message);
  }

  return {
    job: mapJobRow(data),
    executionToken,
  };
}

export async function createAutomatedListingJob(
  client: SupabaseClient,
  userId: string,
  targetUrl: string,
  sourcePayload?: Record<string, unknown>
) {
  const executionToken = createExecutionToken();
  const executionTokenHash = hashExecutionToken(executionToken);
  const executionTokenExpiresAt = new Date(Date.now() + COMPANION_TOKEN_TTL_MS).toISOString();

  const { data, error } = await client
    .from("jobs")
    .insert({
      user_id: userId,
      job_type: "listing-analysis",
      status: "queued",
      target_url: targetUrl,
      execution_token_hash: executionTokenHash,
      execution_token_expires_at: executionTokenExpiresAt,
      last_progress_stage: "queued",
      last_progress_message: "Automatic listing analysis created from an Idealista alert.",
    })
    .select("*")
    .single<RawJobRow>();

  if (error) {
    throw new Error(error.message);
  }

  if (sourcePayload) {
    await appendJobEvent(client, data.id, "created-from-alert", sourcePayload);
  }

  return {
    job: mapJobRow(data),
    executionToken,
  };
}

export async function claimNextAutomatedListingJob(userId: string, backendBaseUrl: string) {
  const admin = createAdminClient();
  const { data: queuedJobs, error: queuedJobsError } = await admin
    .from("jobs")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "queued")
    .eq("job_type", "listing-analysis")
    .order("created_at", { ascending: true })
    .limit(25)
    .returns<RawJobRow[]>();

  if (queuedJobsError) {
    throw new Error(queuedJobsError.message);
  }

  let candidateJob: RawJobRow | null = null;

  for (const job of queuedJobs ?? []) {
    const { data: eventRow, error: eventError } = await admin
      .from("job_events")
      .select("id")
      .eq("job_id", job.id)
      .eq("event_type", "created-from-alert")
      .maybeSingle<{ id: string }>();

    if (eventError) {
      throw new Error(eventError.message);
    }

    if (eventRow?.id) {
      candidateJob = job;
      break;
    }
  }

  if (!candidateJob) {
    return null;
  }

  const executionToken = createExecutionToken();
  const executionTokenHash = hashExecutionToken(executionToken);
  const executionTokenExpiresAt = new Date(Date.now() + COMPANION_TOKEN_TTL_MS).toISOString();

  const { error: updateError } = await admin
    .from("jobs")
    .update({
      status: "dispatching",
      execution_token_hash: executionTokenHash,
      execution_token_expires_at: executionTokenExpiresAt,
      last_progress_stage: "dispatching",
      last_progress_message: "Automatic runner claimed the job and is sending it to the companion.",
    })
    .eq("id", candidateJob.id)
    .eq("status", "queued");

  if (updateError) {
    throw new Error(updateError.message);
  }

  await appendJobEvent(admin, candidateJob.id, "runner-claimed", {
    source: "automatic-runner",
  });

  return {
    jobId: candidateJob.id,
    jobType: candidateJob.job_type,
    targetUrl: candidateJob.target_url,
    executionToken,
    backendBaseUrl,
    apiBasePath: "/api/companion" as const,
  };
}

export async function releaseAutomatedJobClaim(userId: string, jobId: string, reason: string) {
  const admin = createAdminClient();

  const { error } = await admin
    .from("jobs")
    .update({
      status: "queued",
      progress: null,
      last_progress_stage: "queued",
      last_progress_message: reason,
    })
    .eq("id", jobId)
    .eq("user_id", userId)
    .eq("status", "dispatching");

  if (error) {
    throw new Error(error.message);
  }

  await appendJobEvent(admin, jobId, "runner-release", {
    source: "automatic-runner",
    reason,
  });
}

export async function listUserJobs(client: SupabaseClient, userId: string, limit = 12) {
  const { data, error } = await client
    .from("jobs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<RawJobRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(mapJobRow);
}

export async function getJobView(client: SupabaseClient, userId: string, jobId: string): Promise<JobView | null> {
  const { data: jobRow, error: jobError } = await client
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle<RawJobRow>();

  if (jobError) {
    throw new Error(jobError.message);
  }

  if (!jobRow) {
    return null;
  }

  const { data: eventRows, error: eventsError } = await client
    .from("job_events")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: true })
    .returns<RawJobEventRow[]>();

  if (eventsError) {
    throw new Error(eventsError.message);
  }

  let result: JobView["result"] = null;

  if (jobRow.result_type === "listing-analysis") {
    const { data, error } = await client
      .from("listing_analyses")
      .select("payload_json")
      .eq("job_id", jobId)
      .maybeSingle<{ payload_json: Record<string, unknown> }>();

    if (error) {
      throw new Error(error.message);
    }

    if (data?.payload_json) {
      result = {
        type: "listing-analysis",
        payload: data.payload_json,
      };
    }
  }

  if (jobRow.result_type === "zone-scan") {
    const { data, error } = await client
      .from("zone_scans")
      .select("payload_json")
      .eq("job_id", jobId)
      .maybeSingle<{ payload_json: Record<string, unknown> }>();

    if (error) {
      throw new Error(error.message);
    }

    if (data?.payload_json) {
      result = {
        type: "zone-scan",
        payload: data.payload_json,
      };
    }
  }

  return {
    ...mapJobRow(jobRow),
    events: (eventRows ?? []).map(mapJobEventRow),
    result,
  };
}

export async function acceptCompanionJob(jobId: string, rawInput: unknown) {
  const input = CompanionAcceptedSchema.parse(rawInput);
  const { admin } = await getAuthorizedCompanionJob(jobId, input.executionToken);

  const { error } = await admin
    .from("jobs")
    .update({
      status: "running",
      progress: 1,
      last_progress_stage: "accepted",
      last_progress_message: "Companion accepted the job.",
    })
    .eq("id", jobId);

  if (error) {
    throw new Error(error.message);
  }

  await appendJobEvent(admin, jobId, "accepted", input.payload);
}

export async function reportCompanionProgress(jobId: string, rawInput: unknown) {
  const input = CompanionProgressSchema.parse(rawInput);
  const { admin } = await getAuthorizedCompanionJob(jobId, input.executionToken);

  const { error } = await admin
    .from("jobs")
    .update({
      status: "running",
      progress: input.payload.progress ?? null,
      last_progress_stage: input.payload.stage,
      last_progress_message: input.payload.message ?? null,
    })
    .eq("id", jobId);

  if (error) {
    throw new Error(error.message);
  }

  await appendJobEvent(admin, jobId, "progress", input.payload);
}

export async function completeCompanionJob(jobId: string, rawInput: unknown) {
  const input = CompanionCompletedSchema.parse(rawInput);
  const { admin, job } = await getAuthorizedCompanionJob(jobId, input.executionToken);
  const tableName = input.payload.resultType === "listing-analysis" ? "listing_analyses" : "zone_scans";

  const { error: resultError } = await admin.from(tableName).upsert(
    {
      job_id: jobId,
      user_id: job.user_id,
      payload_json: input.payload.result,
    },
    { onConflict: "job_id" }
  );

  if (resultError) {
    throw new Error(resultError.message);
  }

  const { error: jobError } = await admin
    .from("jobs")
    .update({
      status: "completed",
      progress: 100,
      result_type: input.payload.resultType,
      last_progress_stage: "persisting-result",
      last_progress_message: "Companion persisted the final result.",
      execution_token_expires_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (jobError) {
    throw new Error(jobError.message);
  }

  await appendJobEvent(admin, jobId, "completed", {
    resultType: input.payload.resultType,
  });

  if (job.radar_id && input.payload.resultType === "zone-scan") {
    const result = input.payload.result as Record<string, unknown>;
    const opportunities = (result.opportunities ?? []) as Array<{
      url?: string;
      listingId?: string;
      title?: string;
      priceEur?: number;
      areaM2?: number;
      rooms?: number;
      bathrooms?: number;
      estimatedRentEur?: number;
      cashOnCashRoi?: number;
      cashOnCashNetRoi?: number;
      grossRoi?: number;
      netRoi?: number;
    }>;

    const listings = opportunities.map((opp) => ({
      listingUrl: opp.url ?? "",
      listingId: opp.listingId ?? null,
      title: opp.title ?? null,
      priceEur: opp.priceEur ?? null,
      sqmeters: opp.areaM2 ?? null,
      bedrooms: opp.rooms ?? null,
      bathrooms: opp.bathrooms ?? null,
      estimatedRentEur: opp.estimatedRentEur ?? null,
      cashOnCashRoi: opp.cashOnCashRoi ?? null,
      cashOnCashNetRoi: opp.cashOnCashNetRoi ?? null,
      grossRoi: opp.grossRoi ?? null,
      netRoi: opp.netRoi ?? null,
    }));

    await ingestRadarListings(admin, job.user_id, job.radar_id, listings, "scan");
    await updateRadarScanStatus(admin, job.user_id, job.radar_id, "completed");
  }
}

export async function failCompanionJob(jobId: string, rawInput: unknown) {
  const input = CompanionFailedSchema.parse(rawInput);
  const { admin, job } = await getAuthorizedCompanionJob(jobId, input.executionToken);

  const { error } = await admin
    .from("jobs")
    .update({
      status: "failed",
      last_progress_stage: input.payload.stage ?? "failed",
      last_progress_message: input.payload.message,
      execution_token_expires_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) {
    throw new Error(error.message);
  }

  await appendJobEvent(admin, jobId, "failed", input.payload);

  if (job.radar_id) {
    await updateRadarScanStatus(admin, job.user_id, job.radar_id, "failed");
  }
}
