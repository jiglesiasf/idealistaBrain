import { NextResponse } from "next/server";
import { completeCompanionJob } from "@/lib/jobs/service";

export async function POST(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    await completeCompanionJob(id, body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected completion-event error." },
      { status: 400 }
    );
  }
}
