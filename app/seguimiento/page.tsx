import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listUserOpportunities } from "@/lib/opportunities/service";
import type { OpportunitySummary } from "@/lib/opportunities/contracts";
import { OpportunityList } from "@/components/opportunity-list";

export const metadata = {
  title: "Seguimiento — Idealista Brain",
  description: "Tus oportunidades guardadas para seguimiento.",
};

export default async function SeguimientoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let opportunities: OpportunitySummary[] = [];
  let loadError: string | null = null;

  try {
    opportunities = await listUserOpportunities(supabase, user.id, {
      status: "active",
    });
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Error al cargar las oportunidades.";
  }

  return (
    <div className="stack">
      <section className="card">
        <div className="card-header">
          <div>
            <span className="section-label">📌 Seguimiento</span>
            <h3 className="card-title">Oportunidades guardadas</h3>
            <p className="muted">
              Aquí tienes las oportunidades que has marcado para hacer seguimiento. Añádelas desde la calculadora o manualmente.
            </p>
          </div>
        </div>

        {loadError ? (
          <section className="notice">
            <strong>Error al cargar</strong>
            <p className="muted">{loadError}</p>
          </section>
        ) : (
          <OpportunityList initialOpportunities={opportunities} />
        )}
      </section>
    </div>
  );
}
