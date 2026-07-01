import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { lookupAeatReference } from "@/lib/rent-reference/aeat";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const municipality = searchParams.get("municipality") ?? "";
  const province = searchParams.get("province") ?? "";
  const yearParam = searchParams.get("year");
  const year = yearParam ? parseInt(yearParam, 10) : 2023;

  if (!municipality || !province) {
    return NextResponse.json(
      { error: "Los parámetros municipality y province son obligatorios." },
      { status: 400 }
    );
  }

  const result = await lookupAeatReference(supabase, municipality, province, year);
  return NextResponse.json(result);
}
