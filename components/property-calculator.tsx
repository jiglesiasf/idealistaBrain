"use client";

import { useMemo, useState, useCallback } from "react";
import { calculate, calculateTargetPrices } from "@/lib/calculator/engine";
import { ITP_OPTIONS, getItpRate } from "@/lib/calculator/itp";
import type { CalculatorInput, TargetPrices } from "@/lib/calculator/engine";

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

const DEFAULT_INPUT: CalculatorInput = {
  price: 150000,
  monthlyRent: 800,
  itpRate: 0.10,
  notaryRegistry: 800,
  mortgageFees: 500,
  renovationCost: 0,
  purchaseCommission: 0,
  furnitureOther: 0,
  loanToValue: 0.7,
  interestRate: 0.022,
  mortgageTermYears: 25,
  ibiBasuras: 700,
  insurance: 300,
  community: 600,
  maintenance: 500,
  vacancyMonths: 1,
};

export function PropertyCalculator({ initialValues }: { initialValues?: Partial<CalculatorInput> }) {
  const [input, setInput] = useState<CalculatorInput>({ ...DEFAULT_INPUT, ...initialValues });
  const [itpCommunity, setItpCommunity] = useState("Comunidad Valenciana");
  const [hasRenovation, setHasRenovation] = useState(false);
  const [idealistaUrl, setIdealistaUrl] = useState("");
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
  } | null>(null);

  const result = useMemo(() => calculate(input), [input]);
  const targetPrices = useMemo(() => calculateTargetPrices(input), [input]);

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
          } = { price: null, rent: null, community: null, province: null, area: null, rooms: null, propertyType: null, state: null };

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

          setImportResult(imported);
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
                <p className="calc-import-ok">✓ Datos importados de Idealista</p>
                <div className="calc-import-grid">
                  {importResult.price ? <><span>Precio</span><strong>{currency(importResult.price)}</strong></> : null}
                  {importResult.rent ? <><span>Renta estimada</span><strong>{currency(importResult.rent)}/mes</strong></> : null}
                  {importResult.community ? <><span>Comunidad</span><strong>{importResult.community}</strong></> : null}
                  {importResult.province ? <><span>Provincia</span><strong>{importResult.province}</strong></> : null}
                  {importResult.area ? <><span>Superficie</span><strong>{fmt(importResult.area)} m²</strong></> : null}
                  {importResult.rooms ? <><span>Habitaciones</span><strong>{importResult.rooms}</strong></> : null}
                  {importResult.propertyType ? <><span>Tipo</span><strong>{importResult.propertyType}</strong></> : null}
                  {importResult.state ? <><span>Estado</span><strong>{importResult.state}</strong></> : null}
                </div>
              </div>
            ) : null}
          </div>
          <div className="calc-field-grid">
            <div className="field">
              <label>Precio de compra (€)</label>
              <input type="number" value={input.price} onChange={(e) => patch({ price: Number(e.target.value) || 0 })} />
            </div>
            <div className="field">
              <label>Renta estimada (€/mes)</label>
              <input type="number" value={input.monthlyRent} onChange={(e) => patch({ monthlyRent: Number(e.target.value) || 0 })} />
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
              <input type="number" step="0.1" value={input.itpRate * 100} onChange={(e) => patch({ itpRate: (Number(e.target.value) || 0) / 100 })} />
            </div>
            <div className="field">
              <label>ITP calculado</label>
              <output className="calc-output">{currency(result.acquisitionCosts.itp)}</output>
            </div>
            <div className="field">
              <label>Notaría + Registro (€)</label>
              <input type="number" value={input.notaryRegistry} onChange={(e) => patch({ notaryRegistry: Number(e.target.value) || 0 })} />
            </div>
            <div className="field">
              <label>Gastos hipoteca (€)</label>
              <input type="number" value={input.mortgageFees} onChange={(e) => patch({ mortgageFees: Number(e.target.value) || 0 })} />
            </div>
            <div className="field">
              <label>Comisión compra (€)</label>
              <input type="number" value={input.purchaseCommission} onChange={(e) => patch({ purchaseCommission: Number(e.target.value) || 0 })} />
            </div>
            <div className="field">
              <label>Mobiliario y otros (€)</label>
              <input type="number" value={input.furnitureOther} onChange={(e) => patch({ furnitureOther: Number(e.target.value) || 0 })} />
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
                <input type="number" value={input.renovationCost} onChange={(e) => patch({ renovationCost: Number(e.target.value) || 0 })} />
              </div>
            ) : null}
          </div>
          <hr className="calc-divider" />
          <p className="calc-subheading">Financiación</p>
          <div className="calc-field-grid">
            <div className="field">
              <label>Porcentaje hipotecado (%)</label>
              <input type="number" step="1" value={input.loanToValue * 100} onChange={(e) => patch({ loanToValue: (Number(e.target.value) || 0) / 100 })} />
            </div>
            <div className="field">
              <label>Tipo de interés (%)</label>
              <input type="number" step="0.1" value={round(input.interestRate * 1000) / 10} onChange={(e) => patch({ interestRate: (Number(e.target.value) || 0) / 100 })} />
            </div>
            <div className="field">
              <label>Plazo (años)</label>
              <input type="number" value={input.mortgageTermYears} onChange={(e) => patch({ mortgageTermYears: Number(e.target.value) || 1 })} />
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
                <input
                  type="number"
                  min="0"
                  max="12"
                  value={input.vacancyMonths}
                  onChange={(e) => patch({ vacancyMonths: Math.min(12, Math.max(0, Number(e.target.value) || 0)) })}
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
              <span>Cash to Cash</span>
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
              label="ROI Cash to Cash"
              value={result.roi.cashOnCashRoi}
              target={0.12}
              desc="Renta neta anual / efectivo aportado"
            />
            <RoiCard
              label="ROI Cash to Cash Neto"
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

          {targetPrices.for10PercentGross ? (
            <div className="calc-target-section">
              <span className="section-label">🎯 Precio objetivo</span>
              <div className="calc-target-grid">
                <div className="calc-target-row calc-target-header">
                  <span>Objetivo</span>
                  <span>Precio ideal</span>
                  <span>ROI resultante</span>
                </div>
                <div className="calc-target-row">
                  <span>10% ROI Bruto</span>
                  <strong>{currency(targetPrices.for10PercentGross.targetPrice)}</strong>
                  <span>{targetPrices.for10PercentGross.cashOnCashNetRoiAtTarget !== null ? `${percent(targetPrices.for10PercentGross.cashOnCashNetRoiAtTarget)} C2C neto` : "—"}</span>
                </div>
                <div className="calc-target-row">
                  <span>≥7% C2C Neto</span>
                  {targetPrices.for7PercentC2CNet ? (
                    <>
                      <strong>{currency(targetPrices.for7PercentC2CNet.targetPrice)}</strong>
                      <span>{targetPrices.for7PercentC2CNet.grossYieldAtTarget !== null ? `${percent(targetPrices.for7PercentC2CNet.grossYieldAtTarget)} bruto` : "—"}</span>
                    </>
                  ) : (
                    <>
                      <strong>—</strong>
                      <span>No alcanzable</span>
                    </>
                  )}
                </div>
              </div>
              <p className="muted calc-target-footnote">
                Precios estimados para cumplir objetivos con los mismos gastos y financiación.
              </p>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function CalcCostRow({ label, annual, onChange }: { label: string; annual: number; onChange: (v: number) => void }) {
  return (
    <div className="calc-cost-row">
      <span className="calc-cost-label">{label}</span>
      <div className="calc-cost-annual">
        <input type="number" value={annual} onChange={(e) => onChange(Number(e.target.value) || 0)} />
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
