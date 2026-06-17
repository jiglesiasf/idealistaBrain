import Link from "next/link";
import type { RadarSummary } from "@/lib/alerts/contracts";

const STATUS_LABELS: Record<string, string> = {
  idle: "En espera",
  scanning: "Escaneando...",
  completed: "Completado",
  failed: "Error",
};

export function RadarCard({
  radar,
  onScan,
  onDelete,
}: {
  radar: RadarSummary;
  onScan?: () => void;
  onDelete?: () => void;
}) {
  const tone =
    radar.newListingsCount > 0
      ? "tone-green"
      : radar.lastScanStatus === "failed"
        ? "tone-red"
        : "tone-neutral";

  const locationLabel = radar.locationName ?? "Ubicación no detectada";

  return (
    <article className={`opportunity-spotlight-card ${tone}`}>
      <div className="radar-card-header">
        <div className="radar-card-title">
          <strong>{radar.name}</strong>
          <span className="muted">{locationLabel}</span>
        </div>

        <div className="radar-card-badge">
          {radar.newListingsCount > 0 ? (
            <span className="alert-radar-roi-highlight">
              {radar.newListingsCount} nueva{radar.newListingsCount !== 1 ? "s" : ""}
            </span>
          ) : (
            <span className="job-search-pill">Al día</span>
          )}
        </div>
      </div>

      <div className="radar-card-stats">
        <div className="job-meta">
          <span>
            {radar.scanCount > 0
              ? `${radar.scanCount} escaneo${radar.scanCount !== 1 ? "s" : ""}`
              : "Sin escanear"}
          </span>
          {radar.lastScanAt && (
            <span>
              {new Intl.DateTimeFormat("es-ES", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              }).format(new Date(radar.lastScanAt))}
            </span>
          )}
        </div>
      </div>

      <div className="action-row">
        <Link href={`/radars/${radar.id}`} className="ghost-button compact-button">
          Ver detalles
        </Link>

        {onScan && (
          <button
            className="ghost-button compact-button"
            onClick={onScan}
            disabled={radar.lastScanStatus === "scanning"}
          >
            {radar.lastScanStatus === "scanning" ? "Escaneando..." : "Escanear ahora"}
          </button>
        )}

        {onDelete && (
          <button className="danger-button compact-button" onClick={onDelete}>
            Eliminar
          </button>
        )}
      </div>

      {radar.lastScanStatus && radar.lastScanStatus !== "idle" && (
        <p className="radar-card-status">
          {STATUS_LABELS[radar.lastScanStatus] ?? radar.lastScanStatus}
        </p>
      )}
    </article>
  );
}
