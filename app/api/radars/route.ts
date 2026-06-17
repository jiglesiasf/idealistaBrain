import { NextResponse } from "next/server";
import { createRadar, listUserRadars } from "@/lib/alerts/service";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const radars = await listUserRadars(supabase, user.id);
  return NextResponse.json({ radars });
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
    const radar = await createRadar(supabase, user.id, body);

    return NextResponse.json({ radar }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Error inesperado al crear el radar.",
      },
      { status: 400 }
    );
  }
}
