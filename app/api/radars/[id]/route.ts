import { NextResponse } from "next/server";
import { deleteRadar, getRadarDetail, updateRadarScanStatus } from "@/lib/alerts/service";
import { updateSavedSearch } from "@/lib/alerts/service";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const detail = await getRadarDetail(supabase, user.id, id);
    return NextResponse.json(detail);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Error inesperado al cargar el radar.",
      },
      { status: 400 }
    );
  }
}

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

    if (body.scanStatus) {
      await updateRadarScanStatus(supabase, user.id, id, body.scanStatus);
      return NextResponse.json({ ok: true });
    }

    const savedSearch = await updateSavedSearch(supabase, user.id, id, body);
    return NextResponse.json({ savedSearch });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Error inesperado al actualizar el radar.",
      },
      { status: 400 }
    );
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    await deleteRadar(supabase, user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Error inesperado al eliminar el radar.",
      },
      { status: 400 }
    );
  }
}
