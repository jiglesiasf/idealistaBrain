import { z } from "zod";

export const JOB_TYPES = ["listing-analysis", "zone-scan"] as const;
export const JOB_STATUSES = ["queued", "dispatching", "running", "completed", "failed"] as const;
export const CREATE_JOB_MODES = ["auto-detect", "listing-analysis", "zone-scan"] as const;

export type JobType = (typeof JOB_TYPES)[number];
export type JobStatus = (typeof JOB_STATUSES)[number];
export type CreateJobMode = (typeof CREATE_JOB_MODES)[number];

export const CreateJobInputSchema = z.object({
  targetUrl: z.url().max(2048),
  mode: z.enum(CREATE_JOB_MODES).default("auto-detect"),
});

export const CompanionAcceptedSchema = z.object({
  executionToken: z.string().min(16),
  payload: z.object({
    companionVersion: z.string().min(1).optional(),
  }),
});

export const CompanionProgressSchema = z.object({
  executionToken: z.string().min(16),
  payload: z.object({
    stage: z.string().min(1),
    message: z.string().min(1).max(500).optional(),
    progress: z.number().int().min(0).max(100).optional(),
  }),
});

export const CompanionCompletedSchema = z.object({
  executionToken: z.string().min(16),
  payload: z.object({
    resultType: z.enum(JOB_TYPES),
    result: z.record(z.string(), z.unknown()),
  }),
});

export const CompanionFailedSchema = z.object({
  executionToken: z.string().min(16),
  payload: z.object({
    stage: z.string().min(1).optional(),
    message: z.string().min(1).max(500),
  }),
});

export type CreateJobInput = z.infer<typeof CreateJobInputSchema>;
export type CompanionAcceptedInput = z.infer<typeof CompanionAcceptedSchema>;
export type CompanionProgressInput = z.infer<typeof CompanionProgressSchema>;
export type CompanionCompletedInput = z.infer<typeof CompanionCompletedSchema>;
export type CompanionFailedInput = z.infer<typeof CompanionFailedSchema>;

export type JobSummary = {
  id: string;
  jobType: JobType;
  status: JobStatus;
  targetUrl: string;
  progress: number | null;
  lastProgressStage: string | null;
  lastProgressMessage: string | null;
  resultType: JobType | null;
  radarId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type JobEventRecord = {
  id: string;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type JobView = JobSummary & {
  events: JobEventRecord[];
  result: {
    type: JobType;
    payload: Record<string, unknown>;
  } | null;
};

export type CreateJobResponse = {
  job: JobSummary;
  dispatch: {
    jobId: string;
    jobType: JobType;
    targetUrl: string;
    executionToken: string;
    backendBaseUrl: string;
    apiBasePath: "/api/companion";
  };
};
