import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./auth";
import "./RolePermissionsPanel.css";

type SidebarLabelsResponse = {
  defaults: Record<string, string>;
  labels: Record<string, string>;
};

export function SidebarLabelsEditor() {
  const { user, request } = useAuth();
  const [defaults, setDefaults] = useState<Record<string, string>>({});
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadLabels = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const response = await request("/api/v1/auth/sidebar-labels/", { signal });
      if (!response.ok) {
        throw new Error(`No se pudieron cargar los nombres (${response.status}).`);
      }
      const data = (await response.json()) as SidebarLabelsResponse;
      if (!data.defaults || !data.labels || typeof data.labels !== "object") {
        throw new Error("La respuesta de nombres del menú tiene un formato inválido.");
      }
      setDefaults(data.defaults);
      setLabels(data.labels);
    } catch (caught) {
      if (signal?.aborted) return;
      setError(caught instanceof Error ? caught.message : "No se pudieron cargar los nombres.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    const controller = new AbortController();
    void loadLabels(controller.signal);
    return () => controller.abort();
  }, [loadLabels]);

  if (!user?.roles.includes("administrador")) return null;

  const save = async (nextLabels: Record<string, string>) => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await request("/api/v1/auth/sidebar-labels/", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labels: nextLabels }),
      });
      if (!response.ok) {
        const details = await response.json().catch(() => null);
        throw new Error(
          details?.detail ?? `No se pudieron guardar los nombres (${response.status}).`,
        );
      }
      const data = (await response.json()) as SidebarLabelsResponse;
      setDefaults(data.defaults);
      setLabels(data.labels);
      setNotice("Nombres del menú actualizados para todos los usuarios.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron guardar los nombres.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rbac-panel__sidebar-labels" aria-labelledby="sidebar-labels-title">
      <header>
        <p className="rbac-panel__eyebrow">Personalización global</p>
        <h2 id="sidebar-labels-title">Nombres del menú lateral</h2>
        <p>Los cambios se aplican a todos los roles. Deja un nombre vacío para usar el predeterminado.</p>
      </header>
      {error && <p className="rbac-panel__error" role="alert">{error}</p>}
      {notice && <p className="rbac-panel__notice" role="status">{notice}</p>}
      {loading ? (
        <p role="status">Cargando nombres…</p>
      ) : (
        <form
          className="rbac-panel__labels-form"
          onSubmit={(event) => {
            event.preventDefault();
            const nextLabels = Object.fromEntries(
              Object.entries(labels).map(([key, value]) => [
                key,
                value.trim() || defaults[key],
              ]),
            );
            void save(nextLabels);
          }}
        >
          {Object.entries(defaults).map(([key, defaultLabel]) => (
            <label key={key}>
              <span>{defaultLabel}</span>
              <input
                value={labels[key] ?? defaultLabel}
                maxLength={60}
                onChange={(event) =>
                  setLabels((current) => ({ ...current, [key]: event.target.value }))
                }
              />
            </label>
          ))}
          <div className="rbac-panel__labels-actions">
            <button type="submit" disabled={saving}>
              {saving ? "Guardando…" : "Guardar nombres"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void save(defaults)}
            >
              Restablecer predeterminados
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
