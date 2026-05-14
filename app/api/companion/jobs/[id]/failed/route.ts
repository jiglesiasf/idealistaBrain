import { NextResponse } from "next/server";
import { failCompanionJob } from "@/lib/jobs/service";

export async function POST(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    await failCompanionJob(id, body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected failure-event error." },
      { status: 400 }
    );
  }
}
