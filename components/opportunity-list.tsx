"use client";

import { useState, useCallback } from "react";
import type { OpportunitySummary } from "@/lib/opportunities/contracts";
import { AddOpportunityModal } from "@/components/add-opportunity-modal";

function currency(value: number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function percent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

function fmt(value: number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("es-ES").format(value);
}

function toneClass(value: number | null, target: number) {
  if (value === null || !Number.isFinite(value)) return "tone-neutral";
  if (value >= target) return "tone-green";
  if (value >= target * 0.7) return "tone-yellow";
  return "tone-red";
}

export function OpportunityList({
  initialOpportunities,
}: {
  initialOpportunities: OpportunitySummary[];
}) {
  const [opportunities, setOpportunities] = useState(initialOpportunities);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingOpp, setEditingOpp] = useState<OpportunitySummary | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleAdd = useCallback(
    (opp: OpportunitySummary) => {
      setOpportunities((prev) => [opp, ...prev]);
      setShowAddModal(false);
    },
    []
  );

  const handleDelete = useCallback(async (id: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/opportunities/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body.error ?? "Error al eliminar.");
        return;
      }
      setOpportunities((prev) => prev.filter((o) => o.id !== id));
    } catch {
      alert("Error de red al eliminar.");
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  }, []);

  const handleUpdate = useCallback((updated: OpportunitySummary) => {
    setOpportunities((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    setEditingOpp(null);
  }, []);

  const handleArchive = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/opportunities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body.error ?? "Error al archivar.");
        return;
      }
      setOpportunities((prev) => prev.filter((o) => o.id !== id));
    } catch {
      alert("Error de red al archivar.");
    }
  }, []);

  return (
    <div>
      <div className="action-row" style={{ marginBottom: "16px" }}>
        <button className="primary-button" onClick={() => setShowAddModal(true)}>
          + Añadir oportunidad
        </button>
      </div>

      {opportunities.length === 0 ? (
        <p className="empty-state">
          No tienes ninguna oportunidad guardada. Añade una desde la calculadora o con el botón de arriba.
        </p>
      ) : (
        <div className="opportunities-grid">
          {opportunities.map((opp) => (
            <article
              key={opp.id}
              className={`opportunity-spotlight-card ${toneClass(opp.cashOnCashNetRoi ?? opp.cashOnCashRoi, 0.07)}`}
            >
              <div className="radar-card-header">
                <div className="radar-card-title">
                  <strong>{opp.title ?? "Sin título"}</strong>
                  {opp.listingUrl && (
                    <a
                      href={opp.listingUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="muted"
                      style={{ fontSize: "0.85em" }}
                    >
                      Ver en Idealista ↗
                    </a>
                  )}
                </div>
                <div className="radar-card-badge">
                  {opp.source === "analysis" ? (
                    <span className="job-search-pill">Desde análisis</span>
                  ) : null}
                </div>
              </div>

              <div className="opportunity-facts-grid">
                <div className="opportunity-fact-pill">
                  <span>Precio</span>
                  <strong>{currency(opp.priceEur)}</strong>
                </div>
                <div className="opportunity-fact-pill">
                  <span>Renta est.</span>
                  <strong>{currency(opp.estimatedRentEur)}/mes</strong>
                </div>
                <div className="opportunity-fact-pill">
                  <span>Coste inicial</span>
                  <strong>{currency(opp.totalCashNeededEur)}</strong>
                </div>
                <div className="opportunity-fact-pill">
                  <span>Superficie</span>
                  <strong>{opp.sqmeters ? `${fmt(opp.sqmeters)} m²` : "—"}</strong>
                </div>
                <div className="opportunity-fact-pill">
                  <span>Habitaciones</span>
                  <strong>{opp.bedrooms ?? "—"}</strong>
                </div>
                <div className="opportunity-fact-pill">
                  <span>Baños</span>
                  <strong>{opp.bathrooms ?? "—"}</strong>
                </div>
              </div>

              <div className="opportunity-roi-grid" style={{ marginTop: "10px" }}>
                <div className={`opportunity-roi-card ${toneClass(opp.cashOnCashRoi, 0.12)}`}>
                  <span>CoC</span>
                  <strong>{percent(opp.cashOnCashRoi)}</strong>
                </div>
                <div className={`opportunity-roi-card ${toneClass(opp.cashOnCashNetRoi, 0.07)}`}>
                  <span>CoC Neto</span>
                  <strong>{percent(opp.cashOnCashNetRoi)}</strong>
                </div>
                <div className={`opportunity-roi-card ${toneClass(opp.grossRoi, 0.10)}`}>
                  <span>Bruto</span>
                  <strong>{percent(opp.grossRoi)}</strong>
                </div>
                <div className={`opportunity-roi-card ${toneClass(opp.netRoi, 0.07)}`}>
                  <span>Neto</span>
                  <strong>{percent(opp.netRoi)}</strong>
                </div>
              </div>

              {opp.notes && (
                <p className="muted" style={{ marginTop: "8px", fontSize: "0.85em" }}>
                  📝 {opp.notes}
                </p>
              )}

              <div className="action-row" style={{ marginTop: "12px" }}>
                <button
                  className="ghost-button compact-button"
                  onClick={() => setEditingOpp(opp)}
                >
                  Editar
                </button>
                <button
                  className="ghost-button compact-button"
                  onClick={() => handleArchive(opp.id)}
                >
                  Archivar
                </button>
                <button
                  className="danger-button compact-button"
                  onClick={() => setDeleteId(opp.id)}
                  disabled={deleting && deleteId === opp.id}
                >
                  {deleting && deleteId === opp.id ? "Eliminando..." : "Eliminar"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {showAddModal ? (
        <AddOpportunityModal
          onClose={() => setShowAddModal(false)}
          onCreated={handleAdd}
        />
      ) : null}

      {editingOpp ? (
        <AddOpportunityModal
          opportunity={editingOpp}
          onClose={() => setEditingOpp(null)}
          onCreated={handleAdd}
          onUpdated={handleUpdate}
        />
      ) : null}
    </div>
  );
}
