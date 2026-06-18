"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { calculateTargetPrice, calculateTargetRent } from "@/lib/calculator/engine";
import type { CalculatorInput, TargetPrice, TargetRent } from "@/lib/calculator/engine";
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

const TARGET_FINANCIAL: Omit<CalculatorInput, "price" | "monthlyRent"> = {
  itpRate: 0.10,
  notaryRegistry: 2000,
  mortgageFees: 350,
  renovationCost: 0,
  purchaseCommission: 0,
  furnitureOther: 1000,
  loanToValue: 0.8,
  interestRate: 0.028,
  mortgageTermYears: 25,
  ibiBasuras: 300,
  insurance: 300,
  community: 360,
  maintenance: 250,
  vacancyMonths: 1,
};

function computeTargetPrice(price: number | null, rent: number | null): TargetPrice {
  if (!price || !rent || rent <= 0) return null;
  return calculateTargetPrice({ price, monthlyRent: rent, ...TARGET_FINANCIAL });
}

function computeTargetRent(price: number | null, rent: number | null): TargetRent {
  if (!price || price <= 0) return null;
  return calculateTargetRent({ price, monthlyRent: rent ?? 0, ...TARGET_FINANCIAL });
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

  const sortedListings = useMemo(() => {
    return [...listings].sort((a, b) => new Date(b.firstSeenAt).getTime() - new Date(a.firstSeenAt).getTime());
  }, [listings]);

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
            <strong className="kpi-value">{listings.filter((l) => l.isNew).length}</strong>
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

      {sortedListings.length > 0 ? (
        <section className="card">
          <div className="card-header">
            <span className="section-label">📋 Listings</span>
            <h2 className="card-title">{listings.length} propiedades</h2>
          </div>
          <div className="table-shell">
            <table className="data-table radar-table">
              <thead>
                <tr>
                  <th>Propiedad</th>
                  <th>Precio</th>
                  <th>Renta est.</th>
                  <th>ROI bruto</th>
                  <th>C2C neto</th>
                  <th>Precio ideal 7%</th>
                  <th>Renta ideal 7%</th>
                </tr>
              </thead>
              <tbody>
                {sortedListings.map((listing) => {
                  const targetPrice = computeTargetPrice(listing.priceEur, listing.estimatedRentEur);
                  const targetRent = computeTargetRent(listing.priceEur, listing.estimatedRentEur);
                  return (
                    <tr key={listing.id}>
                      <td className="radar-table-title">
                        <div className="radar-table-title-inner">
                          <span className="radar-table-listing-title">{listing.title ?? "Sin título"}</span>
                          <div className="radar-table-links">
                            <a href={listing.listingUrl} target="_blank" rel="noreferrer noopener">Idealista</a>
                            <Link href={calculatorUrl(listing)}>Calculadora</Link>
                          </div>
                        </div>
                      </td>
                      <td className="radar-table-num">{formatCurrency(listing.priceEur)}</td>
                      <td className="radar-table-num">{listing.estimatedRentEur !== null ? formatCurrency(listing.estimatedRentEur) + "/mes" : "n/d"}</td>
                      <td className="radar-table-num">{formatPercent(listing.grossRoi)}</td>
                      <td className="radar-table-num">{formatPercent(listing.cashOnCashNetRoi)}</td>
                      <td className="radar-table-num">{targetPrice ? formatCurrency(targetPrice.targetPrice) : "—"}</td>
                      <td className="radar-table-num">{targetRent ? formatCurrency(targetRent.targetRent) + "/mes" : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <div className="card empty-state">
          <p>Este radar todavía no tiene listings.</p>
          <p className="muted">Haz un escaneo o espera a que lleguen alertas de Idealista.</p>
        </div>
      )}
    </div>
  );
}
