import type { SupabaseClient } from "@supabase/supabase-js";

export type RegistradoresSaleRef = {
  cod_provincia: string;
  provincia_nombre: string;
  ccaa_nombre: string;
  anio: number;
  precio_m2_vivienda: number | null;
  num_transacciones: number | null;
};

export type RegistradoresLookupResult =
  | { found: true; data: RegistradoresSaleRef }
  | { found: false; data: null };

/**
 * Busca el precio de referencia de compraventa (€/m²) para una provincia.
 * Cascade: match ilike exacto → match por nombre sin acentos → null.
 * Los nombres de provincia en la tabla pueden tener formas duales: "Valencia / València".
 */
export async function lookupRegistradoresReference(
  supabase: SupabaseClient,
  provincia: string,
  anio = 2024
): Promise<RegistradoresLookupResult> {
  const normalized = provincia.trim();

  // Intento 1: match ilike directo sobre provincia_nombre
  const { data: exact } = await supabase
    .from("registradores_sale_reference")
    .select("*")
    .eq("anio", anio)
    .ilike("provincia_nombre", normalized)
    .maybeSingle<RegistradoresSaleRef>();

  if (exact) return { found: true, data: exact };

  // Intento 2: match parcial — cubre "Alicante" → "Alicante / Alacant"
  const { data: partial } = await supabase
    .from("registradores_sale_reference")
    .select("*")
    .eq("anio", anio)
    .ilike("provincia_nombre", `%${normalized}%`)
    .maybeSingle<RegistradoresSaleRef>();

  if (partial) return { found: true, data: partial };

  return { found: false, data: null };
}
