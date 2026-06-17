"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { RadarSummary, RadarListingSummary } from "@/lib/alerts/contracts";
import { dispatchToCompanion, pingCompanion } from "@/lib/companion/client";

function formatCurrency(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value)
    ? `${new Intl.NumberFormat("es-ES").format(value)} €`
    : "n/d";
}

function formatPercent(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value)
    ? `${(value * 100).toFixed(1)}%`
    : "n/d";
}

function pricePerSqm(price?: number | null, sqmeters?: number | null) {
  if (price && sqmeters && sqmeters > 0) return formatCurrency(price / sqmeters);
  return "n/d";
}

function calculatorUrl(listing: RadarListingSummary) {
  const params = new URLSearchParams();
  if (listing.priceEur) params.set("price", String(listing.priceEur));
  if (listing.estimatedRentEur) params.set("monthlyRent", String(listing.estimatedRentEur));
  const qs = params.toString();
  return `/calculator${qs ? `?${qs}` : ""}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

type ScanJobResponse = {
  job: { id: string };
  dispatch: {
    jobId: string;
    jobType: "listing-analysis" | "zone-scan";
    targetUrl: string;
    executionToken: string;
    backendBaseUrl: string;
    apiBasePath: "/api/companion";
  };
};

export function RadarDetailClient({
  radar,
  listings,
}: {
  radar: RadarSummary;
  listings: RadarListingSummary[];
}) {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);

  const handleScan = async () => {
    setScanning(true);

    try {
      const companionReady = await pingCompanion();

      if (!companionReady.ok) {
        alert(companionReady.error ?? "No se puede contactar con la extensión.");
        setScanning(false);
        return;
      }

      const response = await fetch(`/api/radars/${radar.id}/scan`, {
        method: "POST",
      });

      if (response.status === 401) {
        router.push("/login");
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

      router.push(`/jobs/${payload.job.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error inesperado.");
      setScanning(false);
    }
  };

  const newListings = listings.filter((l) => l.isNew);
  const scannedListings = listings.filter((l) => l.source === "scan" && !l.isNew);
  const alertListings = listings.filter((l) => l.source === "alert");

  return (
    <div className="stack">
      <section className="card">
        <div className="card-header">
          <div>
            <Link href="/dashboard" className="nav-link">← Dashboard</Link>
            <span className="section-label">📡 Radar de zona</span>
            <h2 className="card-title">{radar.name}</h2>
            <p className="muted">
              {radar.locationName ?? "Ubicación no detectada"}
              {" · "}
              <a
                href={radar.idealistaSearchUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="job-url-link"
              >
                Ver búsqueda en Idealista
              </a>
            </p>
          </div>

          <button
            className="primary-button"
            onClick={handleScan}
            disabled={scanning || radar.lastScanStatus === "scanning"}
          >
            {scanning || radar.lastScanStatus === "scanning" ? "Escaneando..." : "Escanear ahora"}
          </button>
        </div>

        <div className="kpi-grid compact-kpi-grid">
          <article className="kpi-card compact-kpi-card">
            <span className="kpi-label">Nuevas oportunidades</span>
            <strong className="kpi-value">{newListings.length}</strong>
          </article>
          <article className="kpi-card compact-kpi-card">
            <span className="kpi-label">Escaneos realizados</span>
            <strong className="kpi-value">{radar.scanCount}</strong>
          </article>
          <article className="kpi-card compact-kpi-card">
            <span className="kpi-label">Total listings</span>
            <strong className="kpi-value">{listings.length}</strong>
          </article>
          <article className="kpi-card compact-kpi-card">
            <span className="kpi-label">Último escaneo</span>
            <strong className="kpi-value">
              {radar.lastScanAt ? formatDate(radar.lastScanAt) : "Nunca"}
            </strong>
          </article>
        </div>
      </section>

      {newListings.length > 0 && (
        <section className="card">
          <div className="card-header">
            <span className="section-label">🆕 Nuevas oportunidades</span>
            <h2 className="card-title">Recién detectadas ({newListings.length})</h2>
          </div>
          <div className="radar-listings-list">
            {newListings.map((listing) => (
              <article key={listing.id} className={`opportunity-spotlight-card ${listing.cashOnCashNetRoi !== null && listing.cashOnCashNetRoi >= 0.05 ? "tone-green" : "tone-neutral"}`}>
                <div className="radar-listing-row">
                  <div className="radar-listing-info">
                    <strong>{listing.title ?? "Sin título"}</strong>
                    <div className="job-meta">
                      <span>{formatCurrency(listing.priceEur)}</span>
                      {listing.sqmeters && <span>{listing.sqmeters} m²</span>}
                      <span>{pricePerSqm(listing.priceEur, listing.sqmeters)}/m²</span>
                      {listing.bedrooms && <span>{listing.bedrooms} hab</span>}
                      {listing.bathrooms && <span>{listing.bathrooms} baños</span>}
                      <span className="radar-source-badge">{listing.source === "alert" ? "📧 Alerta" : "🔎 Escaneo"}</span>
                    </div>
                    <div className="job-meta">
                      <span>Detectado {formatDate(listing.firstSeenAt)}</span>
                    </div>
                    <div className="job-meta">
                      {listing.estimatedRentEur !== null && <span>Alquiler est.: {formatCurrency(listing.estimatedRentEur)}/mes</span>}
                      {listing.grossRoi !== null && <span>ROI bruto: {formatPercent(listing.grossRoi)}</span>}
                      {listing.netRoi !== null && <span>ROI neto: {formatPercent(listing.netRoi)}</span>}
                      {listing.cashOnCashRoi !== null && <span>Cash-on-cash: {formatPercent(listing.cashOnCashRoi)}</span>}
                      {listing.cashOnCashNetRoi !== null && <span>C2C neto: {formatPercent(listing.cashOnCashNetRoi)}</span>}
                    </div>
                  </div>

                  <div className="radar-listing-actions">
                    <a
                      href={listing.listingUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="job-url-link"
                    >
                      Abrir en Idealista
                    </a>
                    <Link href={calculatorUrl(listing)} className="job-url-link">
                      Abrir en calculadora
                    </Link>
                    {listing.linkedJobId && (
                      <Link href={`/jobs/${listing.linkedJobId}`} className="job-url-link">
                        Análisis
                      </Link>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {scannedListings.length > 0 && (
        <section className="card">
          <div className="card-header">
            <span className="section-label">📋 Historial de escaneos</span>
            <h2 className="card-title">Listings capturados ({scannedListings.length})</h2>
          </div>
          <div className="radar-listings-list">
            {scannedListings.map((listing) => (
              <article key={listing.id} className="opportunity-spotlight-card tone-neutral">
                <div className="radar-listing-row">
                  <div className="radar-listing-info">
                    <strong>{listing.title ?? "Sin título"}</strong>
                    <div className="job-meta">
                      <span>{formatCurrency(listing.priceEur)}</span>
                      {listing.sqmeters && <span>{listing.sqmeters} m²</span>}
                      <span>{pricePerSqm(listing.priceEur, listing.sqmeters)}/m²</span>
                      {listing.bedrooms && <span>{listing.bedrooms} hab</span>}
                      {listing.bathrooms && <span>{listing.bathrooms} baños</span>}
                    </div>
                    <div className="job-meta">
                      <span>Visto {formatDate(listing.lastSeenAt)}</span>
                    </div>
                    <div className="job-meta">
                      {listing.estimatedRentEur !== null && <span>Alquiler est.: {formatCurrency(listing.estimatedRentEur)}/mes</span>}
                      {listing.grossRoi !== null && <span>ROI bruto: {formatPercent(listing.grossRoi)}</span>}
                      {listing.netRoi !== null && <span>ROI neto: {formatPercent(listing.netRoi)}</span>}
                      {listing.cashOnCashRoi !== null && <span>Cash-on-cash: {formatPercent(listing.cashOnCashRoi)}</span>}
                      {listing.cashOnCashNetRoi !== null && <span>C2C neto: {formatPercent(listing.cashOnCashNetRoi)}</span>}
                    </div>
                  </div>

                  <div className="radar-listing-actions">
                    <a
                      href={listing.listingUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="job-url-link"
                    >
                      Abrir en Idealista
                    </a>
                    <Link href={calculatorUrl(listing)} className="job-url-link">
                      Abrir en calculadora
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {listings.length === 0 && (
        <div className="card empty-state">
          <p>Este radar todavía no tiene listings.</p>
          <p className="muted">Haz un escaneo o espera a que lleguen alertas de Idealista.</p>
        </div>
      )}
    </div>
  );
}
