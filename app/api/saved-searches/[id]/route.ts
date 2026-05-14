import { NextResponse } from "next/server";
import { updateSavedSearch } from "@/lib/alerts/service";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = await request.json();
    const savedSearch = await updateSavedSearch(supabase, user.id, id, body);

    return NextResponse.json({ savedSearch });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unexpected saved search update error.",
      },
      { status: 400 }
    );
  }
}
