import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { lookupRegistradoresReference } from "@/lib/sale-reference/registradores";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const province = searchParams.get("province") ?? "";
  const yearParam = searchParams.get("year");
  const year = yearParam ? parseInt(yearParam, 10) : 2024;

  if (!province) {
    return NextResponse.json(
      { error: "El parámetro province es obligatorio." },
      { status: 400 }
    );
  }

  const result = await lookupRegistradoresReference(supabase, province, year);
  return NextResponse.json(result);
}
