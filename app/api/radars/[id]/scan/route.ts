import { NextResponse } from "next/server";
import { updateRadarScanStatus } from "@/lib/alerts/service";
import { createJob } from "@/lib/jobs/service";
import { getMissingSupabaseEnvKeys } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const missingServerEnv = getMissingSupabaseEnvKeys({ includeServiceRole: true });

    if (missingServerEnv.length > 0) {
      return NextResponse.json(
        {
          error:
            "El backend del companion no está completamente configurado. Falta SUPABASE_SERVICE_ROLE_KEY.",
        },
        { status: 503 }
      );
    }

    const { id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { data: radar } = await supabase
      .from("saved_searches")
      .select("idealista_search_url")
      .eq("id", id)
      .eq("user_id", user.id)
      .single<{ idealista_search_url: string }>();

    if (!radar) {
      return NextResponse.json({ error: "Radar no encontrado." }, { status: 404 });
    }

    await updateRadarScanStatus(supabase, user.id, id, "scanning");

    const { job, executionToken } = await createJob(supabase, user.id, {
      targetUrl: radar.idealista_search_url,
      mode: "zone-scan",
    }, id);

    const backendBaseUrl = new URL(request.url).origin;

    return NextResponse.json(
      {
        job,
        radarId: id,
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
        error: error instanceof Error ? error.message : "Error inesperado al iniciar el escaneo.",
      },
      { status: 400 }
    );
  }
}
