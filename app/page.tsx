import Link from "next/link";
import { AnalyzeForm } from "@/components/analyze-form";
import { InboxPollCard } from "@/components/inbox-poll-card";
import { RecentJobs } from "@/components/recent-jobs";
import { listUserJobs } from "@/lib/jobs/service";
import { getCompanionExtensionId, getMissingSupabaseEnvKeys } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const missingEnv = getMissingSupabaseEnvKeys();
  const missingCompanionBackendEnv = getMissingSupabaseEnvKeys({ includeServiceRole: true });
  const extensionId = getCompanionExtensionId();
  let user: { id: string; email?: string | null } | null = null;
  let jobs = [] as Awaited<ReturnType<typeof listUserJobs>>;
  let jobsLoadError: string | null = null;

  if (missingEnv.length === 0) {
    try {
      const supabase = await createClient();
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (currentUser) {
        user = currentUser;
        try {
          jobs = await listUserJobs(supabase, currentUser.id, 6);
        } catch (error) {
          jobsLoadError = error instanceof Error ? error.message : "No he podido cargar el historial de jobs.";
        }
      }
    } catch {
      user = null;
    }
  }

  return (
    <div className="stack">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Analiza oportunidades de compra para alquilar</p>
          <h2>Encuentra la vivienda con mejor rentabilidad posible.</h2>
          <p className="hero-description">
            Pega una URL de Idealista para saber si una vivienda concreta merece la pena, o escanea un listado para
            descubrir si hay alguna buena oportunidad de compra dentro de esa búsqueda.
          </p>

          <div className="hero-actions">
            {user ? (
              <>
                <a href="#job-form" className="primary-button">
                  Empezar analisis
                </a>
                <Link href="/dashboard" className="ghost-button">
                  Ver historial
                </Link>
              </>
            ) : (
              <>
                <Link href="/sign-up" className="primary-button">
                  Crear cuenta
                </Link>
                <Link href="/login" className="ghost-button">
                  Entrar
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="hero-panel">
          <div className="hero-stats">
            <article className="stat-card">
              <span className="stat-label">🏠 Analizar vivienda</span>
              <strong className="stat-value">¿La comprarías?</strong>
            </article>
            <article className="stat-card">
              <span className="stat-label">📍 Escanear listado</span>
              <strong className="stat-value">¿Hay alguna ganga?</strong>
            </article>
            <article className="stat-card">
              <span className="stat-label">📈 Rentabilidad</span>
              <strong className="stat-value">4 ROI claros</strong>
            </article>
            <article className="stat-card">
              <span className="stat-label">🧭 Seguimiento</span>
              <strong className="stat-value">Histórico guardado</strong>
            </article>
          </div>

          <div className="companion-panel">
            <span className="section-label">✨ Qué recibes</span>
            <p className="panel-title">Resultados útiles para decidir mejor.</p>
            <ul className="mini-list">
              <li>Renta estimada a partir de comparables reales.</li>
              <li>ROI cash to cash, cash to cash neto, bruto y neto.</li>
              <li>Ranking de oportunidades cuando trabajas sobre listados completos.</li>
            </ul>
            <p className="fine-print">La parte técnica debe pasar desapercibida. Aquí importa si la oportunidad es buena o no.</p>
          </div>
        </div>
      </section>

      {missingEnv.length > 0 ? (
        <section className="notice">
          <strong>Falta configuracion de Supabase.</strong>
          <ul>
            {missingEnv.map((envKey) => (
              <li key={envKey}>{envKey}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {missingEnv.length === 0 && missingCompanionBackendEnv.includes("SUPABASE_SERVICE_ROLE_KEY") ? (
        <section className="notice">
          <strong>La web ya puede abrirse, pero todavía no puede guardar bien el resultado de los análisis.</strong>
          <p className="muted">
            Falta una clave interna del backend. Hasta que no esté configurada, algunos análisis pueden quedarse
            bloqueados antes de guardar el resultado final.
          </p>
        </section>
      ) : null}

      {!extensionId ? (
        <section className="notice">
          <strong>La extensión del navegador todavía no está conectada con esta web.</strong>
          <p className="muted">
            Sin esa conexión, no podremos lanzar análisis reales desde una URL de Idealista.
          </p>
        </section>
      ) : null}

      {user && jobsLoadError ? (
        <section className="notice">
          <strong>Tu cuenta está bien, pero todavía no puedo enseñarte el histórico completo.</strong>
          <p className="muted">
            El formulario sigue disponible, pero el histórico no ha cargado correctamente en esta sesión.
          </p>
          <p className="muted">{jobsLoadError}</p>
        </section>
      ) : null}

      <section id="job-form" className="card">
        <div className="card-header">
          <div>
            <span className="section-label">🚀 Empezar</span>
            <h3 className="card-title">Lanza un nuevo análisis</h3>
            <p className="muted">Trabaja sobre una vivienda concreta o sobre un listado completo de resultados.</p>
          </div>
        </div>

        {user ? (
          <AnalyzeForm />
        ) : (
          <div className="stack">
            <p className="muted">
              Entra primero para guardar tus análisis, volver a ellos más tarde y construir un histórico útil.
            </p>
            <div className="action-row">
              <Link href="/login" className="ghost-button">
                Entrar
              </Link>
              <Link href="/sign-up" className="primary-button">
                Crear cuenta
              </Link>
            </div>
          </div>
        )}
      </section>

      {user ? <InboxPollCard /> : null}

      <section className="feature-list feature-list-bottom">
        <article className="feature-item">
          <strong className="feature-title">⚡ Decisión rápida</strong>
          <p className="feature-copy">Entiende de un vistazo si una vivienda parece una buena compra para alquilar.</p>
        </article>
        <article className="feature-item">
          <strong className="feature-title">🔎 Oportunidades ocultas</strong>
          <p className="feature-copy">Escanea un listado completo y detecta dónde hay mejores números.</p>
        </article>
        <article className="feature-item">
          <strong className="feature-title">🗂️ Historial útil</strong>
          <p className="feature-copy">Guarda tus análisis para revisar resultados y comparar búsquedas con el tiempo.</p>
        </article>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <span className="section-label">🕘 Historial reciente</span>
            <h3 className="card-title">Tus últimos análisis</h3>
            <p className="muted">Vuelve a una vivienda o a un listado que ya revisaste y continúa desde ahí.</p>
          </div>
          {user ? (
            <Link href="/dashboard" className="ghost-button">
              Ver historial
            </Link>
          ) : null}
        </div>

        {user ? <RecentJobs jobs={jobs} compact /> : <p className="empty-state">Entra para ver jobs y resultados persistidos.</p>}
      </section>
    </div>
  );
}
