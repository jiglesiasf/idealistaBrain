"use client";

import { useState, useCallback } from "react";
import type { PisoInteresante } from "@/lib/pisos-interesantes/contracts";
import { AddPisoModal } from "@/components/add-piso-modal";

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

export function PisosInteresantesClient({
  initialPisos,
}: {
  initialPisos: PisoInteresante[];
}) {
  const [pisos, setPisos] = useState(initialPisos);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPiso, setEditingPiso] = useState<PisoInteresante | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleAdd = useCallback((piso: PisoInteresante) => {
    setPisos((prev) => [piso, ...prev]);
    setShowAddModal(false);
  }, []);

  const handleUpdate = useCallback((updated: PisoInteresante) => {
    setPisos((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setEditingPiso(null);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/pisos-interesantes/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body.error ?? "Error al eliminar.");
        return;
      }
      setPisos((prev) => prev.filter((p) => p.id !== id));
    } catch {
      alert("Error de red al eliminar.");
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  }, []);

  return (
    <div>
      <div className="action-row" style={{ marginBottom: "16px" }}>
        <button className="primary-button" onClick={() => setShowAddModal(true)}>
          + Añadir piso
        </button>
      </div>

      {pisos.length === 0 ? (
        <p className="empty-state">
          No hay pisos guardados. Añade uno desde la calculadora o con el botón de arriba.
        </p>
      ) : (
        <div className="pisos-table-wrap">
          <table className="data-table pisos-table">
            <thead>
              <tr>
                <th></th>
                <th>Título</th>
                <th className="num">Precio</th>
                <th className="num">Renta/mes</th>
                <th className="num">CoC Neto</th>
                <th className="num">Bruto</th>
                <th className="num">Neto</th>
                <th className="num">Cuota hip.</th>
                <th className="num">Cash flow</th>
                <th className="num">m²</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pisos.map((piso) => (
                <PisoRow
                  key={piso.id}
                  piso={piso}
                  expanded={expandedId === piso.id}
                  onToggle={() => setExpandedId(expandedId === piso.id ? null : piso.id)}
                  onEdit={() => setEditingPiso(piso)}
                  onDelete={() => handleDelete(piso.id)}
                  deleting={deleting && deleteId === piso.id}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAddModal ? (
        <AddPisoModal
          onClose={() => setShowAddModal(false)}
          onCreated={handleAdd}
        />
      ) : null}

      {editingPiso ? (
        <AddPisoModal
          piso={editingPiso}
          onClose={() => setEditingPiso(null)}
          onCreated={handleAdd}
          onUpdated={handleUpdate}
        />
      ) : null}
    </div>
  );
}

function PisoRow({
  piso,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  deleting,
}: {
  piso: PisoInteresante;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <>
      <tr className={`pisos-row ${toneClass(piso.cashOnCashNetRoi ?? piso.cashOnCashRoi, 0.07)} ${expanded ? "pisos-row-expanded" : ""}`}>
        <td className="pisos-expand">
          <button type="button" className="pisos-expand-btn" onClick={onToggle}>
            {expanded ? "▼" : "▶"}
          </button>
        </td>
        <td>
          <div className="pisos-title-cell">
            <strong>{piso.title || "Sin título"}</strong>
            {piso.listingUrl && (
              <a href={piso.listingUrl} target="_blank" rel="noreferrer noopener" className="pisos-link">
                Idealista ↗
              </a>
            )}
          </div>
        </td>
        <td className="num">{currency(piso.priceEur)}</td>
        <td className="num">{currency(piso.estimatedRentEur)}</td>
        <td className={`num ${toneClass(piso.cashOnCashNetRoi, 0.07)}`}>
          <strong>{percent(piso.cashOnCashNetRoi)}</strong>
        </td>
        <td className={`num ${toneClass(piso.grossYield, 0.10)}`}>
          {percent(piso.grossYield)}
        </td>
        <td className={`num ${toneClass(piso.netYield, 0.07)}`}>
          {percent(piso.netYield)}
        </td>
        <td className="num">{currency(piso.monthlyMortgageEur)}</td>
        <td className={`num ${toneClass(piso.monthlyNetCashFlowEur, 0)}`}>
          {currency(piso.monthlyNetCashFlowEur)}
        </td>
        <td className="num">{piso.sqmeters ? `${fmt(piso.sqmeters)}` : "—"}</td>
        <td>
          <div className="pisos-actions-cell">
            <button className="ghost-button compact-button" onClick={onEdit}>
              Editar
            </button>
            <button
              className="danger-button compact-button"
              onClick={onDelete}
              disabled={deleting}
            >
              {deleting ? "..." : "✕"}
            </button>
          </div>
        </td>
      </tr>
      {expanded ? (
        <tr className="pisos-detail-row">
          <td colSpan={11}>
            <PisoDetail piso={piso} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function PisoDetail({ piso }: { piso: PisoInteresante }) {
  return (
    <div className="pisos-detail">
      <div className="pisos-detail-grid">
        <div className="pisos-detail-section">
          <h4>Datos del piso</h4>
          <dl>
            <dt>Superficie</dt>
            <dd>{piso.sqmeters ? `${fmt(piso.sqmeters)} m²` : "—"}</dd>
            <dt>Habitaciones</dt>
            <dd>{piso.bedrooms ?? "—"}</dd>
            <dt>Baños</dt>
            <dd>{piso.bathrooms ?? "—"}</dd>
            <dt>Tipo</dt>
            <dd>{piso.propertyType ?? "—"}</dd>
          </dl>
        </div>

        <div className="pisos-detail-section">
          <h4>Costes de adquisición</h4>
          <dl>
            <dt>ITP</dt>
            <dd>{piso.itpRate != null ? `${(piso.itpRate * 100).toFixed(1)}%` : "—"}</dd>
            <dt>Notaría + Registro</dt>
            <dd>{currency(piso.notaryRegistryEur)}</dd>
            <dt>Gastos hipoteca</dt>
            <dd>{currency(piso.mortgageFeesEur)}</dd>
            <dt>Reforma</dt>
            <dd>{currency(piso.renovationCostEur)}</dd>
            <dt>Comisión compra</dt>
            <dd>{currency(piso.purchaseCommissionEur)}</dd>
            <dt>Mobiliario</dt>
            <dd>{currency(piso.furnitureOtherEur)}</dd>
          </dl>
        </div>

        <div className="pisos-detail-section">
          <h4>Financiación</h4>
          <dl>
            <dt>% Hipotecado</dt>
            <dd>{piso.loanToValue != null ? `${(piso.loanToValue * 100).toFixed(0)}%` : "—"}</dd>
            <dt>Interés</dt>
            <dd>{piso.interestRate != null ? `${(piso.interestRate * 100).toFixed(2)}%` : "—"}</dd>
            <dt>Plazo</dt>
            <dd>{piso.mortgageTermYears ? `${piso.mortgageTermYears} años` : "—"}</dd>
            <dt>Cuota mensual</dt>
            <dd>{currency(piso.monthlyMortgageEur)}</dd>
          </dl>
        </div>

        <div className="pisos-detail-section">
          <h4>Costes anuales</h4>
          <dl>
            <dt>IBI + Basuras</dt>
            <dd>{currency(piso.ibiBasurasEur)}</dd>
            <dt>Seguros</dt>
            <dd>{currency(piso.insuranceEur)}</dd>
            <dt>Comunidad</dt>
            <dd>{currency(piso.communityEur)}</dd>
            <dt>Mantenimiento</dt>
            <dd>{currency(piso.maintenanceEur)}</dd>
            <dt>Meses vacío</dt>
            <dd>{piso.vacancyMonths ?? "—"}</dd>
          </dl>
        </div>

        <div className="pisos-detail-section">
          <h4>ROIs</h4>
          <div className="opportunity-roi-grid">
            <div className={`opportunity-roi-card ${toneClass(piso.cashOnCashRoi, 0.12)}`}>
              <span>CoC</span>
              <strong>{percent(piso.cashOnCashRoi)}</strong>
            </div>
            <div className={`opportunity-roi-card ${toneClass(piso.cashOnCashNetRoi, 0.07)}`}>
              <span>CoC Neto</span>
              <strong>{percent(piso.cashOnCashNetRoi)}</strong>
            </div>
            <div className={`opportunity-roi-card ${toneClass(piso.grossYield, 0.10)}`}>
              <span>Bruto</span>
              <strong>{percent(piso.grossYield)}</strong>
            </div>
            <div className={`opportunity-roi-card ${toneClass(piso.netYield, 0.07)}`}>
              <span>Neto</span>
              <strong>{percent(piso.netYield)}</strong>
            </div>
          </div>
          <dl style={{ marginTop: "8px" }}>
            <dt>Cash total</dt>
            <dd>{currency(piso.totalCashNeededEur)}</dd>
            <dt>Cash flow neto</dt>
            <dd>{currency(piso.monthlyNetCashFlowEur)}/mes</dd>
          </dl>
        </div>
      </div>

      {piso.notes && (
        <div className="pisos-detail-notes">
          <h4>Notas</h4>
          <p>{piso.notes}</p>
        </div>
      )}
    </div>
  );
}
