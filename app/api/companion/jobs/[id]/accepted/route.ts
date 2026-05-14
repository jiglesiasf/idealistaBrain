import { NextResponse } from "next/server";
import { acceptCompanionJob } from "@/lib/jobs/service";

export async function POST(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    await acceptCompanionJob(id, body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected accepted-event error." },
      { status: 400 }
    );
  }
}
