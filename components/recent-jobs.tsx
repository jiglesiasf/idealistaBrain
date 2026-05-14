import Link from "next/link";
import type { JobSummary } from "@/lib/jobs/contracts";
import { parseIdealistaSearchPills } from "@/lib/idealista/search-filters";
import { StatusBadge } from "@/components/status-badge";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatJobLabel(job: JobSummary) {
  return job.jobType === "listing-analysis" ? "Analisis de vivienda" : "Escaneo de listado";
}

function summarizeStatus(job: JobSummary) {
  if (job.status === "completed") {
    return job.jobType === "listing-analysis"
      ? "Resultado listo para revisar rentabilidad y comparables."
      : "Ranking listo para revisar oportunidades del listado.";
  }

  if (job.status === "failed") {
    return "Este analisis no se pudo completar.";
  }

  if (job.status === "running" || job.status === "dispatching") {
    return "Analisis en marcha en el navegador.";
  }

  return "Pendiente de ejecucion.";
}

function getUrlKindLabel(job: JobSummary) {
  return job.jobType === "listing-analysis" ? "Vivienda" : "Listado";
}

export function RecentJobs({ jobs, compact = false }: { jobs: JobSummary[]; compact?: boolean }) {
  if (jobs.length === 0) {
    return <p className="empty-state">Todavia no hay analisis guardados en esta cuenta.</p>;
  }

  return (
    <div className={`job-list ${compact ? "compact" : ""}`.trim()}>
      {jobs.map((job) => (
        <article key={job.id} className={`job-row ${compact ? "compact" : ""}`.trim()}>
          <div className="job-copy">
            <Link href={`/jobs/${job.id}`}>
              <strong>{formatJobLabel(job)}</strong>
            </Link>
            {!compact ? <p className="job-summary">{summarizeStatus(job)}</p> : null}
            {job.jobType === "zone-scan" ? (
              <div className="job-pill-row">
                {parseIdealistaSearchPills(job.targetUrl, compact ? 2 : 3).map((pill) => (
                  <span key={pill} className="job-search-pill">
                    {pill}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="job-meta">
              <div>
                {getUrlKindLabel(job)} ·{" "}
                <a className="job-url-link" href={job.targetUrl} target="_blank" rel="noreferrer noopener">
                  Abrir en Idealista
                </a>
              </div>
              <div>
                {formatDate(job.createdAt)}
              </div>
            </div>
          </div>
          <StatusBadge status={job.status} />
        </article>
      ))}
    </div>
  );
}
