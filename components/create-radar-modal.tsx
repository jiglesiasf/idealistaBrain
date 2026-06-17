"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseIdealistaLocation } from "@/lib/idealista/parse-location";
import { parseIdealistaSearchPills } from "@/lib/idealista/search-filters";

export function CreateRadarModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [urlPreview, setUrlPreview] = useState<{
    location: string;
    pills: string[];
    suggestedName: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleUrlChange = (value: string) => {
    setUrl(value);
    setError("");

    if (!value) {
      setUrlPreview(null);
      return;
    }

    try {
      new URL(value);
    } catch {
      setUrlPreview(null);
      return;
    }

    const location = parseIdealistaLocation(value);
    const pills = parseIdealistaSearchPills(value);

    if (location) {
      const suggestedName = [location.shortName, ...pills].join(" · ");
      setUrlPreview({ location: location.name, pills, suggestedName });
      if (!name) {
        setName(suggestedName);
      }
    } else {
      setUrlPreview(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const response = await fetch("/api/radars", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          idealistaSearchUrl: url,
        }),
      });

      if (response.status === 401) {
        router.push("/login");
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "No se ha podido crear el radar.");
      }

      setUrl("");
      setName("");
      setUrlPreview(null);
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="section-label">📡 Nuevo radar</span>
          <h2 className="card-title">Añadir zona vigilada</h2>
          <p className="muted">
            Pega una URL de búsqueda de Idealista y el radar extraerá automáticamente la ubicación y los filtros.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="radar-url">URL de búsqueda en Idealista</label>
            <input
              id="radar-url"
              type="url"
              required
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="https://www.idealista.com/venta-viviendas/madrid/chamberi/con-3-dormitorios,precio-hasta_350000"
            />
            <span className="field-helper">
              Copia la URL de tu búsqueda en Idealista con los filtros que quieras vigilar.
            </span>
          </div>

          {urlPreview && (
            <div className="radar-preview">
              <div className="radar-preview-pills">
                {urlPreview.pills.map((pill) => (
                  <span key={pill} className="search-pill">{pill}</span>
                ))}
              </div>
              {urlPreview.location && (
                <p className="muted">📍 {urlPreview.location}</p>
              )}
            </div>
          )}

          <div className="field">
            <label htmlFor="radar-name">Nombre del radar</label>
            <input
              id="radar-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={urlPreview?.suggestedName ?? "Ej: Chamberí 3 hab"}
              maxLength={120}
            />
          </div>

          {error && <p className="status-line error">{error}</p>}

          <div className="action-row">
            <button type="button" className="ghost-button" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="primary-button" disabled={saving || !url || !name}>
              {saving ? "Guardando..." : "Añadir radar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
