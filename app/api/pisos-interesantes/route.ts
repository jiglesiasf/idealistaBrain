import { NextResponse } from "next/server";
import { listPisosInteresantes, createPisoInteresante } from "@/lib/pisos-interesantes/service";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const pisos = await listPisosInteresantes(supabase, user.id);
    return NextResponse.json({ pisos });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al cargar pisos." },
      { status: 400 }
    );
  }
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
    const piso = await createPisoInteresante(supabase, user.id, body);

    return NextResponse.json({ piso }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error inesperado al crear el piso." },
      { status: 400 }
    );
  }
}
