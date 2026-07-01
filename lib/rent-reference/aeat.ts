import type { SupabaseClient } from "@supabase/supabase-js";

export type AeatRentRef = {
  ine_municipio_code: string;
  municipio_nombre: string;
  provincia_nombre: string;
  ccaa_nombre: string;
  codigo_postal: string | null;
  anio: number;
  tipo_uso: string;
  num_viviendas_arrendadas: number | null;
  pct_viviendas_arrendadas: number | null;
  alquiler_medio_mensual: number | null;
  alquiler_m2_mensual: number | null;
  m2_medios: number | null;
  dias_alquiler_medios: number | null;
  valor_referencia_medio: number | null;
  rentabilidad_bruta_pct: number | null;
};

export type AeatLookupResult =
  | { found: true; level: "municipio" | "provincia"; data: AeatRentRef }
  | { found: false; level: null; data: null };

/**
 * Busca el dato de referencia AEAT para un municipio+provincia.
 * Cascade: match exacto de municipio → match de provincia (media ponderada aprox.).
 * Los nombres se normalizan: minúsculas + sin tildes via unaccent en Postgres.
 */
export async function lookupAeatReference(
  supabase: SupabaseClient,
  municipio: string,
  provincia: string,
  anio = 2023
): Promise<AeatLookupResult> {
  const { data: exact } = await supabase
    .from("aeat_rent_reference")
    .select("*")
    .eq("anio", anio)
    .eq("tipo_uso", "vivienda_habitual")
    .ilike("municipio_nombre", municipio.trim())
    .ilike("provincia_nombre", provincia.trim())
    .maybeSingle<AeatRentRef>();

  if (exact) return { found: true, level: "municipio", data: exact };

  // Fallback: mismo municipio en cualquier provincia (p.ej. "Valencia" puede ser ciudad o provincia)
  const { data: byMunicipio } = await supabase
    .from("aeat_rent_reference")
    .select("*")
    .eq("anio", anio)
    .eq("tipo_uso", "vivienda_habitual")
    .ilike("municipio_nombre", municipio.trim())
    .maybeSingle<AeatRentRef>();

  if (byMunicipio) return { found: true, level: "municipio", data: byMunicipio };

  // Fallback provincia: capital de provincia con mismo nombre
  const { data: capital } = await supabase
    .from("aeat_rent_reference")
    .select("*")
    .eq("anio", anio)
    .eq("tipo_uso", "vivienda_habitual")
    .ilike("municipio_nombre", provincia.trim())
    .maybeSingle<AeatRentRef>();

  if (capital) return { found: true, level: "provincia", data: capital };

  return { found: false, level: null, data: null };
}
