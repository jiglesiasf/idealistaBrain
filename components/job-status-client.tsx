"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CreateJobResponse, JobView } from "@/lib/jobs/contracts";
import { dispatchToCompanion, pingCompanion } from "@/lib/companion/client";
import { parseIdealistaSearchPills } from "@/lib/idealista/search-filters";
import { OpportunityTable } from "@/components/opportunity-table";
import { StatusBadge } from "@/components/status-badge";

function formatCurrency(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value)
    ? new Intl.NumberFormat("es-ES").format(value)
    : "n/d";
}

function formatNumber(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value)
    ? new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(value)
    : "n/d";
}

function formatPercent(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : "n/d";
}

function formatComparableScope(scope?: string | null) {
  if (scope === "zone") {
    return "Misma zona";
  }

  if (scope === "municipality") {
    return "Mismo municipio";
  }

  return "Comparable validado";
}

function getComparableLocation(comparable: Record<string, any>) {
  return [comparable.zone, comparable.municipality, comparable.province]
    .filter((part) => typeof part === "string" && part.trim())
    .join(" · ");
}

function isTerminal(status: JobView["status"]) {
  return status === "completed" || status === "failed";
}

function formatJobType(jobType: JobView["jobType"]) {
  return jobType === "listing-analysis" ? "Analisis de vivienda" : "Escaneo de listado";
}

function formatStage(stage?: string | null) {
  const labels: Record<string, string> = {
    accepted: "aceptado",
    "opening-target": "abriendo objetivo",
    "extracting-context": "leyendo ficha",
    "searching-comparables": "buscando comparables",
    "estimating-rent": "estimando renta",
    "estimating-profitability": "estimando rentabilidad",
    "scanning-zone": "escaneando zona",
    "persisting-result": "guardando resultado",
    queued: "en cola",
  };

  return stage ? labels[stage] ?? stage : "en cola";
}

function formatEventType(eventType: string) {
  const labels: Record<string, string> = {
    accepted: "Aceptado",
    progress: "Progreso",
    completed: "Completado",
    failed: "Fallido",
  };

  return labels[eventType] ?? eventType;
}

function getListingVerdict(profitability: Record<string, any>, estimate: Record<string, any>) {
  const metrics = (profitability?.metrics ?? {}) as Record<string, any>;
  const cashOnCashNetRoi = metrics.cashOnCashNetRoi;
  const cashOnCashRoi = metrics.cashOnCashRoi;
  const netRoi = metrics.netRoi;
  const comparablesUsed = estimate?.comparablesUsed;

  if (!profitability?.ready) {
    return {
      tone: "neutral",
      title: "Datos insuficientes para decidir",
      summary: "Todavia faltan datos fiables de compra o alquiler para emitir un veredicto claro.",
    };
  }

  if (
    (Number.isFinite(cashOnCashNetRoi) && cashOnCashNetRoi >= 0.08) ||
    (Number.isFinite(cashOnCashRoi) && cashOnCashRoi >= 0.12)
  ) {
    return {
      tone: "good",
      title: "Buena oportunidad para revisar en detalle",
      summary: `Los numeros iniciales salen bien y el activo merece una revision manual mas profunda${comparablesUsed ? ` con ${comparablesUsed} comparables utiles` : ""}.`,
    };
  }

  if (
    (Number.isFinite(cashOnCashNetRoi) && cashOnCashNetRoi >= 0.03) ||
    (Number.isFinite(netRoi) && netRoi >= 0.05)
  ) {
    return {
      tone: "warn",
      title: "Oportunidad dudosa, necesita contexto",
      summary: "Puede tener sentido, pero los margenes no son lo bastante claros como para dar un si inmediato.",
    };
  }

  return {
    tone: "bad",
    title: "Poco atractiva con los datos actuales",
    summary: "La rentabilidad calculada sale floja o demasiado justa para considerar una buena oportunidad.",
  };
}

function getZoneVerdict(zoneResult: Record<string, any>, opportunities: Array<Record<string, any>>) {
  const best = opportunities.find((item) => Number.isFinite(item.cashOnCashRoi) || Number.isFinite(item.cashOnCashNetRoi));

  if (!best) {
    return {
      tone: "neutral",
      title: "No he encontrado una oportunidad clara todavia",
      summary: "El escaneo ha terminado, pero no hay suficientes resultados rentables como para destacar una compra obvia.",
      best,
    };
  }

  const bestValue = Number.isFinite(best.cashOnCashNetRoi) ? best.cashOnCashNetRoi : best.cashOnCashRoi;
  const tone =
    Number.isFinite(bestValue) && bestValue >= 0.08
      ? "good"
      : Number.isFinite(bestValue) && bestValue >= 0.03
        ? "warn"
        : "bad";

  return {
    tone,
    title: "El listado si contiene oportunidades para revisar",
    summary: `La mejor opcion encontrada es ${best.title || "un activo del listado"} con ${formatPercent(best.cashOnCashRoi)} de ROI cash on cash.`,
    best,
    analyzedListings: zoneResult?.analyzedListings,
  };
}

function getZoneSourcePage(zoneResult: Record<string, any> | null) {
  const sourcePage = (zoneResult?.sourcePage ?? {}) as Record<string, any>;

  return {
    title:
      (typeof sourcePage.title === "string" && sourcePage.title.trim()) ||
      (typeof zoneResult?.sourceSearchUrl === "string" && zoneResult.sourceSearchUrl.trim()) ||
      "Resultado del escaneo",
    url:
      (typeof sourcePage.url === "string" && sourcePage.url.trim()) ||
      (typeof zoneResult?.sourceSearchUrl === "string" && zoneResult.sourceSearchUrl.trim()) ||
      null,
  };
}

function getResultTitle(job: JobView, listingResult: Record<string, any> | null, zoneResult: Record<string, any> | null) {
  if (job.jobType === "listing-analysis") {
    return (
      listingResult?.subject?.page?.title ||
      listingResult?.subject?.targetAsset?.address ||
      "Resultado de vivienda"
    );
  }

  return getZoneSourcePage(zoneResult).title;
}

function getResultLocation(listingResult: Record<string, any> | null) {
  const asset = listingResult?.subject?.targetAsset ?? {};
  return [asset.zone, asset.municipality, asset.province].filter(Boolean).join(" · ");
}

function getPrimaryIdealistaUrl(job: JobView, listingResult: Record<string, any> | null, zoneResult: Record<string, any> | null) {
  if (job.jobType === "listing-analysis") {
    return listingResult?.subject?.page?.canonicalUrl || job.targetUrl;
  }

  return getZoneSourcePage(zoneResult).url || job.targetUrl;
}

function getProcessSummary(job: JobView) {
  if (job.status === "failed") {
    return job.lastProgressMessage || "Este analisis no se ha podido completar.";
  }

  if (job.status === "completed") {
    return "Resultado guardado y listo para revisar.";
  }

  return job.lastProgressMessage || "El analisis sigue ejecutandose en el navegador.";
}

function getJobStatusCopy(job: JobView) {
  if (job.status === "completed") {
    return "Resultado listo";
  }

  if (job.status === "failed") {
    return "Analisis interrumpido";
  }

  return "Analisis en curso";
}

export function JobStatusClient({
  initialJob,
  dispatchFailed,
}: {
  initialJob: JobView;
  dispatchFailed: boolean;
}) {
  const router = useRouter();
  const [job, setJob] = useState(initialJob);
  const [isRerunning, startRerunTransition] = useTransition();
  const [rerunStatusLine, setRerunStatusLine] = useState("");
  const [rerunStatusTone, setRerunStatusTone] = useState<"" | "error" | "success">("");

  useEffect(() => {
    if (isTerminal(job.status)) {
      return;
    }

    const intervalId = window.setInterval(async () => {
      const response = await fetch(`/api/jobs/${job.id}`, {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as { job: JobView };
      setJob(payload.job);
    }, 2500);

    return () => window.clearInterval(intervalId);
  }, [job.id, job.status]);

  const listingResult = job.result?.type === "listing-analysis" ? job.result.payload : null;
  const zoneResult = job.result?.type === "zone-scan" ? job.result.payload : null;
  const profitability = (listingResult?.profitability ?? {}) as Record<string, any>;
  const estimate = (listingResult?.estimate ?? {}) as Record<string, any>;
  const listingComparables = Array.isArray(listingResult?.comparables)
    ? [...(listingResult.comparables as Array<Record<string, any>>)]
        .filter((item) => Number.isFinite(item?.priceEur))
        .sort((left, right) => {
          const leftScore = Number.isFinite(left?.score) ? left.score : -Infinity;
          const rightScore = Number.isFinite(right?.score) ? right.score : -Infinity;
          return rightScore - leftScore;
        })
    : [];
  const listingMetrics = (profitability?.metrics ?? {}) as Record<string, any>;
  const listingInputs = (profitability?.inputs ?? {}) as Record<string, any>;
  const listingFinancing = (profitability?.financing ?? {}) as Record<string, any>;
  const opportunities = Array.isArray(zoneResult?.opportunities) ? (zoneResult.opportunities as Array<Record<string, any>>) : [];
  const progressValue = Number.isFinite(job.progress) ? Math.max(5, job.progress ?? 0) : job.status === "completed" ? 100 : 12;
  const listingVerdict = listingResult ? getListingVerdict(profitability, estimate) : null;
  const zoneVerdict = zoneResult ? getZoneVerdict(zoneResult, opportunities) : null;
  const resultTitle = getResultTitle(job, listingResult, zoneResult);
  const resultLocation = getResultLocation(listingResult);
  const primaryIdealistaUrl = getPrimaryIdealistaUrl(job, listingResult, zoneResult);
  const zoneSourcePage = getZoneSourcePage(zoneResult);
  const zoneSearchPills = parseIdealistaSearchPills(zoneSourcePage.url);
  const estimateMethod = typeof estimate.method === "string" ? estimate.method.replace(/\.$/, "") : "";
  const estimateRangeCopy =
    Number.isFinite(estimate.lowEur) && Number.isFinite(estimate.highEur)
      ? `${formatCurrency(estimate.lowEur)}-${formatCurrency(estimate.highEur)} €/mes`
      : null;

  const handleRerun = () => {
    setRerunStatusLine("");
    setRerunStatusTone("");

    startRerunTransition(async () => {
      try {
        setRerunStatusLine("Comprobando la extension del navegador.");
        const companionReady = await pingCompanion();

        if (!companionReady.ok) {
          setRerunStatusLine(companionReady.error ?? "No he podido contactar con el companion.");
          setRerunStatusTone("error");
          return;
        }

        const response = await fetch("/api/jobs", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            targetUrl: job.targetUrl,
            mode: job.jobType,
          }),
        });

        const payload = (await response.json()) as CreateJobResponse | { error?: string };

        if (response.status === 401) {
          router.push("/login");
          return;
        }

        if (!response.ok || !("job" in payload) || !("dispatch" in payload)) {
          throw new Error("error" in payload ? payload.error ?? "No se ha podido relanzar el analisis." : "No se ha podido relanzar el analisis.");
        }

        setRerunStatusLine("Analisis preparado. Lanzandolo en la extension.");
        const dispatchResult = await dispatchToCompanion(payload.dispatch);

        if (!dispatchResult.ok) {
          setRerunStatusLine(`El analisis se ha creado, pero no he podido contactar con la extension: ${dispatchResult.error}`);
          setRerunStatusTone("error");
          router.push(`/jobs/${payload.job.id}?dispatch=failed`);
          return;
        }

        setRerunStatusLine("Nuevo analisis lanzado correctamente.");
        setRerunStatusTone("success");
        router.push(`/jobs/${payload.job.id}`);
      } catch (error) {
        setRerunStatusLine(error instanceof Error ? error.message : "Error inesperado al relanzar el analisis.");
        setRerunStatusTone("error");
      }
    });
  };

  return (
    <div className="stack">
      {dispatchFailed ? (
        <div className="notice">
          <strong>El analisis se creó, pero no he podido entregárselo a la extensión.</strong>
          <ul>
            <li>Verifica que la extensión esté instalada y habilitada.</li>
            <li>Comprueba que el navegador sea el mismo donde está instalado el companion.</li>
            <li>Si la extensión no recibe el análisis, el estado puede quedarse en cola.</li>
          </ul>
        </div>
      ) : null}

      {!zoneResult ? (
        <section className="card">
          <div className="card-header">
            <div>
              <span className="section-label">{formatJobType(job.jobType)}</span>
              <h2 className="card-title">{resultTitle}</h2>
              <p className="muted">{resultLocation || job.targetUrl}</p>
            </div>
            <div className="header-actions">
              <button className="primary-button" type="button" onClick={handleRerun} disabled={isRerunning}>
                {isRerunning ? "Relanzando..." : "Volver a ejecutar"}
              </button>
              <a className="ghost-button" href={primaryIdealistaUrl} target="_blank" rel="noreferrer noopener">
                Abrir en Idealista
              </a>
              <StatusBadge status={job.status} />
            </div>
          </div>

          <div className="kpi-grid compact-kpi-grid">
            <article className="kpi-card compact-kpi-card">
              <span className="kpi-label">Estado</span>
              <strong className="kpi-value">{getJobStatusCopy(job)}</strong>
            </article>
            <article className="kpi-card compact-kpi-card">
              <span className="kpi-label">Fase actual</span>
              <strong className="kpi-value">{formatStage(job.lastProgressStage)}</strong>
            </article>
          </div>

          <div className="progress-shell">
            <div className="progress-bar" style={{ width: `${progressValue}%` }} />
          </div>

          <p className="muted compact-process-copy" style={{ marginTop: 14 }}>{getProcessSummary(job)}</p>
          {rerunStatusLine ? <p className={`status-line ${rerunStatusTone}`.trim()}>{rerunStatusLine}</p> : null}
        </section>
      ) : null}

      {listingResult ? (
        <section className={`decision-hero ${listingVerdict?.tone || "neutral"}`}>
          <div className="decision-hero-copy">
            <span className="section-label">✨ Veredicto</span>
            <h3>{listingVerdict?.title}</h3>
            <p>{listingVerdict?.summary}</p>
          </div>

          <div className="decision-roi-grid">
            <article className="decision-roi-card">
              <span>ROI cash on cash</span>
              <strong>{formatPercent(listingMetrics.cashOnCashRoi)}</strong>
            </article>
            <article className="decision-roi-card">
              <span>ROI cash on cash neto</span>
              <strong>{formatPercent(listingMetrics.cashOnCashNetRoi)}</strong>
            </article>
            <article className="decision-roi-card">
              <span>ROI bruto</span>
              <strong>{formatPercent(listingMetrics.grossRoi)}</strong>
            </article>
            <article className="decision-roi-card">
              <span>ROI neto</span>
              <strong>{formatPercent(listingMetrics.netRoi)}</strong>
            </article>
          </div>
        </section>
      ) : null}

      {listingResult ? (
        <section className="card">
          <div className="card-header">
            <div>
              <span className="section-label">🧠 Lectura rápida</span>
              <h3 className="card-title">Lo que necesitas para tomar la decisión</h3>
            </div>
          </div>

          <div className="decision-facts-grid">
            <article className="decision-fact-card">
              <span>Precio de compra</span>
              <strong>{Number.isFinite(listingInputs.purchasePriceEur) ? `${formatCurrency(listingInputs.purchasePriceEur)} €` : "n/d"}</strong>
            </article>
            <article className="decision-fact-card">
              <span>Renta estimada</span>
              <strong>{Number.isFinite(estimate.monthlyRentEur) ? `${formatCurrency(estimate.monthlyRentEur)} €/mes` : "n/d"}</strong>
            </article>
            <article className="decision-fact-card">
              <span>Comparables usados</span>
              <strong>{estimate.comparablesUsed ?? "n/d"}</strong>
            </article>
            <article className="decision-fact-card">
              <span>Caja aportada</span>
              <strong>{Number.isFinite(listingInputs.cashInvestedEur) ? `${formatCurrency(listingInputs.cashInvestedEur)} €` : "n/d"}</strong>
            </article>
            <article className="decision-fact-card">
              <span>Hipoteca mensual</span>
              <strong>{Number.isFinite(listingFinancing.monthlyMortgagePaymentEur) ? `${formatCurrency(listingFinancing.monthlyMortgagePaymentEur)} €/mes` : "n/d"}</strong>
            </article>
            <article className="decision-fact-card">
              <span>Confianza del alquiler</span>
              <strong>{estimate.confidence || "n/d"}</strong>
            </article>
          </div>

          {Array.isArray(profitability?.notes) && profitability.notes.length > 0 ? (
            <div className="insight-list">
              {profitability.notes.slice(0, 3).map((note: string) => (
                <article key={note} className="insight-card">
                  <strong>Nota importante</strong>
                  <p>{note}</p>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {listingResult ? (
        <section className="card">
          <div className="card-header">
            <div>
              <span className="section-label">🏠 Comparables usados</span>
              <h3 className="card-title">Alquileres utilizados para calcular la renta</h3>
              <p className="muted">
                {listingComparables.length > 0
                  ? `Estos son los ${listingComparables.length} alquileres que han entrado en el calculo${estimateMethod ? ` · ${estimateMethod}` : ""}${estimateRangeCopy ? ` · rango ${estimateRangeCopy}` : ""}.`
                  : estimateMethod
                    ? `${estimateMethod}.`
                    : "No se han encontrado alquileres validos para sustentar la estimacion."}
              </p>
            </div>
          </div>

          {listingComparables.length > 0 ? (
            <div className="comparable-grid">
              {listingComparables.map((comparable: Record<string, any>, index: number) => {
                const location = getComparableLocation(comparable);
                const contextLine = [location, comparable.state].filter(Boolean).join(" · ");

                return (
                  <article key={`${comparable.listingId || comparable.url || index}`} className="comparable-card">
                    <div className="comparable-card-top">
                      <div className="comparable-card-copy">
                        <div className="comparable-pill-row">
                          <span className="comparable-pill">{formatComparableScope(comparable.scope)}</span>
                        </div>
                        <h4>{comparable.title || `Alquiler comparable ${index + 1}`}</h4>
                        <p>{contextLine || "Ubicacion no disponible"}</p>
                      </div>

                      {comparable.url ? (
                        <a className="ghost-button compact-button" href={comparable.url} target="_blank" rel="noreferrer noopener">
                          Ver alquiler
                        </a>
                      ) : null}
                    </div>

                    <div className="comparable-metric-grid">
                      <article className="comparable-metric">
                        <span>Renta</span>
                        <strong>{Number.isFinite(comparable.priceEur) ? `${formatCurrency(comparable.priceEur)} €/mes` : "n/d"}</strong>
                      </article>
                      <article className="comparable-metric">
                        <span>€/m²</span>
                        <strong>{Number.isFinite(comparable.rentPerM2) ? `${formatNumber(comparable.rentPerM2)} €/m²` : "n/d"}</strong>
                      </article>
                      <article className="comparable-metric">
                        <span>Superficie</span>
                        <strong>{Number.isFinite(comparable.areaM2) ? `${formatNumber(comparable.areaM2)} m²` : "n/d"}</strong>
                      </article>
                      <article className="comparable-metric">
                        <span>Habitaciones</span>
                        <strong>{Number.isFinite(comparable.rooms) ? `${formatNumber(comparable.rooms)}` : "n/d"}</strong>
                      </article>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="empty-state">Todavia no hay anuncios de alquiler validos disponibles en este analisis.</p>
          )}
        </section>
      ) : null}

      {zoneResult ? (
        <section className={`decision-hero compact scan-overview-shell ${zoneVerdict?.tone || "neutral"}`}>
          <div className="card-header">
            <div className="scan-overview-copy">
              <span className="section-label">{formatJobType(job.jobType)}</span>
              <h2 className="card-title">{resultTitle}</h2>
              <p className="muted">{zoneSourcePage.url || job.targetUrl}</p>
            </div>
            <div className="header-actions">
              <button className="primary-button" type="button" onClick={handleRerun} disabled={isRerunning}>
                {isRerunning ? "Relanzando..." : "Volver a ejecutar"}
              </button>
              {zoneSourcePage.url ? (
                <a className="ghost-button" href={zoneSourcePage.url} target="_blank" rel="noreferrer noopener">
                  Abrir en Idealista
                </a>
              ) : null}
              <StatusBadge status={job.status} />
            </div>
          </div>

          <div className="scan-status-grid">
            <article className="decision-fact-card compact">
              <span>Estado</span>
              <strong>{getJobStatusCopy(job)}</strong>
            </article>
            <article className="decision-fact-card compact">
              <span>Fase actual</span>
              <strong>{formatStage(job.lastProgressStage)}</strong>
            </article>
          </div>

          <div className="progress-shell">
            <div className="progress-bar" style={{ width: `${progressValue}%` }} />
          </div>

          <p className="muted compact-process-copy">{getProcessSummary(job)}</p>
          {rerunStatusLine ? <p className={`status-line ${rerunStatusTone}`.trim()}>{rerunStatusLine}</p> : null}

          <div className="scan-summary-block">
            <div className="decision-hero-copy">
              <span className="section-label">📍 Resumen del listado</span>
              <h3>{zoneVerdict?.title}</h3>
              <p>{zoneVerdict?.summary}</p>
              {zoneSearchPills.length > 0 ? (
                <div className="search-pill-row">
                  {zoneSearchPills.map((pill) => (
                    <span key={pill} className="search-pill">
                      {pill}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="decision-facts-grid compact">
              <article className="decision-fact-card compact">
                <span>Anuncios detectados</span>
                <strong>{(zoneResult.totalListingsDetected as number) ?? "n/d"}</strong>
              </article>
              <article className="decision-fact-card compact">
                <span>Anuncios analizados</span>
                <strong>{(zoneResult.analyzedListings as number) ?? "n/d"}</strong>
              </article>
              <article className="decision-fact-card compact">
                <span>Fallos al analizar</span>
                <strong>{Array.isArray(zoneResult.failures) ? zoneResult.failures.length : 0}</strong>
              </article>
              <article className="decision-fact-card compact">
                <span>Oportunidades rankeadas</span>
                <strong>{opportunities.length}</strong>
              </article>
              <article className="decision-fact-card compact">
                <span>Mejor ROI C2C</span>
                <strong>{zoneVerdict?.best ? formatPercent(zoneVerdict.best.cashOnCashRoi) : "n/d"}</strong>
              </article>
            </div>
          </div>
        </section>
      ) : null}

      {zoneResult && zoneVerdict?.best ? (
        <section className="card">
          <div className="card-header">
            <div>
              <span className="section-label">🏆 Mejor oportunidad detectada</span>
              <h3 className="card-title">{zoneVerdict.best.title || "Activo destacado"}</h3>
              <p className="muted">
                {zoneVerdict.best.priceEur ? `${formatCurrency(zoneVerdict.best.priceEur)} € compra` : "Compra n/d"}
                {zoneVerdict.best.estimatedRentEur ? ` · ${formatCurrency(zoneVerdict.best.estimatedRentEur)} €/mes` : ""}
              </p>
            </div>
            {zoneVerdict.best.url ? (
              <a className="ghost-button" href={zoneVerdict.best.url} target="_blank" rel="noreferrer noopener">
                Ver ficha
              </a>
            ) : null}
          </div>

          <div className="decision-roi-grid">
            <article className="decision-roi-card">
              <span>ROI cash on cash</span>
              <strong>{formatPercent(zoneVerdict.best.cashOnCashRoi)}</strong>
            </article>
            <article className="decision-roi-card">
              <span>ROI cash on cash neto</span>
              <strong>{formatPercent(zoneVerdict.best.cashOnCashNetRoi)}</strong>
            </article>
            <article className="decision-roi-card">
              <span>ROI bruto</span>
              <strong>{formatPercent(zoneVerdict.best.grossRoi)}</strong>
            </article>
            <article className="decision-roi-card">
              <span>ROI neto</span>
              <strong>{formatPercent(zoneVerdict.best.netRoi)}</strong>
            </article>
          </div>
        </section>
      ) : null}

      {zoneResult ? (
        <section className="card">
          <div className="card-header">
            <div>
              <span className="section-label">📊 Ranking</span>
              <h3 className="card-title">Oportunidades dentro del listado</h3>
              <p className="muted">Ordena y compara las viviendas mejor posicionadas para revisar cuáles merecen atención.</p>
            </div>
          </div>

          <OpportunityTable opportunities={opportunities} />
        </section>
      ) : null}

      {zoneResult && Array.isArray(zoneResult.failures) && zoneResult.failures.length > 0 ? (
        <section className="card">
          <div className="card-header">
            <div>
              <span className="section-label">⚠️ Incidencias</span>
              <h3 className="card-title">Anuncios que no se pudieron analizar</h3>
              <p className="muted">No bloquean el ranking, pero conviene revisarlos si quieres cobertura máxima de la búsqueda.</p>
            </div>
          </div>

          <div className="failure-list">
            {zoneResult.failures.map((failure: Record<string, any>, index: number) => (
              <article key={`${failure.listingId || failure.url || index}`} className="failure-row">
                <div className="failure-copy">
                  <strong>{failure.title || `Anuncio ${index + 1}`}</strong>
                  <p>{failure.reason || "No se pudo completar el analisis de este anuncio."}</p>
                </div>
                {failure.url ? (
                  <a className="ghost-button" href={failure.url} target="_blank" rel="noreferrer noopener">
                    Ver anuncio
                  </a>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <details className="details-shell">
        <summary>Ver seguimiento técnico del análisis</summary>

        <section className="timeline" style={{ marginTop: 16 }}>
          <div className="card-header">
            <div>
              <span className="section-label">Timeline</span>
              <h3 className="card-title">Eventos del análisis</h3>
            </div>
          </div>

          {job.events.length === 0 ? (
            <p className="empty-state">Todavia no hay eventos registrados para este análisis.</p>
          ) : (
            job.events.map((event) => (
              <div key={event.id} className="timeline-item">
                <strong>{formatEventType(event.eventType)}</strong>
                <span className="muted">{new Date(event.createdAt).toLocaleString("es-ES")}</span>
                <span className="muted">{JSON.stringify(event.payload)}</span>
              </div>
            ))
          )}
        </section>

        {(listingResult || zoneResult) ? (
          <div className="json-shell">
            <pre>{JSON.stringify(listingResult ?? zoneResult, null, 2)}</pre>
          </div>
        ) : null}
      </details>
    </div>
  );
}
