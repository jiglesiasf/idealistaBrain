import { NextResponse } from "next/server";
import { processPendingInboxMessagesForUser } from "@/lib/alerts/parser";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const result = await processPendingInboxMessagesForUser(user.id, 20);
    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unexpected inbox processing error.",
      },
      { status: 400 }
    );
  }
}
