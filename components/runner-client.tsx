"use client";

import { useEffect, useRef, useState } from "react";
import type { CreateJobResponse } from "@/lib/jobs/contracts";
import { dispatchToCompanion, getCompanionStatus } from "@/lib/companion/client";

type RunnerState = "checking" | "idle" | "dispatching" | "busy" | "error";

type RunnerDispatchResponse = {
  dispatch: CreateJobResponse["dispatch"] | null;
  error?: string;
};

async function releaseClaim(jobId: string, reason: string) {
  await fetch("/api/runner/release", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jobId,
      reason,
    }),
  });
}

export function RunnerClient() {
  const [state, setState] = useState<RunnerState>("checking");
  const [message, setMessage] = useState("Preparando el runner automatico.");
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobsClaimed, setJobsClaimed] = useState(0);
  const loopBusyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      if (cancelled || loopBusyRef.current) {
        return;
      }

      loopBusyRef.current = true;

      try {
        const companionStatus = await getCompanionStatus();

        if (!companionStatus.ok) {
          if (!cancelled) {
            setState("error");
            setMessage(companionStatus.error ?? "No he podido contactar con el companion.");
            setActiveJobId(null);
          }
          return;
        }

        if (companionStatus.busy) {
          if (!cancelled) {
            setState("busy");
            setActiveJobId(companionStatus.activeJobId ?? activeJobId);
            setMessage(
              companionStatus.activeJobId
                ? `El companion esta ejecutando el job ${companionStatus.activeJobId}.`
                : "El companion esta ocupado ejecutando un job automatico."
            );
          }
          return;
        }

        if (!cancelled) {
          setActiveJobId(null);
        }

        const response = await fetch("/api/runner/claim-next", {
          method: "POST",
        });

        const payload = (await response.json()) as RunnerDispatchResponse;

        if (!response.ok) {
          throw new Error(payload.error ?? "No he podido reclamar el siguiente job automatico.");
        }

        if (!payload.dispatch) {
          if (!cancelled) {
            setState("idle");
            setMessage("No hay jobs automaticos pendientes ahora mismo.");
          }
          return;
        }

        if (!cancelled) {
          setState("dispatching");
          setActiveJobId(payload.dispatch.jobId);
          setMessage(`Enviando al companion el job ${payload.dispatch.jobId}.`);
        }

        const dispatchResult = await dispatchToCompanion(payload.dispatch);

        if (!dispatchResult.ok) {
          await releaseClaim(
            payload.dispatch.jobId,
            `Automatic runner could not dispatch the job to the companion: ${dispatchResult.error ?? "unknown error"}`
          );

          if (!cancelled) {
            setState("error");
            setActiveJobId(null);
            setMessage(dispatchResult.error ?? "El companion no ha aceptado el job automatico.");
          }
          return;
        }

        if (!cancelled) {
          setState("busy");
          setJobsClaimed((value) => value + 1);
          setMessage(`Job ${payload.dispatch.jobId} enviado al companion. Esperando a que termine.`);
        }
      } catch (error) {
        if (!cancelled) {
          setState("error");
          setMessage(error instanceof Error ? error.message : "Error inesperado en el runner.");
        }
      } finally {
        loopBusyRef.current = false;
      }
    };

    void tick();
    const intervalId = window.setInterval(() => {
      void tick();
    }, 6000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeJobId]);

  return (
    <section className="card">
      <div className="card-header">
        <div>
          <span className="section-label">🤖 Runner</span>
          <h2 className="card-title">Despacho automatico de alertas</h2>
          <p className="muted">
            Mantén esta página abierta en Chrome con la extensión habilitada para que los anuncios nuevos se conviertan
            en análisis automáticos.
          </p>
        </div>
      </div>

      <div className="kpi-grid compact-kpi-grid">
        <article className="kpi-card compact-kpi-card">
          <span className="kpi-label">Estado</span>
          <strong className="kpi-value">{state}</strong>
        </article>
        <article className="kpi-card compact-kpi-card">
          <span className="kpi-label">Job activo</span>
          <strong className="kpi-value">{activeJobId ? activeJobId.slice(0, 8) : "ninguno"}</strong>
        </article>
        <article className="kpi-card compact-kpi-card">
          <span className="kpi-label">Jobs lanzados</span>
          <strong className="kpi-value">{jobsClaimed}</strong>
        </article>
      </div>

      <p className={`status-line ${state === "error" ? "error" : state === "busy" || state === "dispatching" ? "success" : ""}`.trim()}>
        {message}
      </p>
    </section>
  );
}
