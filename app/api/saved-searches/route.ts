import { NextResponse } from "next/server";
import { createSavedSearch, listSavedSearches } from "@/lib/alerts/service";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const savedSearches = await listSavedSearches(supabase, user.id, 50);
  return NextResponse.json({ savedSearches });
}

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
    const savedSearch = await createSavedSearch(supabase, user.id, body);

    return NextResponse.json({ savedSearch }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unexpected saved search creation error.",
      },
      { status: 400 }
    );
  }
}
