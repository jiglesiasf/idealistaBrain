"use client";

import { useState, useTransition } from "react";

type InboxPollResult = {
  scanned: number;
  inserted: number;
  duplicates: number;
  ignored: number;
};

type InboxProcessResult = {
  messagesProcessed: number;
  eventsCreated: number;
  listingsExtracted: number;
  newListings: number;
  jobsCreated: number;
  failed: number;
};

export function InboxPollCard() {
  const [isPending, startTransition] = useTransition();
  const [statusLine, setStatusLine] = useState("");
  const [statusTone, setStatusTone] = useState<"" | "error" | "success">("");
  const [result, setResult] = useState<InboxPollResult | null>(null);
  const [processResult, setProcessResult] = useState<InboxProcessResult | null>(null);

  const handlePoll = () => {
    setStatusLine("");
    setStatusTone("");

    startTransition(async () => {
      try {
        setStatusLine("Leyendo el inbox de alertas.");
        setResult(null);

        const response = await fetch("/api/inbox/poll", {
          method: "POST",
        });

        const payload = (await response.json()) as { result?: InboxPollResult; error?: string };

        if (!response.ok || !payload.result) {
          throw new Error(payload.error ?? "No se ha podido leer el inbox de alertas.");
        }

        setResult(payload.result);
        setStatusLine("Inbox procesado correctamente.");
        setStatusTone("success");
      } catch (error) {
        setStatusLine(error instanceof Error ? error.message : "Error inesperado al leer el inbox.");
        setStatusTone("error");
      }
    });
  };

  const handleProcess = () => {
    setStatusLine("");
    setStatusTone("");

    startTransition(async () => {
      try {
        setStatusLine("Procesando emails pendientes de Idealista.");
        setProcessResult(null);

        const response = await fetch("/api/inbox/process", {
          method: "POST",
        });

        const payload = (await response.json()) as { result?: InboxProcessResult; error?: string };

        if (!response.ok || !payload.result) {
          throw new Error(payload.error ?? "No se han podido procesar los emails pendientes.");
        }

        setProcessResult(payload.result);
        setStatusLine("Emails procesados correctamente.");
        setStatusTone("success");
      } catch (error) {
        setStatusLine(error instanceof Error ? error.message : "Error inesperado al procesar el inbox.");
        setStatusTone("error");
      }
    });
  };

  return (
    <section className="card">
      <div className="card-header">
        <div>
          <span className="section-label">📬 Alertas</span>
          <h3 className="card-title">Leer inbox de Idealista</h3>
          <p className="muted">Haz una lectura manual del buzón dedicado para confirmar que los emails entran en el sistema.</p>
        </div>
      </div>

      <div className="action-row">
        <button className="primary-button" type="button" onClick={handlePoll} disabled={isPending}>
          {isPending ? "Leyendo inbox..." : "Leer inbox ahora"}
        </button>
        <button className="ghost-button" type="button" onClick={handleProcess} disabled={isPending}>
          {isPending ? "Procesando..." : "Procesar emails pendientes"}
        </button>
      </div>

      {statusLine ? <p className={`status-line ${statusTone}`.trim()}>{statusLine}</p> : null}

      {result ? (
        <div className="inbox-poll-grid">
          <article className="kpi-card compact-kpi-card">
            <span className="kpi-label">Emails leidos</span>
            <strong className="kpi-value">{result.scanned}</strong>
          </article>
          <article className="kpi-card compact-kpi-card">
            <span className="kpi-label">Insertados</span>
            <strong className="kpi-value">{result.inserted}</strong>
          </article>
          <article className="kpi-card compact-kpi-card">
            <span className="kpi-label">Duplicados</span>
            <strong className="kpi-value">{result.duplicates}</strong>
          </article>
          <article className="kpi-card compact-kpi-card">
            <span className="kpi-label">Ignorados</span>
            <strong className="kpi-value">{result.ignored}</strong>
          </article>
        </div>
      ) : null}

      {processResult ? (
        <div className="inbox-poll-grid">
          <article className="kpi-card compact-kpi-card">
            <span className="kpi-label">Emails procesados</span>
            <strong className="kpi-value">{processResult.messagesProcessed}</strong>
          </article>
          <article className="kpi-card compact-kpi-card">
            <span className="kpi-label">Eventos creados</span>
            <strong className="kpi-value">{processResult.eventsCreated}</strong>
          </article>
          <article className="kpi-card compact-kpi-card">
            <span className="kpi-label">Listings extraidos</span>
            <strong className="kpi-value">{processResult.listingsExtracted}</strong>
          </article>
          <article className="kpi-card compact-kpi-card">
            <span className="kpi-label">Listings nuevos</span>
            <strong className="kpi-value">{processResult.newListings}</strong>
          </article>
          <article className="kpi-card compact-kpi-card">
            <span className="kpi-label">Jobs creados</span>
            <strong className="kpi-value">{processResult.jobsCreated}</strong>
          </article>
          <article className="kpi-card compact-kpi-card">
            <span className="kpi-label">Fallidos</span>
            <strong className="kpi-value">{processResult.failed}</strong>
          </article>
        </div>
      ) : null}
    </section>
  );
}
