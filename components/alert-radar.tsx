import Link from "next/link";
import type { AlertRadarSummary } from "@/lib/alerts/contracts";
import { StatusBadge } from "@/components/status-badge";

function formatPercent(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : "n/d";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-ES", {
    timeStyle: "short",
  }).format(new Date(value));
}

export function AlertRadar({ summary }: { summary: AlertRadarSummary }) {
  return (
    <section className="card">
      <div className="card-header">
        <div>
          <span className="section-label">🛰️ Radar diario</span>
          <h2 className="card-title">Lo nuevo que merece atención</h2>
          <p className="muted">Una vista rápida de lo que ha entrado hoy desde tus alertas y de si ya se ha convertido en análisis.</p>
        </div>
        <Link href="/runner" className="ghost-button">
          Abrir runner
        </Link>
      </div>

      <div className="kpi-grid compact-kpi-grid">
        <article className="kpi-card compact-kpi-card">
          <span className="kpi-label">Listings nuevos</span>
          <strong className="kpi-value">{summary.newListingsToday}</strong>
        </article>
        <article className="kpi-card compact-kpi-card">
          <span className="kpi-label">Alertas activadas</span>
          <strong className="kpi-value">{summary.searchesTriggeredToday}</strong>
        </article>
        <article className="kpi-card compact-kpi-card">
          <span className="kpi-label">Jobs automáticos</span>
          <strong className="kpi-value">{summary.automaticJobsToday}</strong>
        </article>
      </div>

      {summary.opportunities.length === 0 ? (
        <p className="empty-state">Todavía no han entrado oportunidades nuevas hoy desde las alertas procesadas.</p>
      ) : (
        <div className="alert-radar-list">
          {summary.opportunities.slice(0, 12).map((opportunity) => (
            <article
              key={opportunity.id}
              className={`alert-radar-row ${opportunity.linkedJobStatus === "completed" ? "ready" : ""}`.trim()}
            >
              <div className="alert-radar-copy">
                <strong>{opportunity.title || "Nuevo anuncio detectado"}</strong>
                <div className="job-meta">
                  <div>
                    {opportunity.savedSearchName ? `${opportunity.savedSearchName} · ` : ""}
                    Detectado a las {formatDate(opportunity.createdAt)}
                  </div>
                </div>
                {opportunity.linkedJobStatus === "completed" ? (
                  <div className="alert-radar-metrics">
                    <span className="job-search-pill">C2C {formatPercent(opportunity.cashOnCashRoi)}</span>
                    <span className="job-search-pill">C2C neto {formatPercent(opportunity.cashOnCashNetRoi)}</span>
                    <span className="job-search-pill">ROI neto {formatPercent(opportunity.netRoi)}</span>
                  </div>
                ) : null}
                <div className="alert-radar-actions">
                  <a className="job-url-link" href={opportunity.listingUrl} target="_blank" rel="noreferrer noopener">
                    Abrir en Idealista
                  </a>
                  {opportunity.linkedJobId ? (
                    <Link href={`/jobs/${opportunity.linkedJobId}`} className="job-url-link">
                      Ver análisis
                    </Link>
                  ) : null}
                </div>
              </div>

              <div className="alert-radar-status">
                {opportunity.linkedJobStatus ? (
                  <>
                    {opportunity.linkedJobStatus === "completed" && opportunity.cashOnCashRoi !== null ? (
                      <div className="alert-radar-roi-highlight">C2C {formatPercent(opportunity.cashOnCashRoi)}</div>
                    ) : null}
                    <StatusBadge status={opportunity.linkedJobStatus} />
                  </>
                ) : (
                  <span className="job-search-pill">sin job</span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
