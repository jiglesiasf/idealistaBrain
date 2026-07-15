import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listPisosInteresantes } from "@/lib/pisos-interesantes/service";
import type { PisoInteresante } from "@/lib/pisos-interesantes/contracts";
import { PisosInteresantesClient } from "@/components/pisos-interesantes-client";

export const metadata = {
  title: "Pisos Interesantes — Idealista Brain",
  description: "Pisos compartidos con todos los datos de la calculadora guardados.",
};

export default async function PisosInteresantesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let pisos: PisoInteresante[] = [];
  let loadError: string | null = null;

  try {
    pisos = await listPisosInteresantes(supabase, user.id);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Error al cargar los pisos.";
  }

  return (
    <div className="stack">
      <section className="card">
        <div className="card-header">
          <div>
            <span className="section-label">⭐ Pisos Interesantes</span>
            <h3 className="card-title">Pisos guardados</h3>
            <p className="muted">
              Pisos compartidos con todos los datos de la calculadora. Añade desde la calculadora o manualmente.
            </p>
          </div>
        </div>

        {loadError ? (
          <section className="notice">
            <strong>Error al cargar</strong>
            <p className="muted">{loadError}</p>
          </section>
        ) : (
          <PisosInteresantesClient initialPisos={pisos} />
        )}
      </section>
    </div>
  );
}
