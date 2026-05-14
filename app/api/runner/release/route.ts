import { NextResponse } from "next/server";
import { z } from "zod";
import { releaseAutomatedJobClaim } from "@/lib/jobs/service";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ReleaseRunnerClaimSchema = z.object({
  jobId: z.uuid(),
  reason: z.string().min(1).max(500),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = await request.json();
    const input = ReleaseRunnerClaimSchema.parse(body);
    await releaseAutomatedJobClaim(user.id, input.jobId, input.reason);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unexpected runner release error.",
      },
      { status: 400 }
    );
  }
}
