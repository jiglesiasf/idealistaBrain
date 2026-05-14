"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { CreateJobResponse, CreateJobMode } from "@/lib/jobs/contracts";
import { dispatchToCompanion, pingCompanion } from "@/lib/companion/client";

function normalizeSubmitError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Error inesperado al crear o enviar el job.";
}

export function AnalyzeForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [targetUrl, setTargetUrl] = useState("");
  const [mode, setMode] = useState<CreateJobMode>("auto-detect");
  const [statusLine, setStatusLine] = useState("");
  const [statusTone, setStatusTone] = useState<"" | "error" | "success">("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusLine("");
    setStatusTone("");

    startTransition(async () => {
      try {
        setStatusLine("Comprobando la extension del navegador.");
        const companionReady = await pingCompanion();

        if (!companionReady.ok) {
          setStatusLine(companionReady.error ?? "No he podido contactar con el companion.");
          setStatusTone("error");
          return;
        }

        const response = await fetch("/api/jobs", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            targetUrl,
            mode,
          }),
        });

        const payload = (await response.json()) as CreateJobResponse | { error?: string };

        if (response.status === 401) {
          router.push("/login");
          return;
        }

        if (!response.ok || !("job" in payload) || !("dispatch" in payload)) {
          throw new Error("error" in payload ? payload.error ?? "No se ha podido crear el job." : "No se ha podido crear el job.");
        }

        setStatusLine("Analisis preparado. Lanzandolo en la extension.");
        const dispatchResult = await dispatchToCompanion(payload.dispatch);

        if (!dispatchResult.ok) {
          setStatusLine(`El analisis se ha creado, pero no he podido contactar con la extension: ${dispatchResult.error}`);
          setStatusTone("error");
          router.push(`/jobs/${payload.job.id}?dispatch=failed`);
          return;
        }

        setStatusLine("Analisis enviado correctamente.");
        setStatusTone("success");
        router.push(`/jobs/${payload.job.id}`);
      } catch (error) {
        setStatusLine(normalizeSubmitError(error));
        setStatusTone("error");
      }
    });
  };

  const resolvedMode = mode === "auto-detect" ? null : mode;
  const isListingMode = resolvedMode === "listing-analysis";
  const isZoneMode = resolvedMode === "zone-scan";
  const placeholder = isZoneMode
    ? "https://www.idealista.com/venta-viviendas/..."
    : "https://www.idealista.com/inmueble/123456789/";
  const submitLabel = isZoneMode ? "Escanear listado" : "Analizar vivienda";

  return (
    <form onSubmit={handleSubmit}>
      <div className="analysis-mode-grid">
        <button
          className={`analysis-mode-card ${isListingMode || !resolvedMode ? "selected" : ""}`.trim()}
          type="button"
          onClick={() => setMode("listing-analysis")}
        >
          <span className="analysis-mode-kicker">🏠 Vivienda individual</span>
          <strong>Quiero saber si merece la pena comprar esta vivienda.</strong>
          <p>Obtén renta estimada, comparables y los 4 ROI para una ficha concreta.</p>
        </button>

        <button
          className={`analysis-mode-card ${isZoneMode ? "selected" : ""}`.trim()}
          type="button"
          onClick={() => setMode("zone-scan")}
        >
          <span className="analysis-mode-kicker">🔎 Listado de resultados</span>
          <strong>Quiero detectar si hay alguna buena oportunidad en este listado.</strong>
          <p>Escanea un search result de venta y devuelve un ranking ordenable de oportunidades.</p>
        </button>
      </div>

      <div className="field-grid">
        <div className="field">
          <label htmlFor="target-url">URL objetivo</label>
          <input
            id="target-url"
            name="target-url"
            type="url"
            required
            value={targetUrl}
            onChange={(event) => setTargetUrl(event.target.value)}
            placeholder={placeholder}
          />
        </div>

        <div className="field">
          <label htmlFor="job-mode">Tipo de analisis</label>
          <select id="job-mode" name="job-mode" value={mode} onChange={(event) => setMode(event.target.value as CreateJobMode)}>
            <option value="auto-detect">Detectarlo por la URL</option>
            <option value="listing-analysis">Analizar vivienda</option>
            <option value="zone-scan">Escanear listado</option>
          </select>
        </div>
      </div>

      <p className="field-helper">
        Usa una ficha individual si quieres evaluar una vivienda concreta, o un listado de venta si quieres descubrir
        oportunidades dentro de una búsqueda.
      </p>

      <div className="action-row">
        <button className="primary-button" type="submit" disabled={isPending}>
          {isPending ? "Preparando analisis..." : submitLabel}
        </button>
        <span className={`status-line ${statusTone}`.trim()}>{statusLine}</span>
      </div>
    </form>
  );
}
