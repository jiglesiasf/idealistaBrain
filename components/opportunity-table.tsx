"use client";

import { useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";

type Opportunity = {
  listingId?: string;
  title?: string;
  url?: string;
  zone?: string | null;
  municipality?: string | null;
  priceEur?: number | null;
  areaM2?: number | null;
  rooms?: number | null;
  estimatedRentEur?: number | null;
  cashOnCashRoi?: number | null;
  cashOnCashNetRoi?: number | null;
  grossRoi?: number | null;
  netRoi?: number | null;
  comparablesUsed?: number | null;
};

const columnHelper = createColumnHelper<Opportunity>();
const METRIC_OPTIONS = [
  { key: "cashOnCashRoi", label: "ROI cash on cash" },
  { key: "cashOnCashNetRoi", label: "ROI cash on cash neto" },
  { key: "grossRoi", label: "ROI bruto" },
  { key: "netRoi", label: "ROI neto" },
] as const;

type OpportunityMetricKey = (typeof METRIC_OPTIONS)[number]["key"];

function formatCurrency(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value)
    ? new Intl.NumberFormat("es-ES").format(value)
    : "n/d";
}

function formatPercent(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : "n/d";
}

function getOpportunityMetricValue(opportunity: Opportunity, metricKey: OpportunityMetricKey) {
  const value = opportunity?.[metricKey];
  return Number.isFinite(value) ? value : null;
}

function getOpportunityToneClass(metricValue?: number | null) {
  if (!Number.isFinite(metricValue)) {
    return "tone-neutral";
  }

  if ((metricValue ?? 0) > 0.25) {
    return "tone-green";
  }

  if ((metricValue ?? 0) >= 0.15) {
    return "tone-yellow";
  }

  return "tone-red";
}

function buildOpportunityFacts(opportunity: Opportunity) {
  const facts = [];

  if (Number.isFinite(opportunity.priceEur)) {
    facts.push({
      label: "Compra",
      value: `${formatCurrency(opportunity.priceEur)} €`,
    });
  }

  if (Number.isFinite(opportunity.estimatedRentEur)) {
    facts.push({
      label: "Renta estimada",
      value: `${formatCurrency(opportunity.estimatedRentEur)} €/mes`,
    });
  }

  if (Number.isFinite(opportunity.areaM2)) {
    facts.push({
      label: "Superficie",
      value: `${opportunity.areaM2} m²`,
    });
  }

  if (Number.isFinite(opportunity.rooms)) {
    facts.push({
      label: "Habitaciones",
      value: `${opportunity.rooms}`,
    });
  }

  if (Number.isFinite(opportunity.comparablesUsed)) {
    facts.push({
      label: "Comparables",
      value: `${opportunity.comparablesUsed}`,
    });
  }

  return facts;
}

function buildOpportunityRois(opportunity: Opportunity) {
  return [
    {
      label: "ROI cash on cash",
      value: formatPercent(opportunity.cashOnCashRoi),
    },
    {
      label: "ROI cash on cash neto",
      value: formatPercent(opportunity.cashOnCashNetRoi),
    },
    {
      label: "ROI bruto",
      value: formatPercent(opportunity.grossRoi),
    },
    {
      label: "ROI neto",
      value: formatPercent(opportunity.netRoi),
    },
  ];
}

export function OpportunityTable({ opportunities }: { opportunities: Opportunity[] }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "cashOnCashRoi", desc: true }]);
  const selectedMetric = (METRIC_OPTIONS.find((option) => option.key === sorting[0]?.id)?.key ?? "cashOnCashRoi") as OpportunityMetricKey;
  const selectedMetricLabel = METRIC_OPTIONS.find((option) => option.key === selectedMetric)?.label ?? "ROI cash on cash";

  const table = useReactTable({
    data: opportunities,
    columns: [
      columnHelper.accessor("title", {
        header: "Activo",
        cell: (info) => {
          const row = info.row.original;
          if (row.url) {
            return (
              <a href={row.url} target="_blank" rel="noreferrer noopener">
                {info.getValue() || "Activo sin titulo"}
              </a>
            );
          }

          return info.getValue() || "Activo sin titulo";
        },
      }),
      columnHelper.accessor("priceEur", {
        header: "Compra",
        cell: (info) => `${formatCurrency(info.getValue())} €`,
      }),
      columnHelper.accessor("estimatedRentEur", {
        header: "Alquiler",
        cell: (info) => `${formatCurrency(info.getValue())} €/mes`,
      }),
      columnHelper.accessor("cashOnCashRoi", {
        header: "C2C",
        cell: (info) => formatPercent(info.getValue()),
      }),
      columnHelper.accessor("cashOnCashNetRoi", {
        header: "C2C Neto",
        cell: (info) => formatPercent(info.getValue()),
      }),
      columnHelper.accessor("grossRoi", {
        header: "ROI Bruto",
        cell: (info) => formatPercent(info.getValue()),
      }),
      columnHelper.accessor("netRoi", {
        header: "ROI Neto",
        cell: (info) => formatPercent(info.getValue()),
      }),
      columnHelper.accessor("comparablesUsed", {
        header: "Comps",
        cell: (info) => info.getValue() ?? "n/d",
      }),
    ],
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (opportunities.length === 0) {
    return <p className="empty-state">Todavia no hay oportunidades persistidas para este escaneo.</p>;
  }

  return (
    <div className="stack">
      <div className="metric-sort-panel">
        <div>
          <span className="section-label">Orden del ranking</span>
          <p className="muted metric-sort-copy">Decide qué métrica define cuál es la mejor oportunidad del listado.</p>
        </div>

        <div className="metric-chip-row">
          {METRIC_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              className={`metric-chip ${selectedMetric === option.key ? "selected" : ""}`.trim()}
              onClick={() => setSorting([{ id: option.key, desc: true }])}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="opportunity-card-grid">
        {table.getRowModel().rows.map((row, index) => {
          const item = row.original;
          const facts = buildOpportunityFacts(item);
          const rois = buildOpportunityRois(item);
          const location = [item.zone, item.municipality].filter(Boolean).join(" · ");
          const selectedMetricValue = getOpportunityMetricValue(item, selectedMetric);

          return (
            <article key={row.id} className={`opportunity-spotlight-card ${getOpportunityToneClass(selectedMetricValue)}`}>
              <div className="opportunity-spotlight-top">
                <span className="opportunity-spotlight-rank">#{index + 1}</span>
                <span className="opportunity-spotlight-badge">
                  {Number.isFinite(selectedMetricValue)
                    ? `${selectedMetricLabel} ${formatPercent(selectedMetricValue)}`
                    : `${selectedMetricLabel} n/d`}
                </span>
              </div>

              <a className="opportunity-spotlight-title" href={item.url || "#"} target="_blank" rel="noreferrer noopener">
                {item.title || "Activo sin titulo"}
              </a>

              {location ? <p className="opportunity-spotlight-location">{location}</p> : null}

              <div className="opportunity-facts-grid">
                {facts.map((fact) => (
                  <div key={fact.label} className="opportunity-fact-pill">
                    <span>{fact.label}</span>
                    <strong>{fact.value}</strong>
                  </div>
                ))}
              </div>

              <div className="opportunity-roi-grid">
                {rois.map((roi) => (
                  <div key={roi.label} className="opportunity-roi-card">
                    <span>{roi.label}</span>
                    <strong>{roi.value}</strong>
                  </div>
                ))}
              </div>

              <div className="action-row" style={{ marginTop: "0.5rem" }}>
                <a
                  className="job-url-link"
                  href={item.url || "#"}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  Abrir en Idealista
                </a>
                {item.priceEur && item.estimatedRentEur ? (
                  <a
                    className="job-url-link"
                    href={`/calculator?price=${item.priceEur}&monthlyRent=${Math.round(item.estimatedRentEur)}`}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Abrir en calculadora
                  </a>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      <div className="table-shell">
        <div className="table-caption">
          <span className="section-label">Vista tabla</span>
          <p className="muted">Ahora mismo el ranking principal está ordenado por {selectedMetricLabel.toLowerCase()}.</p>
        </div>

        <table className="data-table">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id}>
                    {header.isPlaceholder ? null : (
                      <button onClick={header.column.getToggleSortingHandler()} type="button">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
