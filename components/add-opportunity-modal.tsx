"use client";

import { useState } from "react";
import type { OpportunitySummary } from "@/lib/opportunities/contracts";

type Props = {
  onClose: () => void;
  onCreated: (opp: OpportunitySummary) => void;
  prefill?: {
    listingUrl?: string;
    title?: string | null;
    priceEur?: number | null;
    estimatedRentEur?: number | null;
    totalCashNeededEur?: number | null;
    sqmeters?: number | null;
    bedrooms?: number | null;
    bathrooms?: number | null;
    cashOnCashRoi?: number | null;
    cashOnCashNetRoi?: number | null;
    grossRoi?: number | null;
    netRoi?: number | null;
  };
};

export function AddOpportunityModal({ onClose, onCreated, prefill }: Props) {
  const [listingUrl, setListingUrl] = useState(prefill?.listingUrl ?? "");
  const [title, setTitle] = useState(prefill?.title ?? "");
  const [priceEur, setPriceEur] = useState(prefill?.priceEur?.toString() ?? "");
  const [estimatedRentEur, setEstimatedRentEur] = useState(
    prefill?.estimatedRentEur?.toString() ?? ""
  );
  const [totalCashNeededEur, setTotalCashNeededEur] = useState(
    prefill?.totalCashNeededEur?.toString() ?? ""
  );
  const [sqmeters, setSqmeters] = useState(prefill?.sqmeters?.toString() ?? "");
  const [bedrooms, setBedrooms] = useState(prefill?.bedrooms?.toString() ?? "");
  const [bathrooms, setBathrooms] = useState(prefill?.bathrooms?.toString() ?? "");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!listingUrl.trim()) {
      setError("La URL de Idealista es obligatoria.");
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        listingUrl: listingUrl.trim(),
        title: title.trim() || null,
        priceEur: priceEur ? Number(priceEur) : null,
        estimatedRentEur: estimatedRentEur ? Number(estimatedRentEur) : null,
        totalCashNeededEur: totalCashNeededEur ? Number(totalCashNeededEur) : null,
        sqmeters: sqmeters ? Number(sqmeters) : null,
        bedrooms: bedrooms ? Number(bedrooms) : null,
        bathrooms: bathrooms ? Number(bathrooms) : null,
        notes: notes.trim() || null,
        source: prefill ? "analysis" : "manual",
      };

      if (prefill?.cashOnCashRoi !== undefined) body.cashOnCashRoi = prefill.cashOnCashRoi;
      if (prefill?.cashOnCashNetRoi !== undefined) body.cashOnCashNetRoi = prefill.cashOnCashNetRoi;
      if (prefill?.grossRoi !== undefined) body.grossRoi = prefill.grossRoi;
      if (prefill?.netRoi !== undefined) body.netRoi = prefill.netRoi;

      const res = await fetch("/api/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Error al guardar.");
      }

      const { opportunity } = await res.json();
      onCreated(opportunity);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "520px" }}>
        <div className="modal-header">
          <h3>Añadir oportunidad</h3>
          <button type="button" className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="opp-form">
          <div className="field">
            <label>URL de Idealista *</label>
            <input
              type="url"
              required
              placeholder="https://www.idealista.com/inmueble/..."
              value={listingUrl}
              onChange={(e) => setListingUrl(e.target.value)}
            />
          </div>

          <div className="field">
            <label>Título</label>
            <input
              type="text"
              placeholder="Piso en Salamanca, Madrid"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="opp-form-grid">
            <div className="field">
              <label>Precio (€)</label>
              <input
                type="number"
                placeholder="150000"
                value={priceEur}
                onChange={(e) => setPriceEur(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Renta (€/mes)</label>
              <input
                type="number"
                placeholder="800"
                value={estimatedRentEur}
                onChange={(e) => setEstimatedRentEur(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Coste inicial (€)</label>
              <input
                type="number"
                placeholder="50000"
                value={totalCashNeededEur}
                onChange={(e) => setTotalCashNeededEur(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Superficie (m²)</label>
              <input
                type="number"
                placeholder="80"
                value={sqmeters}
                onChange={(e) => setSqmeters(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Habitaciones</label>
              <input
                type="number"
                placeholder="3"
                value={bedrooms}
                onChange={(e) => setBedrooms(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Baños</label>
              <input
                type="number"
                placeholder="1"
                value={bathrooms}
                onChange={(e) => setBathrooms(e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label>Notas</label>
            <textarea
              rows={2}
              placeholder="Primera visita pendiente, barrio en revalorización..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {error ? (
            <p className="calc-url-error">{error}</p>
          ) : null}

          <div className="action-row" style={{ marginTop: "4px" }}>
            <button type="button" className="ghost-button" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
