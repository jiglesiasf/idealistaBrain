import { redirect } from "next/navigation";
import { RecentJobs } from "@/components/recent-jobs";
import { listUserJobs } from "@/lib/jobs/service";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let jobs = [] as Awaited<ReturnType<typeof listUserJobs>>;
  let jobsLoadError: string | null = null;

  try {
    jobs = await listUserJobs(supabase, user.id, 30);
  } catch (error) {
    jobsLoadError = error instanceof Error ? error.message : "No he podido cargar el historial.";
  }

  const completedJobs = jobs.filter((job) => job.status === "completed").length;
  const activeJobs = jobs.filter((job) => job.status === "queued" || job.status === "dispatching" || job.status === "running").length;
  const listingJobs = jobs.filter((job) => job.jobType === "listing-analysis").length;
  const zoneScans = jobs.filter((job) => job.jobType === "zone-scan").length;

  return (
    <div className="stack">
      {jobsLoadError ? (
        <section className="notice">
          <strong>El historial todavía no ha cargado bien.</strong>
          <p className="muted">
            Tu cuenta está bien, pero no he podido recuperar los análisis guardados en esta sesión.
          </p>
          <p className="muted">{jobsLoadError}</p>
        </section>
      ) : null}

      <section className="card">
        <div className="card-header">
          <div>
            <span className="section-label">🗂️ Historial</span>
            <h2 className="card-title">Tus análisis guardados</h2>
            <p className="muted">Todo lo que has revisado para decidir mejor qué vivienda comprar y alquilar.</p>
          </div>
        </div>

        <div className="kpi-grid">
          <article className="kpi-card">
            <span className="kpi-label">Total analizados</span>
            <strong className="kpi-value">{jobs.length}</strong>
          </article>
          <article className="kpi-card">
            <span className="kpi-label">Resultados listos</span>
            <strong className="kpi-value">{completedJobs}</strong>
          </article>
          <article className="kpi-card">
            <span className="kpi-label">Viviendas revisadas</span>
            <strong className="kpi-value">{listingJobs}</strong>
          </article>
          <article className="kpi-card">
            <span className="kpi-label">Listados escaneados</span>
            <strong className="kpi-value">{zoneScans}</strong>
          </article>
        </div>

        <p className="muted dashboard-footnote">
          {activeJobs > 0
            ? `Tienes ${activeJobs} análisis en marcha o pendientes de terminar.`
            : "Ahora mismo no tienes análisis en marcha."}
        </p>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <span className="section-label">🔔 Actividad</span>
            <h2 className="card-title">Últimos análisis</h2>
            <p className="muted">Reabre una vivienda o un listado para revisar el resultado y seguir comparando.</p>
          </div>
        </div>

        <RecentJobs jobs={jobs} />
      </section>
    </div>
  );
}
