"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RadarSummary } from "@/lib/alerts/contracts";
import { RadarCard } from "@/components/radar-card";
import { CreateRadarModal } from "@/components/create-radar-modal";
import { dispatchToCompanion, pingCompanion } from "@/lib/companion/client";

type ScanJobResponse = {
  job: { id: string };
  radarId: string;
  dispatch: {
    jobId: string;
    jobType: "listing-analysis" | "zone-scan";
    targetUrl: string;
    executionToken: string;
    backendBaseUrl: string;
    apiBasePath: "/api/companion";
  };
};

export function RadarGrid({ radars: initialRadars }: { radars: RadarSummary[] }) {
  const router = useRouter();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [radars, setRadars] = useState(initialRadars);
  const [scanningId, setScanningId] = useState<string | null>(null);

  const maxRadars = 10;

  const handleScan = async (radar: RadarSummary) => {
    setScanningId(radar.id);

    try {
      const companionReady = await pingCompanion();

      if (!companionReady.ok) {
        alert(companionReady.error ?? "No se puede contactar con la extensión.");
        setScanningId(null);
        return;
      }

      const response = await fetch(`/api/radars/${radar.id}/scan`, {
        method: "POST",
      });

      if (response.status === 401) {
        router.push("/login");
        return;
      }

      if (response.status === 503) {
        alert("El backend no está completamente configurado.");
        setScanningId(null);
        return;
      }

      const payload = (await response.json()) as ScanJobResponse | { error?: string };

      if (!response.ok || !("dispatch" in payload)) {
        throw new Error("error" in payload ? payload.error ?? "Error al iniciar escaneo." : "Error desconocido.");
      }

      const dispatchResult = await dispatchToCompanion(payload.dispatch);

      if (!dispatchResult.ok) {
        alert(`Escaneo creado, pero no se ha podido enviar a la extensión: ${dispatchResult.error}`);
      }

      setRadars((prev) =>
        prev.map((r) =>
          r.id === radar.id
            ? { ...r, lastScanStatus: "scanning" as const, lastScanAt: new Date().toISOString() }
            : r
        )
      );

      router.push(`/jobs/${payload.job.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error inesperado.");
      setRadars((prev) =>
        prev.map((r) =>
          r.id === radar.id
            ? { ...r, lastScanStatus: "failed" as const }
            : r
        )
      );
    } finally {
      setScanningId(null);
    }
  };

  const handleDelete = async (radarId: string) => {
    if (!confirm("¿Eliminar este radar? Las listings asociadas también se borrarán.")) {
      return;
    }

    try {
      const response = await fetch(`/api/radars/${radarId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Error al eliminar.");
      }

      setRadars((prev) => prev.filter((r) => r.id !== radarId));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error inesperado.");
    }
  };

  return (
    <section className="card">
      <div className="card-header">
        <div>
          <span className="section-label">📡 Radars de zona</span>
          <h2 className="card-title">Zonas vigiladas</h2>
          <p className="muted">
            Cada radar vigila una búsqueda de Idealista. Te avisa de nuevas oportunidades y puedes escanear bajo demanda.
          </p>
        </div>

        <button
          className="ghost-button"
          onClick={() => setShowCreateModal(true)}
          disabled={radars.length >= maxRadars}
        >
          {radars.length >= maxRadars ? "Límite alcanzado" : "Añadir radar"}
        </button>
      </div>

      {radars.length === 0 ? (
        <div className="empty-state">
          <p>Todavía no has creado ningún radar.</p>
          <p className="muted">
            Pega una URL de búsqueda de Idealista para empezar a vigilar una zona.
          </p>
          <button className="primary-button" onClick={() => setShowCreateModal(true)}>
            Crear primer radar
          </button>
        </div>
      ) : (
        <div className="radar-grid">
          {radars.map((radar) => (
            <RadarCard
              key={radar.id}
              radar={radar}
              onScan={() => handleScan(radar)}
              onDelete={() => handleDelete(radar.id)}
            />
          ))}
        </div>
      )}

      <CreateRadarModal
        open={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          router.refresh();
        }}
      />
    </section>
  );
}
