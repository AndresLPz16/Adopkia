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
  const [roleFormMode, setRoleFormMode] = useState<"create" | "edit" | null>(null);
  const [roleForm, setRoleForm] = useState({ name: "", label: "", description: "" });

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
  const canEditCurrentRole =
    currentRole?.name !== ROLES.ADMIN || user?.isPlatformSuperadmin === true;

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
    if (!currentRole || !canEditCurrentRole) return;
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

  const saveRole = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const editing = roleFormMode === "edit" && currentRole;
      const response = await request(
        editing
          ? `/api/v1/auth/roles/${encodeURIComponent(editing.id)}/`
          : "/api/v1/auth/roles/",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(roleForm),
        },
      );
      if (!response.ok) {
        const details = await response.json().catch(() => null);
        const message =
          details && typeof details === "object"
            ? Object.values(details).flat().find((item) => typeof item === "string")
            : null;
        throw new Error(
          (typeof message === "string" && message) ||
            `No se pudo guardar el rol (${response.status}).`,
        );
      }
      const savedRole = (await response.json()) as {
        id: string | number;
        name: string;
      };
      setSelectedRole(savedRole.name);
      setRoleFormMode(null);
      await loadCatalog();
      setNotice(editing ? "Rol actualizado." : "Rol creado. Ahora configura sus permisos.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar el rol.");
    } finally {
      setSaving(false);
    }
  };

  const deleteRole = async () => {
    if (!currentRole || !window.confirm(`¿Eliminar el rol ${currentRole.label}?`)) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await request(
        `/api/v1/auth/roles/${encodeURIComponent(currentRole.id)}/`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const details = await response.json().catch(() => null);
        throw new Error(
          details?.role?.[0] ??
            `No se pudo eliminar el rol (${response.status}).`,
        );
      }
      setRoleFormMode(null);
      setSelectedRole("");
      await loadCatalog();
      setNotice("Rol eliminado.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo eliminar el rol.");
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
            Define qué acciones permite la API para cada rol y controla también
            las opciones que aparecen en la interfaz.
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
        <div className="rbac-panel__role-actions">
          <button type="button" disabled={saving || loading} onClick={() => {
            setRoleForm({ name: "", label: "", description: "" });
            setRoleFormMode("create");
          }}>Crear rol</button>
          {currentRole && !Object.values(ROLES).includes(currentRole.name as typeof ROLES[keyof typeof ROLES]) && (
            <>
              <button type="button" disabled={saving} onClick={() => {
                setRoleForm({
                  name: currentRole.name,
                  label: currentRole.label,
                  description: currentRole.description ?? "",
                });
                setRoleFormMode("edit");
              }}>Editar rol</button>
              <button type="button" disabled={saving} onClick={() => void deleteRole()}>Eliminar rol</button>
            </>
          )}
        </div>
      </header>

      {error && <p className="rbac-panel__error" role="alert">{error}</p>}
      {notice && <p className="rbac-panel__notice" role="status">{notice}</p>}
      {!canEditCurrentRole && (
        <p role="status">
          No tienes autorización para modificar los permisos de este rol.
        </p>
      )}
      {roleFormMode && (
        <form className="rbac-panel__role-form" onSubmit={(event) => void saveRole(event)}>
          <label>
            Identificador
            <input
              value={roleForm.name}
              onChange={(event) => setRoleForm({ ...roleForm, name: event.target.value })}
              required
              minLength={3}
              maxLength={30}
              pattern="[a-z][a-z0-9_]*"
              disabled={roleFormMode === "edit"}
            />
          </label>
          <label>
            Nombre visible
            <input
              value={roleForm.label}
              onChange={(event) => setRoleForm({ ...roleForm, label: event.target.value })}
              required
              maxLength={60}
            />
          </label>
          <label>
            Descripción
            <input
              value={roleForm.description}
              onChange={(event) => setRoleForm({ ...roleForm, description: event.target.value })}
              maxLength={150}
            />
          </label>
          <button type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar rol"}</button>
          <button type="button" disabled={saving} onClick={() => setRoleFormMode(null)}>Cancelar</button>
        </form>
      )}
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
                            disabled={
                              saving ||
                              !canEditCurrentRole ||
                              Boolean(isAdminRecoveryPermission)
                            }
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
              Los cambios se aplican de inmediato en las solicitudes protegidas
              del backend. Los límites de propiedad y pertenencia siguen vigentes.
            </p>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || !currentRole || !canEditCurrentRole}
            >
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
          </footer>
        </>
      )}
    </main>
  );
}
