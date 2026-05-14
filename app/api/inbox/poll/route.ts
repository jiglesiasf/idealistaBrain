import { NextResponse } from "next/server";
import { pollAlertsInboxForUser } from "@/lib/alerts/inbox";
import { getMissingAlertsInboxEnvKeys } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  try {
    const missingEnv = getMissingAlertsInboxEnvKeys();

    if (missingEnv.length > 0) {
      return NextResponse.json(
        {
          error: `El inbox de alertas no esta completamente configurado. Faltan: ${missingEnv.join(", ")}.`,
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

    const result = await pollAlertsInboxForUser(user.id);
    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unexpected inbox polling error.",
      },
      { status: 400 }
    );
  }
}
