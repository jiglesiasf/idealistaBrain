import { NextResponse } from "next/server";
import { createJob, listUserJobs } from "@/lib/jobs/service";
import { getMissingSupabaseEnvKeys } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const jobs = await listUserJobs(supabase, user.id, 30);
  return NextResponse.json({ jobs });
}

export async function POST(request: Request) {
  try {
    const missingServerEnv = getMissingSupabaseEnvKeys({ includeServiceRole: true });

    if (missingServerEnv.length > 0) {
      return NextResponse.json(
        {
          error:
            "El backend del companion no esta completamente configurado. Falta SUPABASE_SERVICE_ROLE_KEY, asi que no puedo persistir accepted/progress/completed.",
        },
        { status: 503 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = await request.json();
    const { job, executionToken } = await createJob(supabase, user.id, body);
    const backendBaseUrl = new URL(request.url).origin;

    return NextResponse.json(
      {
        job,
        dispatch: {
          jobId: job.id,
          jobType: job.jobType,
          targetUrl: job.targetUrl,
          executionToken,
          backendBaseUrl,
          apiBasePath: "/api/companion",
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unexpected job creation error.",
      },
      { status: 400 }
    );
  }
}
