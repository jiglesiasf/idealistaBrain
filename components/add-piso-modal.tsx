"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import type { PisoInteresante } from "@/lib/pisos-interesantes/contracts";

type Props = {
  onClose: () => void;
  onCreated: (piso: PisoInteresante) => void;
  piso?: PisoInteresante;
  onUpdated?: (piso: PisoInteresante) => void;
};

export function AddPisoModal({ onClose, onCreated, piso, onUpdated }: Props) {
  const isEdit = !!piso;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  function init(field: string, fallback = ""): string {
    if (!piso) return fallback;
    const val = (piso as Record<string, unknown>)[field];
    return val != null ? String(val) : fallback;
  }

  function initNum(field: string): string {
    if (!piso) return "";
    const val = (piso as Record<string, unknown>)[field];
    return val != null ? String(val) : "";
  }

  const [title, setTitle] = useState(init("title"));
  const [listingUrl, setListingUrl] = useState(init("listingUrl"));
  const [notes, setNotes] = useState(init("notes"));

  const [priceEur, setPriceEur] = useState(initNum("priceEur"));
  const [sqmeters, setSqmeters] = useState(initNum("sqmeters"));
  const [bedrooms, setBedrooms] = useState(initNum("bedrooms"));
  const [bathrooms, setBathrooms] = useState(initNum("bathrooms"));
  const [propertyType, setPropertyType] = useState(init("propertyType"));

  const [estimatedRentEur, setEstimatedRentEur] = useState(initNum("estimatedRentEur"));

  const [itpRate, setItpRate] = useState(initNum("itpRate"));
  const [notaryRegistryEur, setNotaryRegistryEur] = useState(initNum("notaryRegistryEur"));
  const [mortgageFeesEur, setMortgageFeesEur] = useState(initNum("mortgageFeesEur"));
  const [renovationCostEur, setRenovationCostEur] = useState(initNum("renovationCostEur"));
  const [purchaseCommissionEur, setPurchaseCommissionEur] = useState(initNum("purchaseCommissionEur"));
  const [furnitureOtherEur, setFurnitureOtherEur] = useState(initNum("furnitureOtherEur"));

  const [loanToValue, setLoanToValue] = useState(initNum("loanToValue"));
  const [interestRate, setInterestRate] = useState(initNum("interestRate"));
  const [mortgageTermYears, setMortgageTermYears] = useState(initNum("mortgageTermYears"));

  const [ibiBasurasEur, setIbiBasurasEur] = useState(initNum("ibiBasurasEur"));
  const [insuranceEur, setInsuranceEur] = useState(initNum("insuranceEur"));
  const [communityEur, setCommunityEur] = useState(initNum("communityEur"));
  const [maintenanceEur, setMaintenanceEur] = useState(initNum("maintenanceEur"));
  const [vacancyMonths, setVacancyMonths] = useState(initNum("vacancyMonths"));

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const body: Record<string, unknown> = {};

      body.title = title.trim() || null;
      body.listingUrl = listingUrl.trim() || null;
      body.notes = notes.trim() || null;

      if (priceEur) body.priceEur = Number(priceEur);
      if (sqmeters) body.sqmeters = Number(sqmeters);
      if (bedrooms) body.bedrooms = Number(bedrooms);
      if (bathrooms) body.bathrooms = Number(bathrooms);
      body.propertyType = propertyType.trim() || null;

      if (estimatedRentEur) body.estimatedRentEur = Number(estimatedRentEur);

      if (itpRate) body.itpRate = Number(itpRate);
      if (notaryRegistryEur) body.notaryRegistryEur = Number(notaryRegistryEur);
      if (mortgageFeesEur) body.mortgageFeesEur = Number(mortgageFeesEur);
      if (renovationCostEur) body.renovationCostEur = Number(renovationCostEur);
      if (purchaseCommissionEur) body.purchaseCommissionEur = Number(purchaseCommissionEur);
      if (furnitureOtherEur) body.furnitureOtherEur = Number(furnitureOtherEur);

      if (loanToValue) body.loanToValue = Number(loanToValue);
      if (interestRate) body.interestRate = Number(interestRate);
      if (mortgageTermYears) body.mortgageTermYears = Number(mortgageTermYears);

      if (ibiBasurasEur) body.ibiBasurasEur = Number(ibiBasurasEur);
      if (insuranceEur) body.insuranceEur = Number(insuranceEur);
      if (communityEur) body.communityEur = Number(communityEur);
      if (maintenanceEur) body.maintenanceEur = Number(maintenanceEur);
      if (vacancyMonths) body.vacancyMonths = Number(vacancyMonths);

      if (isEdit) {
        const res = await fetch(`/api/pisos-interesantes/${piso.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Error al guardar.");
        }

        const { piso: updated } = await res.json();
        onUpdated?.(updated);
      } else {
        const res = await fetch("/api/pisos-interesantes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Error al guardar.");
        }

        const { piso: created } = await res.json();
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
      <div className="modal-card modal-card-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isEdit ? "Editar piso" : "Añadir piso interesante"}</h3>
          <button type="button" className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="stack">
          <div className="calc-field-grid">
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label>Título</label>
              <input
                type="text"
                placeholder="Piso en Salamanca, Madrid"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label>URL de Idealista</label>
              <input
                type="url"
                placeholder="https://www.idealista.com/inmueble/..."
                value={listingUrl}
                onChange={(e) => setListingUrl(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Precio (€)</label>
              <input type="number" placeholder="150000" value={priceEur} onChange={(e) => setPriceEur(e.target.value)} />
            </div>
            <div className="field">
              <label>Renta (€/mes)</label>
              <input type="number" placeholder="800" value={estimatedRentEur} onChange={(e) => setEstimatedRentEur(e.target.value)} />
            </div>
            <div className="field">
              <label>Superficie (m²)</label>
              <input type="number" placeholder="80" value={sqmeters} onChange={(e) => setSqmeters(e.target.value)} />
            </div>
            <div className="field">
              <label>Habitaciones</label>
              <input type="number" placeholder="3" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} />
            </div>
            <div className="field">
              <label>Baños</label>
              <input type="number" placeholder="1" value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} />
            </div>
            <div className="field">
              <label>Tipo</label>
              <input type="text" placeholder="Piso, Ático..." value={propertyType} onChange={(e) => setPropertyType(e.target.value)} />
            </div>
          </div>

          <hr className="divider" />

          <p className="section-label" style={{ margin: 0 }}>Costes de adquisición</p>
          <div className="calc-field-grid">
            <div className="field">
              <label>ITP (%)</label>
              <input type="number" step="0.01" placeholder="0.10" value={itpRate} onChange={(e) => setItpRate(e.target.value)} />
            </div>
            <div className="field">
              <label>Notaría + Registro (€)</label>
              <input type="number" placeholder="2000" value={notaryRegistryEur} onChange={(e) => setNotaryRegistryEur(e.target.value)} />
            </div>
            <div className="field">
              <label>Gastos hipoteca (€)</label>
              <input type="number" placeholder="350" value={mortgageFeesEur} onChange={(e) => setMortgageFeesEur(e.target.value)} />
            </div>
            <div className="field">
              <label>Reforma (€)</label>
              <input type="number" placeholder="0" value={renovationCostEur} onChange={(e) => setRenovationCostEur(e.target.value)} />
            </div>
            <div className="field">
              <label>Comisión compra (€)</label>
              <input type="number" placeholder="0" value={purchaseCommissionEur} onChange={(e) => setPurchaseCommissionEur(e.target.value)} />
            </div>
            <div className="field">
              <label>Mobiliario (€)</label>
              <input type="number" placeholder="1000" value={furnitureOtherEur} onChange={(e) => setFurnitureOtherEur(e.target.value)} />
            </div>
          </div>

          <hr className="divider" />

          <p className="section-label" style={{ margin: 0 }}>Financiación</p>
          <div className="calc-field-grid">
            <div className="field">
              <label>% Hipotecado</label>
              <input type="number" step="0.01" placeholder="0.80" value={loanToValue} onChange={(e) => setLoanToValue(e.target.value)} />
            </div>
            <div className="field">
              <label>Interés (%)</label>
              <input type="number" step="0.001" placeholder="0.028" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} />
            </div>
            <div className="field">
              <label>Plazo (años)</label>
              <input type="number" placeholder="25" value={mortgageTermYears} onChange={(e) => setMortgageTermYears(e.target.value)} />
            </div>
          </div>

          <hr className="divider" />

          <p className="section-label" style={{ margin: 0 }}>Costes anuales</p>
          <div className="calc-field-grid">
            <div className="field">
              <label>IBI + Basuras (€)</label>
              <input type="number" placeholder="300" value={ibiBasurasEur} onChange={(e) => setIbiBasurasEur(e.target.value)} />
            </div>
            <div className="field">
              <label>Seguros (€)</label>
              <input type="number" placeholder="300" value={insuranceEur} onChange={(e) => setInsuranceEur(e.target.value)} />
            </div>
            <div className="field">
              <label>Comunidad (€)</label>
              <input type="number" placeholder="360" value={communityEur} onChange={(e) => setCommunityEur(e.target.value)} />
            </div>
            <div className="field">
              <label>Mantenimiento (€)</label>
              <input type="number" placeholder="250" value={maintenanceEur} onChange={(e) => setMaintenanceEur(e.target.value)} />
            </div>
            <div className="field">
              <label>Meses vacío/año</label>
              <input type="number" step="0.5" placeholder="1" value={vacancyMonths} onChange={(e) => setVacancyMonths(e.target.value)} />
            </div>
          </div>

          <hr className="divider" />

          <div className="field">
            <label>Notas</label>
            <textarea
              rows={2}
              placeholder="Primera visita pendiente, barrio en revalorización..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {error ? <p className="calc-url-error">{error}</p> : null}

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
