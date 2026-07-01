"use client";

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { calculate } from "@/lib/calculator/engine";
import type { CalculatorInput } from "@/lib/calculator/engine";
import type { OpportunitySummary } from "@/lib/opportunities/contracts";

const ROI_DEFAULTS: CalculatorInput = {
  price: 150000,
  monthlyRent: 800,
  itpRate: 0.10,
  notaryRegistry: 2000,
  mortgageFees: 350,
  renovationCost: 0,
  purchaseCommission: 0,
  furnitureOther: 1000,
  loanToValue: 0.8,
  interestRate: 0.028,
  mortgageTermYears: 25,
  ibiBasuras: 300,
  insurance: 300,
  community: 360,
  maintenance: 250,
  vacancyMonths: 1,
};

type Prefill = {
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

type Props = {
  onClose: () => void;
  onCreated: (opp: OpportunitySummary) => void;
  prefill?: Prefill;
  opportunity?: OpportunitySummary;
  onUpdated?: (opp: OpportunitySummary) => void;
};

export function AddOpportunityModal({ onClose, onCreated, prefill, opportunity, onUpdated }: Props) {
  const isEdit = !!opportunity;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  function init(name: keyof Prefill, fallback = ""): string {
    if (opportunity) {
      const val = opportunity[name as keyof typeof opportunity];
      return val != null ? String(val) : fallback;
    }
    const pv = prefill?.[name];
    return pv != null ? String(pv) : fallback;
  }

  const [listingUrl, setListingUrl] = useState(isEdit ? opportunity.listingUrl : prefill?.listingUrl ?? "");
  const [title, setTitle] = useState(init("title"));
  const [priceEur, setPriceEur] = useState(init("priceEur"));
  const [estimatedRentEur, setEstimatedRentEur] = useState(init("estimatedRentEur"));
  const [totalCashNeededEur, setTotalCashNeededEur] = useState(init("totalCashNeededEur"));
  const [sqmeters, setSqmeters] = useState(init("sqmeters"));
  const [bedrooms, setBedrooms] = useState(init("bedrooms"));
  const [bathrooms, setBathrooms] = useState(init("bathrooms"));
  const [notes, setNotes] = useState(opportunity?.notes ?? "");

  const [grossRoi, setGrossRoi] = useState<number | null>(
    opportunity?.grossRoi ?? prefill?.grossRoi ?? null
  );
  const [netRoi, setNetRoi] = useState<number | null>(
    opportunity?.netRoi ?? prefill?.netRoi ?? null
  );
  const [cashOnCashRoi, setCashOnCashRoi] = useState<number | null>(
    opportunity?.cashOnCashRoi ?? prefill?.cashOnCashRoi ?? null
  );
  const [cashOnCashNetRoi, setCashOnCashNetRoi] = useState<number | null>(
    opportunity?.cashOnCashNetRoi ?? prefill?.cashOnCashNetRoi ?? null
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const recomputed = useMemo(() => {
    const p = Number(priceEur);
    const r = Number(estimatedRentEur);
    if (!p || !r) return null;
    const out = calculate({ ...ROI_DEFAULTS, price: p, monthlyRent: r });
    return out.roi;
  }, [priceEur, estimatedRentEur]);

  function handleRecalculate() {
    if (!recomputed) return;
    setGrossRoi(recomputed.grossYield);
    setNetRoi(recomputed.netYield);
    setCashOnCashRoi(recomputed.cashOnCashRoi);
    setCashOnCashNetRoi(recomputed.cashOnCashNetRoi);
  }

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
      };

      body.cashOnCashRoi = cashOnCashRoi;
      body.cashOnCashNetRoi = cashOnCashNetRoi;
      body.grossRoi = grossRoi;
      body.netRoi = netRoi;

      if (isEdit) {
        const res = await fetch(`/api/opportunities/${opportunity.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Error al guardar.");
        }

        const { opportunity: updated } = await res.json();
        onUpdated?.(updated);
      } else {
        body.source = prefill ? "analysis" : "manual";

        const res = await fetch("/api/opportunities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Error al guardar.");
        }

        const { opportunity: created } = await res.json();
        onCreated(created);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setSaving(false);
    }
  }

  const content = (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isEdit ? "Editar oportunidad" : "Añadir oportunidad"}</h3>
          <button type="button" className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="stack">
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

          <div className="calc-field-grid">
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

          {isEdit ? (
            <div>
              <div className="opportunity-roi-grid" style={{ marginBottom: "8px" }}>
                <div className={`opportunity-roi-card ${grossRoi != null ? "tone-neutral" : ""}`}>
                  <span>Bruto</span>
                  <strong>{grossRoi != null ? `${(grossRoi * 100).toFixed(1)}%` : "—"}</strong>
                </div>
                <div className={`opportunity-roi-card ${netRoi != null ? "tone-neutral" : ""}`}>
                  <span>Neto</span>
                  <strong>{netRoi != null ? `${(netRoi * 100).toFixed(1)}%` : "—"}</strong>
                </div>
                <div className={`opportunity-roi-card ${cashOnCashRoi != null ? "tone-neutral" : ""}`}>
                  <span>CoC</span>
                  <strong>{cashOnCashRoi != null ? `${(cashOnCashRoi * 100).toFixed(1)}%` : "—"}</strong>
                </div>
                <div className={`opportunity-roi-card ${cashOnCashNetRoi != null ? "tone-neutral" : ""}`}>
                  <span>CoC Neto</span>
                  <strong>{cashOnCashNetRoi != null ? `${(cashOnCashNetRoi * 100).toFixed(1)}%` : "—"}</strong>
                </div>
              </div>
              <button
                type="button"
                className="primary-button"
                onClick={handleRecalculate}
                disabled={!recomputed}
                style={{ width: "100%" }}
              >
                Recalcular ROIs
              </button>
            </div>
          ) : null}

          {error ? (
            <p className="calc-url-error">{error}</p>
          ) : null}

          <div className="action-row">
            <button type="button" className="ghost-button" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(content, document.body);
}
