import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "./auth";
import type { PermissionCatalog, PermissionRole } from "./types";
import { ROLES } from "./types";
import "./RolePermissionsPanel.css";

function rolePermissionsToPayload(role: PermissionRole) {
  return role.permissions.map(({ resource, action }) => ({ resource, action }));
}

export function RolePermissionsPanel() {
  const { user, request, refresh } = useAuth();
  const [catalog, setCatalog] = useState<PermissionCatalog | null>(null);
  const [selectedRole, setSelectedRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadCatalog = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const response = await request("/api/v1/auth/permissions/", { signal });
      if (!response.ok) {
        throw new Error(`No se pudo cargar la matriz (${response.status}).`);
      }
      const result = (await response.json()) as PermissionCatalog;
      if (!Array.isArray(result.roles) || !Array.isArray(result.resources)) {
        throw new Error("La respuesta de permisos tiene un formato inválido.");
      }
      setCatalog(result);
      setSelectedRole((current) =>
        result.roles.some((role) => role.name === current)
          ? current
          : result.roles[0]?.name ?? "",
      );
    } catch (caught) {
      if (signal?.aborted) return;
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo cargar la matriz de permisos.",
      );
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    const controller = new AbortController();
    void loadCatalog(controller.signal);
    return () => controller.abort();
  }, [loadCatalog]);

  const currentRole = useMemo(
    () => catalog?.roles.find((role) => role.name === selectedRole) ?? null,
    [catalog, selectedRole],
  );

  const togglePermission = (resource: string, action: string) => {
    if (!catalog || !currentRole) return;
    const permissions = new Map<
      string,
      { resource: string; action: string }
    >();
    for (const permission of currentRole.permissions) {
      permissions.set(
        `${permission.resource}:${permission.action}`,
        permission,
      );
    }
    const resourceActions =
      catalog.resources.find((item) => item.key === resource)?.actions ?? [];
    const hasManage = permissions.has(`${resource}:manage`);

    if (action === "manage") {
      if (hasManage) {
        permissions.delete(`${resource}:manage`);
      } else {
        for (const item of resourceActions) {
          permissions.delete(`${resource}:${item.key}`);
        }
        permissions.set(`${resource}:manage`, { resource, action });
      }
    } else {
      if (hasManage) {
        permissions.delete(`${resource}:manage`);
        for (const item of resourceActions) {
          if (item.key !== "manage") {
            permissions.set(`${resource}:${item.key}`, {
              resource,
              action: item.key,
            });
          }
        }
      }
      const key = `${resource}:${action}`;
      if (permissions.has(key)) permissions.delete(key);
      else permissions.set(key, { resource, action });
    }

    const updatedRole = {
      ...currentRole,
      permissions: Array.from(permissions.values()),
    };
    setCatalog({
      ...catalog,
      roles: catalog.roles.map((role) =>
        role.name === selectedRole ? updatedRole : role,
      ),
    });
    setNotice(null);
  };

  const save = async () => {
    if (!currentRole) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await request(
        `/api/v1/auth/permissions/${encodeURIComponent(currentRole.name)}/`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(rolePermissionsToPayload(currentRole)),
        },
      );
      if (!response.ok) {
        const details = await response.json().catch(() => null);
        throw new Error(
          details?.detail ??
            `No se pudieron guardar los permisos (${response.status}).`,
        );
      }
      const updatedCatalog = (await response.json()) as PermissionCatalog;
      setCatalog(updatedCatalog);
      setNotice(`Permisos guardados para ${currentRole.label}.`);
      await refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudieron guardar los permisos.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (!user?.roles.includes(ROLES.ADMIN)) {
    return (
      <section className="rbac-panel" aria-labelledby="rbac-title">
        <h1 id="rbac-title">Permisos por rol</h1>
        <p role="alert">Solo un administrador puede gestionar permisos.</p>
      </section>
    );
  }

  return (
    <main className="rbac-panel" aria-labelledby="rbac-title">
      <header className="rbac-panel__header">
        <div>
          <p className="rbac-panel__eyebrow">Administración</p>
          <h1 id="rbac-title">Permisos por rol</h1>
          <p className="rbac-panel__description">
            Consulta y ajusta qué puede hacer cada rol en la interfaz de Adopkia.
          </p>
        </div>
        <label className="rbac-panel__role">
          Rol seleccionado
          <select
            value={selectedRole}
            onChange={(event) => setSelectedRole(event.target.value)}
            disabled={loading || saving || !catalog}
          >
            {catalog?.roles.map((role) => (
              <option key={role.name} value={role.name}>
                {role.label}
              </option>
            ))}
          </select>
        </label>
      </header>

      {error && <p className="rbac-panel__error" role="alert">{error}</p>}
      {notice && <p className="rbac-panel__notice" role="status">{notice}</p>}
      {loading ? (
        <p role="status">Cargando permisos…</p>
      ) : (
        <>
          <div className="rbac-panel__table-wrap">
            <table className="rbac-panel__table">
              <thead>
                <tr>
                  <th scope="col">Recurso</th>
                  {catalog?.resources[0]?.actions.map((action) => (
                    <th scope="col" key={action.key}>{action.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {catalog?.resources.map((resource) => (
                  <tr key={resource.key}>
                    <th scope="row">{resource.label}</th>
                    {resource.actions.map((action) => {
                      const hasManage = currentRole?.permissions.some(
                        (permission) =>
                          permission.resource === resource.key &&
                          permission.action === "manage",
                      );
                      const checked =
                        currentRole?.permissions.some(
                          (permission) =>
                            permission.resource === resource.key &&
                            permission.action === action.key,
                        ) || Boolean(hasManage);
                      const isAdminRecoveryPermission =
                        currentRole?.name === ROLES.ADMIN &&
                        resource.key === "users" &&
                        action.key === "manage";
                      return (
                        <td key={action.key}>
                          <input
                            type="checkbox"
                            aria-label={`${resource.label}: ${action.label}`}
                            checked={Boolean(checked)}
                            disabled={saving || Boolean(isAdminRecoveryPermission)}
                            onChange={() =>
                              togglePermission(resource.key, action.key)
                            }
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <footer className="rbac-panel__footer">
            <p>
              Los cambios se guardan en el servidor. Las reglas y permisos
              específicos del backend siguen siendo la autorización definitiva.
            </p>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || !currentRole}
            >
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
          </footer>
        </>
      )}
    </main>
  );
}
