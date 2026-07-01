import { NextResponse } from "next/server";
import { listUserOpportunities, createOpportunity } from "@/lib/opportunities/service";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const opportunities = await listUserOpportunities(supabase, user.id, {
    status: "active",
  });

  return NextResponse.json({ opportunities });
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
    const opportunity = await createOpportunity(supabase, user.id, body);

    return NextResponse.json({ opportunity }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Error inesperado al crear la oportunidad.",
      },
      { status: 400 }
    );
  }
}
