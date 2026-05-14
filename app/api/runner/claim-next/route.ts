import { NextResponse } from "next/server";
import { claimNextAutomatedListingJob } from "@/lib/jobs/service";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const backendBaseUrl = new URL(request.url).origin;
    const dispatch = await claimNextAutomatedListingJob(user.id, backendBaseUrl);

    return NextResponse.json({ dispatch });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unexpected runner claim error.",
      },
      { status: 400 }
    );
  }
}
