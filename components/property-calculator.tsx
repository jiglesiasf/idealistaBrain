"use client";

import { useMemo, useState, useCallback } from "react";
import { calculate, calculateTargetPrice, calculateTargetRent } from "@/lib/calculator/engine";
import { ITP_OPTIONS, getItpRate } from "@/lib/calculator/itp";
import type { CalculatorInput, TargetPrice, TargetRent } from "@/lib/calculator/engine";
import { AddOpportunityModal } from "@/components/add-opportunity-modal";
import { NumberInput } from "@/components/number-input";

type ConfidenceSignals = {
  score: number;
  effectiveSampleSize: number;
  coefficientOfVariation: number;
  dispersionLabel: string;
  stateAdjusted: boolean;
  adjustmentFactor: number | null;
  comparablesAfterOutlierRemoval: number;
  outliersRemoved: number;
};

type ComparableData = {
  title: string;
  url: string;
  priceEur: number | null;
  areaM2: number | null;
  rooms: number | null;
  pricePerM2: number | null;
  score: number | null;
  scope: string;
  state: string | null;
  zone: string | null;
};

const EXTENSION_ID = process.env.NEXT_PUBLIC_COMPANION_EXTENSION_ID ?? "";

type ImportStatus = "idle" | "pinging" | "creating-job" | "dispatching" | "waiting" | "error";

type ChromeRuntime = {
  lastError?: { message?: string };
  sendMessage?: (
    extensionId: string,
    message: unknown,
    callback: (response?: { ok?: boolean; error?: string; busy?: boolean; activeJobId?: string }) => void
  ) => void;
};

function getChromeRuntime(): ChromeRuntime | null {
  const cr = (globalThis as typeof globalThis & { chrome?: { runtime?: ChromeRuntime } }).chrome?.runtime;
  return cr ?? null;
}

function normalizeError(msg?: string) {
  if (!msg) return "No he podido contactar con el companion instalado.";
  if (/message port closed before a response was received/i.test(msg))
    return "El companion no ha respondido. Recarga la extensión en chrome://extensions y vuelve a probar.";
  if (/receiving end does not exist|could not establish connection/i.test(msg))
    return "La extensión no está activa. Verifica que el companion esté instalado y habilitado.";
  return msg;
}

const PROVINCE_TO_COMMUNITY: Record<string, string> = {
  Madrid: "Comunidad de Madrid",
  Barcelona: "Cataluña",
  Girona: "Cataluña",
  Lleida: "Cataluña",
  Tarragona: "Cataluña",
  Valencia: "Comunidad Valenciana",
  Alicante: "Comunidad Valenciana",
  Castellón: "Comunidad Valenciana",
  Sevilla: "Andalucía",
  Málaga: "Andalucía",
  Cádiz: "Andalucía",
  Córdoba: "Andalucía",
  Granada: "Andalucía",
  Huelva: "Andalucía",
  Jaén: "Andalucía",
  Almería: "Andalucía",
  Zaragoza: "Aragón",
  Huesca: "Aragón",
  Teruel: "Aragón",
  Asturias: "Asturias",
  Baleares: "Baleares",
  "Las Palmas": "Canarias",
  "Santa Cruz de Tenerife": "Canarias",
  Cantabria: "Cantabria",
  Albacete: "Castilla - La Mancha",
  "Ciudad Real": "Castilla - La Mancha",
  Cuenca: "Castilla - La Mancha",
  Guadalajara: "Castilla - La Mancha",
  Toledo: "Castilla - La Mancha",
  "A Coruña": "Galicia",
  Lugo: "Galicia",
  Ourense: "Galicia",
  Pontevedra: "Galicia",
  Burgos: "Castilla León",
  León: "Castilla León",
  Salamanca: "Castilla León",
  Valladolid: "Castilla León",
  Palencia: "Castilla León",
  Zamora: "Castilla León",
  Ávila: "Castilla León",
  Segovia: "Castilla León",
  Soria: "Castilla León",
  "La Rioja": "La Rioja",
  Murcia: "Murcia",
  Navarra: "Navarra",
  Álava: "País Vasco",
  Araba: "País Vasco",
  Bizkaia: "País Vasco",
  Gipuzkoa: "País Vasco",
  Guipúzcoa: "País Vasco",
  Vizcaya: "País Vasco",
  Ceuta: "Ceuta",
  Melilla: "Melilla",
  Extremadura: "Extremadura",
  Badajoz: "Extremadura",
  Cáceres: "Extremadura",
};

function provinceToCommunity(province: string): string | null {
  return PROVINCE_TO_COMMUNITY[province] ?? null;
}

function currency(value: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

function percent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "n/d";
  return `${(value * 100).toFixed(1)}%`;
}

function fmt(value: number) {
  return new Intl.NumberFormat("es-ES").format(value);
}

function toneClass(value: number | null, target: number) {
  if (value === null || !Number.isFinite(value)) return "tone-neutral";
  if (value >= target) return "tone-green";
  if (value >= target * 0.7) return "tone-yellow";
  return "tone-red";
}

function round(v: number): number {
  return Math.round(v);
}

function buildShareUrl(input: CalculatorInput, idealistaUrl?: string): string {
  const params = new URLSearchParams();
  if (input.price !== 150000) params.set("price", String(input.price));
  if (input.monthlyRent !== 800) params.set("monthlyRent", String(input.monthlyRent));
  if (input.itpRate !== 0.10) params.set("itpRate", String(input.itpRate));
  if (input.notaryRegistry !== 2000) params.set("notaryRegistry", String(input.notaryRegistry));
  if (input.mortgageFees !== 350) params.set("mortgageFees", String(input.mortgageFees));
  if (input.renovationCost !== 0) params.set("renovationCost", String(input.renovationCost));
  if (input.purchaseCommission !== 0) params.set("purchaseCommission", String(input.purchaseCommission));
  if (input.furnitureOther !== 1000) params.set("furnitureOther", String(input.furnitureOther));
  if (input.loanToValue !== 0.8) params.set("loanToValue", String(input.loanToValue));
  if (input.interestRate !== 0.028) params.set("interestRate", String(input.interestRate));
  if (input.mortgageTermYears !== 25) params.set("mortgageTermYears", String(input.mortgageTermYears));
  if (input.ibiBasuras !== 300) params.set("ibiBasuras", String(input.ibiBasuras));
  if (input.insurance !== 300) params.set("insurance", String(input.insurance));
  if (input.community !== 360) params.set("community", String(input.community));
  if (input.maintenance !== 250) params.set("maintenance", String(input.maintenance));
  if (input.vacancyMonths !== 1) params.set("vacancyMonths", String(input.vacancyMonths));
  if (idealistaUrl) params.set("idealistaUrl", idealistaUrl);
  const qs = params.toString();
  return `${window.location.origin}/calculator${qs ? `?${qs}` : ""}`;
}

const DEFAULT_INPUT: CalculatorInput = {
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

export function PropertyCalculator({ initialValues, initialIdealistaUrl }: { initialValues?: Partial<CalculatorInput>; initialIdealistaUrl?: string }) {
  const [input, setInput] = useState<CalculatorInput>({ ...DEFAULT_INPUT, ...initialValues });
  const [itpCommunity, setItpCommunity] = useState("Comunidad Valenciana");
  const [hasRenovation, setHasRenovation] = useState(false);
  const [idealistaUrl, setIdealistaUrl] = useState(initialIdealistaUrl ?? "");
  const [importStatus, setImportStatus] = useState<ImportStatus>("idle");
  const [importError, setImportError] = useState("");
  const [importResult, setImportResult] = useState<{
    price: number | null;
    rent: number | null;
    community: string | null;
    province: string | null;
    area: number | null;
    rooms: number | null;
    propertyType: string | null;
    state: string | null;
    referenceRent: number | null;
    referencePricePerM2: number | null;
    confidence: string | null;
    lowEur: number | null;
    highEur: number | null;
    method: string | null;
    comparablesUsed: number | null;
    confidenceSignals: ConfidenceSignals | null;
    importedUrl: string;
    comparables: ComparableData[];
  } | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [showComparables, setShowComparables] = useState(false);
  const [showScoreHelp, setShowScoreHelp] = useState(false);
  const [showAddOppModal, setShowAddOppModal] = useState(false);

  const result = useMemo(() => calculate(input), [input]);
  const targetPrice = useMemo(() => calculateTargetPrice(input), [input]);
  const targetRent = useMemo(() => calculateTargetRent(input), [input]);

  function patch(partial: Partial<CalculatorInput>) {
    setInput((prev) => ({ ...prev, ...partial }));
  }

  function onItpCommunityChange(community: string) {
    setItpCommunity(community);
    patch({ itpRate: getItpRate(community) });
  }

  function toggleRenovation(active: boolean) {
    setHasRenovation(active);
    patch({ renovationCost: active ? DEFAULT_INPUT.renovationCost : 0 });
  }

  const handleImportFromUrl = useCallback(async () => {
    const url = idealistaUrl.trim();
    if (!url) return;

    setImportError("");
    setImportResult(null);
    const runtime = getChromeRuntime();

    if (!runtime?.sendMessage || !EXTENSION_ID) {
      setImportError("La extensión companion no está disponible en este navegador.");
      setImportStatus("error");
      return;
    }

    setImportStatus("pinging");
    const ping = await new Promise<{ ok: boolean; error?: string }>((r) => {
      try {
        runtime.sendMessage!(EXTENSION_ID, { type: "IDEALISTA_BRAIN_PING" }, (res) => {
          if (runtime.lastError?.message) {
            r({ ok: false, error: normalizeError(runtime.lastError.message) });
          } else if (!res?.ok) {
            r({ ok: false, error: "No he podido contactar con el companion." });
          } else {
            r({ ok: true });
          }
        });
      } catch (e) {
        r({ ok: false, error: e instanceof Error ? e.message : "Error al contactar con el companion." });
      }
    });

    if (!ping.ok) {
      setImportError(ping.error ?? "Error al contactar con el companion.");
      setImportStatus("error");
      return;
    }

    setImportStatus("creating-job");
    let createRes: Response;
    try {
      createRes = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUrl: url, mode: "listing-analysis" }),
      });
    } catch {
      setImportError("Error de red al crear el análisis. ¿Está el servidor funcionando?");
      setImportStatus("error");
      return;
    }

    if (createRes.status === 401) {
      setImportError("Necesitas iniciar sesión para usar esta función.");
      setImportStatus("error");
      return;
    }

    if (!createRes.ok) {
      const body = await createRes.json().catch(() => ({}));
      setImportError(body.error ?? "Error al crear el trabajo de análisis.");
      setImportStatus("error");
      return;
    }

    const { job, dispatch } = await createRes.json();
    setImportStatus("dispatching");

    const dispatched = await new Promise<{ ok: boolean; error?: string }>((r) => {
      try {
        runtime.sendMessage!(
          EXTENSION_ID,
          { type: "IDEALISTA_BRAIN_EXECUTE_JOB", payload: dispatch },
          (res) => {
            if (runtime.lastError?.message) {
              r({ ok: false, error: normalizeError(runtime.lastError.message) });
            } else if (!res?.ok) {
              r({ ok: false, error: res?.error ?? "El companion ha rechazado el trabajo." });
            } else {
              r({ ok: true });
            }
          }
        );
      } catch (e) {
        r({ ok: false, error: e instanceof Error ? e.message : "Error al enviar el trabajo al companion." });
      }
    });

    if (!dispatched.ok) {
      setImportError(dispatched.error ?? "Error al enviar el trabajo al companion.");
      setImportStatus("error");
      return;
    }

    setImportStatus("waiting");
    const jobId = job.id;
    const pollInterval = setInterval(async () => {
      try {
        const pollRes = await fetch(`/api/jobs/${jobId}`);
        if (!pollRes.ok) {
          clearInterval(pollInterval);
          setImportError("Error al consultar el estado del análisis.");
          setImportStatus("error");
          return;
        }
        const { job: jobView } = await pollRes.json();
        if (jobView.status === "completed") {
          clearInterval(pollInterval);
          const payload = jobView.result?.payload as Record<string, unknown> | undefined;
          const subject = payload?.subject as Record<string, unknown> | undefined;
          const targetAsset = subject?.targetAsset as Record<string, unknown> | undefined;
          const loc = subject?.location as Record<string, unknown> | undefined;

          const imported: {
            price: number | null; rent: number | null; community: string | null; province: string | null;
            area: number | null; rooms: number | null; propertyType: string | null; state: string | null;
            referenceRent: number | null; referencePricePerM2: number | null;
            confidence: string | null; lowEur: number | null; highEur: number | null;
            method: string | null; comparablesUsed: number | null;
            confidenceSignals: ConfidenceSignals | null;
          } = { price: null, rent: null, community: null, province: null, area: null, rooms: null, propertyType: null, state: null, referenceRent: null, referencePricePerM2: null, confidence: null, lowEur: null, highEur: null, method: null, comparablesUsed: null, confidenceSignals: null };

          if (targetAsset?.priceEur && typeof targetAsset.priceEur === "number") {
            imported.price = targetAsset.priceEur;
            patch({ price: targetAsset.priceEur });
          }

          if (targetAsset?.areaM2 && typeof targetAsset.areaM2 === "number") {
            imported.area = targetAsset.areaM2;
          }

          if (targetAsset?.rooms && typeof targetAsset.rooms === "number") {
            imported.rooms = targetAsset.rooms;
          }

          if (targetAsset?.propertyType && typeof targetAsset.propertyType === "string") {
            imported.propertyType = targetAsset.propertyType;
          }

          if (targetAsset?.state && typeof targetAsset.state === "string") {
            imported.state = targetAsset.state;
            if (targetAsset.state === "reformar" || targetAsset.state === "a reformar") {
              setHasRenovation(true);
            }
          }

          let detectedProvince = loc?.province && typeof loc.province === "string" ? loc.province : null;
          if (!detectedProvince) {
            const inferred = payload?.inferredProvince;
            if (typeof inferred === "string") detectedProvince = inferred;
          }

          if (detectedProvince) {
            imported.province = detectedProvince;
            const community = provinceToCommunity(detectedProvince);
            if (community && ITP_OPTIONS.includes(community)) {
              imported.community = community;
              setItpCommunity(community);
              patch({ itpRate: getItpRate(community) });
            }
          }

          const estimate = payload?.estimate as Record<string, unknown> | undefined;
          if (estimate?.monthlyRentEur && typeof estimate.monthlyRentEur === "number") {
            imported.rent = estimate.monthlyRentEur;
            patch({ monthlyRent: estimate.monthlyRentEur });
          }
          if (estimate?.referenceMonthlyRentEur && typeof estimate.referenceMonthlyRentEur === "number") {
            imported.referenceRent = estimate.referenceMonthlyRentEur;
          }
          if (estimate?.referencePricePerM2 && typeof estimate.referencePricePerM2 === "number") {
            imported.referencePricePerM2 = estimate.referencePricePerM2;
          }
          if (estimate?.confidence && typeof estimate.confidence === "string") {
            imported.confidence = estimate.confidence;
          }
          if (estimate?.lowEur && typeof estimate.lowEur === "number") {
            imported.lowEur = estimate.lowEur;
          }
          if (estimate?.highEur && typeof estimate.highEur === "number") {
            imported.highEur = estimate.highEur;
          }
          if (estimate?.method && typeof estimate.method === "string") {
            imported.method = estimate.method;
          }
          if (estimate?.comparablesUsed && typeof estimate.comparablesUsed === "number") {
            imported.comparablesUsed = estimate.comparablesUsed;
          }

          const rawSignals = estimate?.confidenceSignals as Record<string, unknown> | undefined;
          if (rawSignals && typeof rawSignals.score === "number") {
            imported.confidenceSignals = {
              score: rawSignals.score,
              effectiveSampleSize: typeof rawSignals.effectiveSampleSize === "number" ? rawSignals.effectiveSampleSize : 0,
              coefficientOfVariation: typeof rawSignals.coefficientOfVariation === "number" ? rawSignals.coefficientOfVariation : 0,
              dispersionLabel: typeof rawSignals.dispersionLabel === "string" ? rawSignals.dispersionLabel : "",
              stateAdjusted: rawSignals.stateAdjusted === true,
              adjustmentFactor: typeof rawSignals.adjustmentFactor === "number" ? rawSignals.adjustmentFactor : null,
              comparablesAfterOutlierRemoval: typeof rawSignals.comparablesAfterOutlierRemoval === "number" ? rawSignals.comparablesAfterOutlierRemoval : 0,
              outliersRemoved: typeof rawSignals.outliersRemoved === "number" ? rawSignals.outliersRemoved : 0,
            };
          }

          const rawComparables = payload?.comparables as Array<Record<string, unknown>> | undefined;
          const comparables: ComparableData[] = (rawComparables ?? []).map((c) => ({
            title: typeof c.title === "string" ? c.title : "",
            url: typeof c.url === "string" ? c.url : typeof c.canonicalUrl === "string" ? c.canonicalUrl : "",
            priceEur: typeof c.priceEur === "number" ? c.priceEur : null,
            areaM2: typeof c.areaM2 === "number" ? c.areaM2 : null,
            rooms: typeof c.rooms === "number" ? c.rooms : null,
            pricePerM2: typeof c.pricePerM2 === "number" ? c.pricePerM2 : typeof c.rentPerM2 === "number" ? c.rentPerM2 : null,
            score: typeof c.score === "number" ? c.score : null,
            scope: typeof c.scope === "string" ? c.scope : "",
            state: typeof c.state === "string" ? c.state : null,
            zone: typeof c.zone === "string" ? c.zone : null,
          })).filter((c) => c.url);

          setImportResult({ ...imported, importedUrl: url, comparables });
          setImportStatus("idle");
          setIdealistaUrl("");
        } else if (jobView.status === "failed") {
          clearInterval(pollInterval);
          setImportError(jobView.lastProgressMessage ?? "El análisis ha fallado.");
          setImportStatus("error");
        }
      } catch {
        clearInterval(pollInterval);
        setImportError("Error de red al consultar el estado.");
        setImportStatus("error");
      }
    }, 2000);
  }, [idealistaUrl]);

  return (
    <div className="calculator-layout">
      <div className="calc-inputs">
        <section className="card">
          <div className="card-header">
            <div>
              <span className="section-label">🏠 Inmueble</span>
              <h3 className="card-title">Datos del inmueble</h3>
            </div>
          </div>
          <div className="calc-url-import">
            <label>URL de Idealista</label>
            <div className="calc-url-row">
              <input
                type="url"
                placeholder="https://www.idealista.com/inmueble/..."
                value={idealistaUrl}
                onChange={(e) => setIdealistaUrl(e.target.value)}
                disabled={importStatus !== "idle" && importStatus !== "error"}
              />
              <button
                type="button"
                className="calc-url-btn"
                onClick={handleImportFromUrl}
                disabled={!idealistaUrl.trim() || importStatus === "pinging" || importStatus === "creating-job" || importStatus === "dispatching" || importStatus === "waiting"}
              >
                {importStatus === "pinging" ? "Conectando…" :
                 importStatus === "creating-job" ? "Creando…" :
                 importStatus === "dispatching" ? "Enviando…" :
                 importStatus === "waiting" ? "Analizando…" :
                 "Cargar"}
              </button>
            </div>
            {importError ? <p className="calc-url-error">{importError}</p> : null}
            {importResult ? (
              <div className="calc-import-summary">
                <div className="calc-import-ok">
                  <span>✓ Datos importados de Idealista</span>
                  <div className="calc-import-links">
                    {importResult.importedUrl ? (
                      <a href={importResult.importedUrl} target="_blank" rel="noreferrer noopener" className="calc-import-link">
                        Ver en Idealista ↗
                      </a>
                    ) : null}
                    {importResult.comparables.length > 0 ? (
                      <button type="button" className="calc-import-link" onClick={() => setShowComparables(true)}>
                        Ver comparables
                      </button>
                    ) : null}
                    <button type="button" className="calc-import-link" onClick={() => setShowAddOppModal(true)}>
                      + Seguimiento
                    </button>
                  </div>
                </div>
                <div className="calc-import-grid">
                  {importResult.price ? <><span>Precio</span><strong>{currency(importResult.price)}</strong></> : null}
                  {importResult.rent ? (
                    <><span>Renta estimada</span><strong>
                      {currency(importResult.rent)}/mes
                      {importResult.referenceRent
                        ? ` (idealista/data: ${currency(importResult.referenceRent)}/mes${importResult.referencePricePerM2 ? `, ${importResult.referencePricePerM2} €/m²` : ""}, ${((importResult.rent - importResult.referenceRent) / importResult.referenceRent * 100).toFixed(1)}%)`
                        : importResult.referencePricePerM2
                          ? ` (idealista/data: ${importResult.referencePricePerM2} €/m²)`
                          : ""}
                    </strong></>
                  ) : null}
                  {importResult.community ? <><span>Comunidad</span><strong>{importResult.community}</strong></> : null}
                  {importResult.province ? <><span>Provincia</span><strong>{importResult.province}</strong></> : null}
                  {importResult.area ? <><span>Superficie</span><strong>{fmt(importResult.area)} m²</strong></> : null}
                  {importResult.rooms ? <><span>Habitaciones</span><strong>{importResult.rooms}</strong></> : null}
                  {importResult.propertyType ? <><span>Tipo</span><strong>{importResult.propertyType}</strong></> : null}
                  {importResult.state ? <><span>Estado</span><strong>{importResult.state}</strong></> : null}
                </div>
                {importResult.confidenceSignals ? (
                  <div className="calc-confidence-strip">
                    <span className={`calc-conf-badge calc-conf-${importResult.confidence ?? "low"}`}>
                      {(importResult.confidence ?? "").toUpperCase() || "—"}
                    </span>
                    <span className="calc-conf-stat">
                      Puntuación <strong>{importResult.confidenceSignals.score}</strong>/100
                    </span>
                    <span className="calc-conf-stat">
                      Dispersión <strong>{importResult.confidenceSignals.dispersionLabel}</strong>
                    </span>
                    {importResult.confidenceSignals.outliersRemoved > 0 ? (
                      <span className="calc-conf-stat">
                        Atípicos <strong>{importResult.confidenceSignals.outliersRemoved}</strong>
                      </span>
                    ) : null}
                    {importResult.confidenceSignals.adjustmentFactor != null && importResult.confidenceSignals.adjustmentFactor !== 1 ? (
                      <span className="calc-conf-stat">
                        Ajuste estado <strong>{importResult.confidenceSignals.adjustmentFactor.toFixed(2)}×</strong>
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
            {initialIdealistaUrl && !importResult ? (
              <div className="calc-import-summary">
                <div className="calc-import-ok">
                  <span>📎 Datos desde enlace compartido</span>
                  <div className="calc-import-links">
                    <a href={initialIdealistaUrl} target="_blank" rel="noreferrer noopener" className="calc-import-link">
                      Ver en Idealista ↗
                    </a>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          <div className="calc-field-grid">
            <div className="field">
              <label>Precio de compra (€)</label>
              <NumberInput step="1000" value={input.price} onChange={(v) => patch({ price: v })} />
            </div>
            <div className="field">
              <label>Renta estimada (€/mes)</label>
              <NumberInput value={input.monthlyRent} onChange={(v) => patch({ monthlyRent: v })} />
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <span className="section-label">💰 Adquisición</span>
              <h3 className="card-title">Costes de compra y financiación</h3>
            </div>
          </div>
          <p className="calc-subheading">Gastos de compra (una vez)</p>
          <div className="calc-field-grid">
            <div className="field">
              <label>Comunidad Autónoma (ITP)</label>
              <select value={itpCommunity} onChange={(e) => onItpCommunityChange(e.target.value)}>
                {ITP_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c} ({(getItpRate(c) * 100).toFixed(1)}%)</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Tipo ITP (%)</label>
              <NumberInput step="0.1" value={Math.round(input.itpRate * 1000) / 10} onChange={(v) => patch({ itpRate: v / 100 })} />
            </div>
            <div className="field">
              <label>ITP calculado</label>
              <output className="calc-output">{currency(result.acquisitionCosts.itp)}</output>
            </div>
            <div className="field">
              <label>Notaría + Registro (€)</label>
              <NumberInput step="10" value={input.notaryRegistry} onChange={(v) => patch({ notaryRegistry: v })} />
            </div>
            <div className="field">
              <label>Gastos hipoteca (€)</label>
              <NumberInput step="10" value={input.mortgageFees} onChange={(v) => patch({ mortgageFees: v })} />
            </div>
            <div className="field">
              <label>Comisión compra (€)</label>
              <NumberInput step="10" value={input.purchaseCommission} onChange={(v) => patch({ purchaseCommission: v })} />
            </div>
            <div className="field">
              <label>Mobiliario y otros (€)</label>
              <NumberInput step="10" value={input.furnitureOther} onChange={(v) => patch({ furnitureOther: v })} />
            </div>
            <div className="field">
              <label>Reforma</label>
              <div className="calc-toggle-row">
                <button type="button" className={`calc-toggle ${hasRenovation ? "active" : ""}`} onClick={() => toggleRenovation(true)}>Sí</button>
                <button type="button" className={`calc-toggle ${!hasRenovation ? "active" : ""}`} onClick={() => toggleRenovation(false)}>No</button>
              </div>
            </div>
            {hasRenovation ? (
              <div className="field">
                <label>Coste reforma (€)</label>
                <NumberInput step="10" value={input.renovationCost} onChange={(v) => patch({ renovationCost: v })} />
              </div>
            ) : null}
          </div>
          <hr className="calc-divider" />
          <p className="calc-subheading">Financiación</p>
          <div className="calc-field-grid">
            <div className="field">
              <label>Porcentaje hipotecado (%)</label>
              <NumberInput step="1" value={Math.round(input.loanToValue * 100)} onChange={(v) => patch({ loanToValue: v / 100 })} />
            </div>
            <div className="field">
              <label>Tipo de interés (%)</label>
              <NumberInput step="0.1" value={Math.round(input.interestRate * 1000) / 10} onChange={(v) => patch({ interestRate: v / 100 })} />
            </div>
            <div className="field">
              <label>Plazo (años)</label>
              <NumberInput value={input.mortgageTermYears} onChange={(v) => patch({ mortgageTermYears: v || 1 })} />
            </div>
            <div className="field">
              <label>Capital pendiente</label>
              <output className="calc-output">{currency(result.cashBreakdown.pendingFinancing)}</output>
            </div>
            <div className="field">
              <label>Cuota mensual</label>
              <output className="calc-output">{currency(result.mortgage.monthlyPayment)}</output>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <span className="section-label">📆 Gastos anuales</span>
              <h3 className="card-title">Costes recurrentes</h3>
              <p className="muted">Cada importe anual muestra su equivalencia mensual.</p>
            </div>
          </div>
          <div className="calc-field-grid calc-field-grid-wide">
            <div className="calc-cost-row calc-cost-row-header">
              <span className="calc-cost-label">Concepto</span>
              <span className="calc-cost-annual">Importe anual</span>
              <span className="calc-cost-monthly">Coste/mes</span>
            </div>
            <CalcCostRow label="IBI + Basuras" annual={input.ibiBasuras} onChange={(v) => patch({ ibiBasuras: v })} />
            <CalcCostRow label="Seguros (hogar, vida, impago)" annual={input.insurance} onChange={(v) => patch({ insurance: v })} />
            <CalcCostRow label="Comunidad propietarios" annual={input.community} onChange={(v) => patch({ community: v })} />
            <CalcCostRow label="Mantenimiento" annual={input.maintenance} onChange={(v) => patch({ maintenance: v })} />
            <div className="calc-cost-row">
              <span className="calc-cost-label">Periodos vacío</span>
              <div className="calc-cost-annual">
                <NumberInput
                  min="0"
                  max="12"
                  value={input.vacancyMonths}
                  onChange={(v) => patch({ vacancyMonths: Math.min(12, Math.max(0, v)) })}
                />
                <span className="calc-cost-unit">meses/año</span>
                <span className="calc-cost-annual-result">Coste anual: {currency(result.annualCosts.vacancyLoss)}</span>
              </div>
              <span className="calc-cost-monthly">—</span>
            </div>
          </div>
        </section>
      </div>

      <div className="calc-results">
        <div className="calc-summary-strip">
          <div className="calc-summary-item">
            <span>💵</span>
            <div>
              <span>Necesitas</span>
              <strong>{currency(result.cashBreakdown.totalCashNeeded)}</strong>
            </div>
          </div>
          <div className="calc-summary-item">
            <span>📊</span>
            <div>
              <span>Cash on Cash</span>
              <strong>{percent(result.roi.cashOnCashRoi)}</strong>
            </div>
          </div>
          <div className="calc-summary-item">
            <span>📆</span>
            <div>
              <span>Flujo neto/mes</span>
              <strong>{(result.income.monthlyNetCashFlow >= 0 ? "+" : "") + currency(Math.abs(result.income.monthlyNetCashFlow))}</strong>
            </div>
          </div>
        </div>

        <div className="calc-share-row">
          <button
            type="button"
            className="calc-share-btn"
            onClick={() => {
              const url = buildShareUrl(input, importResult?.importedUrl);
              navigator.clipboard.writeText(url).then(() => {
                setShareCopied(true);
                setTimeout(() => setShareCopied(false), 2000);
              }).catch(() => {
                const input = document.createElement("input");
                input.value = url;
                document.body.appendChild(input);
                input.select();
                document.execCommand("copy");
                document.body.removeChild(input);
                setShareCopied(true);
                setTimeout(() => setShareCopied(false), 2000);
              });
            }}
          >
            {shareCopied ? "✓ URL copiada" : "🔗 Compartir"}
          </button>
        </div>

        <section className="card tone-neutral">
          <div className="card-header">
            <div>
              <span className="section-label">💵 Efectivo necesario</span>
              <h3 className="card-title">Capital total a aportar</h3>
            </div>
          </div>
          <div className="calc-cash-grid">
            <div className="calc-cash-item">
              <span className="calc-cash-label">Entrada ({round(input.loanToValue * 100)}% hipoteca)</span>
              <span className="calc-cash-value">{currency(result.cashBreakdown.downPayment)}</span>
            </div>
            <div className="calc-cash-item">
              <span className="calc-cash-label">Gastos de adquisición</span>
              <span className="calc-cash-value">{currency(result.cashBreakdown.totalAcquisitionCosts)}</span>
            </div>
            <div className="calc-cash-item calc-cash-total">
              <span className="calc-cash-label">TOTAL EFECTIVO NECESARIO</span>
              <span className="calc-cash-value">{currency(result.cashBreakdown.totalCashNeeded)}</span>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <span className="section-label">📊 Rentabilidad</span>
              <h3 className="card-title">Métricas ROI</h3>
            </div>
          </div>
          <div className="calc-roi-grid">
            <RoiCard
              label="ROI Bruto"
              value={result.roi.grossYield}
              target={0.10}
              desc="Renta anual bruta / precio compra"
            />
            <RoiCard
              label="ROI Neto"
              value={result.roi.netYield}
              target={0.07}
              desc="Renta neta anual / precio compra"
            />
            <RoiCard
              label="ROI Cash on Cash"
              value={result.roi.cashOnCashRoi}
              target={0.12}
              desc="Renta neta anual / efectivo aportado"
            />
            <RoiCard
              label="ROI Cash on Cash Neto"
              value={result.roi.cashOnCashNetRoi}
              target={0.07}
              desc="Flujo neto tras hipoteca / efectivo aportado"
            />
          </div>
          <div className="calc-flow-inline-heading">
            <span className="section-label">📋 Flujo de caja mensual</span>
          </div>
          <div className="calc-flow-grid" style={{ marginTop: '10px' }}>
            <div className="calc-flow-item calc-flow-income">
              <span>Ingreso alquiler</span>
              <strong>{currency(input.monthlyRent)}</strong>
            </div>
            <div className="calc-flow-item calc-flow-out">
              <span>Cuota hipoteca</span>
              <strong>-{currency(result.monthlyCosts.mortgage)}</strong>
            </div>
            <div className="calc-flow-item calc-flow-out">
              <span>Gastos operativos</span>
              <strong>-{currency(result.monthlyCosts.operating)}</strong>
            </div>
            <div className={`calc-flow-item calc-flow-total ${result.income.monthlyNetCashFlow >= 0 ? "calc-flow-positive" : "calc-flow-negative"}`}>
              <span>Flujo neto mensual</span>
              <strong>{result.income.monthlyNetCashFlow >= 0 ? "" : "-"}{currency(Math.abs(result.income.monthlyNetCashFlow))}</strong>
            </div>
          </div>

          {targetPrice || targetRent ? (
            <div className="calc-target-section">
              <span className="section-label">🎯 Objetivo 7% C2C Neto</span>
              <div className="calc-target-grid">
                {targetPrice ? (
                  <div className="calc-target-row">
                    <span>Precio de compra ideal</span>
                    <strong>{currency(targetPrice.targetPrice)}</strong>
                    <span>{targetPrice.roi !== null ? percent(targetPrice.roi) : "—"}</span>
                  </div>
                ) : null}
                {targetRent ? (
                  <div className="calc-target-row">
                    <span>Renta de alquiler ideal</span>
                    <strong>{currency(targetRent.targetRent)}/mes</strong>
                    <span>{targetRent.roi !== null ? percent(targetRent.roi) : "—"}</span>
                  </div>
                ) : null}
              </div>
              <p className="muted calc-target-footnote">
                Valores para alcanzar 7% C2C neto con los mismos gastos y financiación.
              </p>
            </div>
          ) : null}
        </section>
      </div>

      {!importResult ? (
        <section className="card calc-comps-placeholder">
          <p className="muted" style={{ textAlign: "center", padding: "2rem 1rem" }}>
            Pega una URL de Idealista arriba y analízala para ver los comparables de alquiler usados en el cálculo.
          </p>
        </section>
      ) : importResult.comparables.length === 0 ? (
        <section className="card calc-comps-placeholder">
          <p className="muted" style={{ textAlign: "center", padding: "2rem 1rem" }}>
            No se encontraron comparables de alquiler para esta propiedad.
          </p>
        </section>
      ) : null}

      {showComparables && importResult?.comparables ? (
        <div className="modal-overlay" onClick={() => setShowComparables(false)}>
          <div className="modal-card calc-comps-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Comparables utilizados ({importResult.comparables.length})</h3>
              <button type="button" className="modal-close" onClick={() => setShowComparables(false)}>✕</button>
            </div>
            {importResult.confidenceSignals ? (
              <div className="calc-comps-confidence">
                <div className="calc-comps-conf-row">
                  <span className={`calc-comps-conf-score ${importResult.confidenceSignals.score >= 70 ? "score-high" : importResult.confidenceSignals.score >= 40 ? "score-mid" : "score-low"}`}>
                    {importResult.confidenceSignals.score}
                  </span>
                  <div className="calc-comps-conf-details">
                    <span className="calc-comps-conf-label">
                      Confianza {(importResult.confidence ?? "").toUpperCase()} · {importResult.confidenceSignals.dispersionLabel} dispersión
                    </span>
                    <span className="calc-comps-conf-note">
                      {importResult.confidenceSignals.comparablesAfterOutlierRemoval} comparables tras eliminar {importResult.confidenceSignals.outliersRemoved} atípicos
                      {importResult.confidenceSignals.stateAdjusted && importResult.confidenceSignals.adjustmentFactor != null
                        ? ` · ajuste estado ×${importResult.confidenceSignals.adjustmentFactor.toFixed(2)}`
                        : ""}
                      {importResult.method ? ` · ${importResult.method}` : ""}
                    </span>
                  </div>
                </div>
                {importResult.lowEur != null && importResult.highEur != null ? (
                  <div className="calc-comps-conf-range">
                    Rango típico: <strong>{fmt(importResult.lowEur)}–{fmt(importResult.highEur)} €/mes</strong>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="table-shell">
              <table className="calc-comps-table">
                <thead>
                  <tr>
                    <th>Inmueble</th>
                    <th className="calc-comp-num">
                      Punt.
                      <button type="button" className="calc-help-btn" onClick={() => setShowScoreHelp(!showScoreHelp)} aria-label="Explicación de la puntuación">ⓘ</button>
                      {showScoreHelp ? (
                        <div className="calc-tooltip">
                          <strong>Puntuación del comparable</strong> (0–75)
                          <div className="calc-tooltip-row"><span>Ámbito (misma zona)</span><span className="calc-comp-num">40 pts</span></div>
                          <div className="calc-tooltip-row"><span>Habitaciones (exactas)</span><span className="calc-comp-num">15 pts</span></div>
                          <div className="calc-tooltip-row"><span>Superficie (±10%)</span><span className="calc-comp-num">15 pts</span></div>
                          <div className="calc-tooltip-row"><span>Estado (coincide)</span><span className="calc-comp-num">5 pts</span></div>
                          <div className="calc-tooltip-row calc-tooltip-note">Más puntuación = más similar al inmueble objetivo</div>
                        </div>
                      ) : null}
                    </th>
                    <th>Ámbito <button type="button" className="calc-help-btn-inline" aria-label="Qué es ámbito">ⓘ</button></th>
                    <th className="calc-comp-num">Hab.</th>
                    <th className="calc-comp-num">m²</th>
                    <th className="calc-comp-num">€/m²</th>
                  </tr>
                </thead>
                <tbody>
                  {importResult.comparables.map((comp, i) => (
                    <tr key={i}>
                      <td>
                        <a href={comp.url} target="_blank" rel="noreferrer noopener" className="calc-comp-link">
                          {comp.title || "Ver inmueble"}
                        </a>
                      </td>
                      <td className="calc-comp-num">
                        {comp.score != null ? (
                          <span className={`calc-comp-score ${comp.score >= 50 ? "score-high" : comp.score >= 30 ? "score-mid" : "score-low"}`}>
                            {comp.score}
                          </span>
                        ) : <span className="muted">—</span>}
                      </td>
                      <td>{comp.scope ? <span className="calc-comp-scope">{comp.scope}</span> : "—"}</td>
                      <td className="calc-comp-num">{comp.rooms ?? "—"}</td>
                      <td className="calc-comp-num">{comp.areaM2 ? fmt(comp.areaM2) : "—"}</td>
                      <td className="calc-comp-num">{comp.pricePerM2 ? `${comp.pricePerM2}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {showAddOppModal && importResult ? (
        <AddOpportunityModal
          onClose={() => setShowAddOppModal(false)}
          onCreated={() => setShowAddOppModal(false)}
          prefill={{
            listingUrl: importResult.importedUrl,
            title: null,
            priceEur: importResult.price,
            estimatedRentEur: importResult.rent,
            totalCashNeededEur: result.cashBreakdown.totalCashNeeded,
            sqmeters: importResult.area,
            bedrooms: importResult.rooms,
            cashOnCashRoi: result.roi.cashOnCashRoi,
            cashOnCashNetRoi: result.roi.cashOnCashNetRoi,
            grossRoi: result.roi.grossYield,
            netRoi: result.roi.netYield,
          }}
        />
      ) : null}
    </div>
  );
}

function CalcCostRow({ label, annual, onChange }: { label: string; annual: number; onChange: (v: number) => void }) {
  return (
    <div className="calc-cost-row">
      <span className="calc-cost-label">{label}</span>
      <div className="calc-cost-annual">
        <NumberInput step="10" value={annual} onChange={onChange} />
      </div>
      <span className="calc-cost-monthly">{currency(round(annual / 12))}</span>
    </div>
  );
}

function RoiCard({ label, value, target, desc }: { label: string; value: number | null; target: number; desc: string }) {
  const hit = value !== null && Number.isFinite(value) && value >= target;
  return (
    <div className={`calc-roi-card ${toneClass(value, target)}`}>
      <span className="calc-roi-label">{label}</span>
      <strong className="calc-roi-value">{percent(value)}</strong>
      <span className="calc-roi-desc">{desc}</span>
      <span className={`calc-roi-target ${hit ? "target-hit" : "target-miss"}`}>
        {hit ? "✓" : "○"} Objetivo: {percent(target)}
      </span>
    </div>
  );
}
