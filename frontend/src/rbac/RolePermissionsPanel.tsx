import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "./auth";
import type { PermissionCatalog, PermissionRole } from "./types";
import { ACTIONS, RESOURCES, ROLES } from "./types";
import { can } from "./permissions";
import { SidebarLabelsEditor } from "./SidebarLabelsEditor";
import "./RolePermissionsPanel.css";

const sidebarSectionByResource: Record<string, string> = {
  dashboard: "dashboard",
  profile: "profile",
  pets: "pets",
  vaccines: "vaccines",
  adoptionRequests: "requests",
  adoptions: "adoptions",
  messaging: "messages",
  medicalRecords: "records",
  veterinarians: "veterinarians",
  shelters: "shelters",
  notifications: "notifications",
  users: "users",
  statistics: "statistics",
  rolePermissions: "permissions",
};
const systemResourceKeys = new Set<string>(Object.values(RESOURCES));

function rolePermissionsToPayload(role: PermissionRole) {
  return role.permissions.map(({ resource, action }) => ({ resource, action }));
}

interface RolePermissionsPanelProps {
  onSidebarLabelsChange?: (labels: Record<string, string>) => void;
  onResourcesChange?: (
    resources: PermissionCatalog["resources"],
  ) => void;
}

export function RolePermissionsPanel({
  onSidebarLabelsChange,
  onResourcesChange,
}: RolePermissionsPanelProps) {
  const { user, permissions, request, refresh } = useAuth();
  const [catalog, setCatalog] = useState<PermissionCatalog | null>(null);
  const [sidebarLabels, setSidebarLabels] = useState<Record<string, string>>({});
  const [selectedRole, setSelectedRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [roleFormMode, setRoleFormMode] = useState<"create" | "edit" | null>(null);
  const [roleForm, setRoleForm] = useState({ name: "", label: "", description: "" });
  const [resourceFormOpen, setResourceFormOpen] = useState(false);
  const [editingResourceKey, setEditingResourceKey] = useState<string | null>(null);
  const [resourceForm, setResourceForm] = useState({
    key: "",
    label: "",
    actions: ["read"],
  });
  const handleSidebarLabelsChange = useCallback(
    (labels: Record<string, string>) => {
      setSidebarLabels(labels);
      onSidebarLabelsChange?.(labels);
    },
    [onSidebarLabelsChange],
  );
  const handleResourcesChange = useCallback(
    (resources: PermissionCatalog["resources"]) => {
      onResourcesChange?.(
        resources.filter(
          (resource) => !systemResourceKeys.has(resource.key),
        ),
      );
    },
    [onResourcesChange],
  );

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
      handleResourcesChange(result.resources);
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
  }, [handleResourcesChange, request]);

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
  const canViewPanel = [
    ACTIONS.READ,
    ACTIONS.CREATE,
    ACTIONS.UPDATE,
    ACTIONS.DELETE,
    ACTIONS.MANAGE,
  ].some((action) =>
    can(user, RESOURCES.ROLE_PERMISSIONS, action, permissions ?? {}),
  );
  const canCreateRole = can(
    user,
    RESOURCES.ROLE_PERMISSIONS,
    ACTIONS.CREATE,
    permissions ?? {},
  );
  const canUpdatePermissions = can(
    user,
    RESOURCES.ROLE_PERMISSIONS,
    ACTIONS.UPDATE,
    permissions ?? {},
  );
  const canEditRoles = canUpdatePermissions;
  const canDeleteRoles = can(
    user,
    RESOURCES.ROLE_PERMISSIONS,
    ACTIONS.DELETE,
    permissions ?? {},
  );
  const canCreateResource = can(
    user,
    RESOURCES.ROLE_PERMISSIONS,
    ACTIONS.CREATE,
    permissions ?? {},
  );
  const matrixActions =
    catalog?.resources.reduce<
      PermissionCatalog["resources"][number]["actions"]
    >((actions, resource) => {
      for (const action of resource.actions) {
        if (!actions.some((existing) => existing.key === action.key)) {
          actions.push(action);
        }
      }
      return actions;
    }, []) ?? [];
  const getResourceLabel = (resource: PermissionCatalog["resources"][number]) =>
    sidebarLabels[sidebarSectionByResource[resource.key]] || resource.label;

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
    if (!currentRole || !canEditCurrentRole || !canUpdatePermissions) return;
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

  const removePermissions = async () => {
    if (!currentRole || !canEditCurrentRole || !canUpdatePermissions) return;
    if (
      !window.confirm(
        `¿Quitar los permisos asignados a ${currentRole.label}? Esta acción se guardará de inmediato.`,
      )
    ) {
      return;
    }

    const requiredAdminPermissions =
      currentRole.name === ROLES.ADMIN
        ? [
            { resource: "users", action: "manage" },
            { resource: "shelters", action: "verify" },
            { resource: "rolePermissions", action: "manage" },
          ]
        : [];
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await request(
        `/api/v1/auth/permissions/${encodeURIComponent(currentRole.name)}/`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requiredAdminPermissions),
        },
      );
      if (!response.ok) {
        const details = await response.json().catch(() => null);
        throw new Error(
          details?.detail ??
            `No se pudieron quitar los permisos (${response.status}).`,
        );
      }
      const updatedCatalog = (await response.json()) as PermissionCatalog;
      setCatalog(updatedCatalog);
      setNotice(`Se quitaron los permisos de ${currentRole.label}.`);
      await refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudieron quitar los permisos.",
      );
    } finally {
      setSaving(false);
    }
  };

  const saveRole = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      (roleFormMode === "create" && !canCreateRole) ||
      (roleFormMode === "edit" && !canEditRoles)
    ) return;
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
    if (
      !currentRole ||
      !canDeleteRoles ||
      !window.confirm(`¿Eliminar el rol ${currentRole.label}?`)
    ) return;
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

  const saveResource = async (event: React.FormEvent) => {
    event.preventDefault();
    if (editingResourceKey ? !canUpdatePermissions : !canCreateResource) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const editing = editingResourceKey !== null;
      const response = await request(
        editing
          ? `/api/v1/auth/resources/${encodeURIComponent(editingResourceKey)}/`
          : "/api/v1/auth/resources/",
        {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editing
            ? { label: resourceForm.label, actions: resourceForm.actions }
            : resourceForm,
        ),
      });
      if (!response.ok) {
        const details = await response.json().catch(() => null);
        const message =
          details && typeof details === "object"
            ? Object.values(details).flat().find((item) => typeof item === "string")
            : null;
        throw new Error(
          (typeof message === "string" && message) ||
            `No se pudo crear el recurso (${response.status}).`,
        );
      }
      const updatedCatalog = (await response.json()) as PermissionCatalog;
      if (!Array.isArray(updatedCatalog.resources)) {
        throw new Error("La respuesta del catálogo tiene un formato inválido.");
      }
      setCatalog(updatedCatalog);
      handleResourcesChange(updatedCatalog.resources);
      setResourceForm({ key: "", label: "", actions: ["read"] });
      setResourceFormOpen(false);
      setEditingResourceKey(null);
      setNotice(editing ? "Recurso actualizado." : "Recurso agregado a la matriz de permisos.");
      if (editing) await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo crear el recurso.");
    } finally {
      setSaving(false);
    }
  };

  const editResource = (
    resource: PermissionCatalog["resources"][number],
  ) => {
    setEditingResourceKey(resource.key);
    setResourceForm({
      key: resource.key,
      label: resource.label,
      actions: resource.actions.map((action) => action.key),
    });
    setResourceFormOpen(true);
    setError(null);
    setNotice(null);
  };

  const deleteResource = async (
    resource: PermissionCatalog["resources"][number],
  ) => {
    if (
      !canDeleteRoles ||
      !window.confirm(
        `¿Eliminar el recurso "${resource.label}" y quitar sus permisos de todos los roles?`,
      )
    ) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await request(
        `/api/v1/auth/resources/${encodeURIComponent(resource.key)}/`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const details = await response.json().catch(() => null);
        throw new Error(
          details?.detail ?? `No se pudo eliminar el recurso (${response.status}).`,
        );
      }
      const updatedCatalog = (await response.json()) as PermissionCatalog;
      if (
        !Array.isArray(updatedCatalog.resources) ||
        !Array.isArray(updatedCatalog.roles)
      ) {
        throw new Error("La respuesta del catálogo tiene un formato inválido.");
      }
      setCatalog(updatedCatalog);
      handleResourcesChange(updatedCatalog.resources);
      setNotice(`Se eliminó el recurso "${resource.label}" y sus permisos asignados.`);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo eliminar el recurso.");
    } finally {
      setSaving(false);
    }
  };

  if (!canViewPanel) {
    return (
      <section className="rbac-panel" aria-labelledby="rbac-title">
        <h1 id="rbac-title">Permisos por rol</h1>
        <p role="alert">Tu rol no tiene permiso para gestionar el panel de permisos por rol.</p>
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
          {canCreateResource && <button
            type="button"
            disabled={saving || loading}
            onClick={() => {
              setEditingResourceKey(null);
              setResourceForm({ key: "", label: "", actions: ["read"] });
              setResourceFormOpen((open) => !open);
            }}
          >
            {resourceFormOpen && !editingResourceKey ? "Cancelar recurso" : "Crear recurso"}
          </button>}
          {canCreateRole && <button type="button" disabled={saving || loading} onClick={() => {
            setRoleForm({ name: "", label: "", description: "" });
            setRoleFormMode("create");
          }}>Crear rol</button>}
          {currentRole && !Object.values(ROLES).includes(currentRole.name as typeof ROLES[keyof typeof ROLES]) && (
            <>
              {canEditRoles && <button type="button" disabled={saving} onClick={() => {
                setRoleForm({
                  name: currentRole.name,
                  label: currentRole.label,
                  description: currentRole.description ?? "",
                });
                setRoleFormMode("edit");
              }}>Editar rol</button>}
              {canDeleteRoles && <button type="button" disabled={saving} onClick={() => void deleteRole()}>Eliminar rol</button>}
            </>
          )}
        </div>
      </header>

      {error && <p className="rbac-panel__error" role="alert">{error}</p>}
      {notice && <p className="rbac-panel__notice" role="status">{notice}</p>}
      {resourceFormOpen && (editingResourceKey ? canUpdatePermissions : canCreateResource) && (
        <form className="rbac-panel__role-form" onSubmit={(event) => void saveResource(event)}>
          <label>
            Clave del recurso
            <input
              value={resourceForm.key}
              onChange={(event) =>
                setResourceForm({ ...resourceForm, key: event.target.value })
              }
              required
              maxLength={40}
              pattern="[a-z][A-Za-z0-9]*"
              placeholder="ej. adoptionReports"
              disabled={editingResourceKey !== null}
            />
          </label>
          <label>
            Nombre visible
            <input
              value={resourceForm.label}
              onChange={(event) =>
                setResourceForm({ ...resourceForm, label: event.target.value })
              }
              required
              maxLength={60}
              placeholder="ej. Informes de adopción"
            />
          </label>
          <fieldset className="rbac-panel__resource-actions">
            <legend>Acciones disponibles</legend>
            {matrixActions.map((action) => (
              <label key={action.key}>
                <input
                  type="checkbox"
                  checked={resourceForm.actions.includes(action.key)}
                  onChange={() =>
                    setResourceForm((current) => ({
                      ...current,
                      actions: current.actions.includes(action.key)
                        ? current.actions.filter((item) => item !== action.key)
                        : [...current.actions, action.key],
                    }))
                  }
                />
                {action.label}
              </label>
            ))}
          </fieldset>
          <p className="rbac-panel__description">
            Al crear la vista/API, asígnale esta clave como recurso RBAC para que
            estos permisos se apliquen también en el backend.
          </p>
          <div className="rbac-panel__role-actions">
            <button type="submit" disabled={saving || resourceForm.actions.length === 0}>
              {saving
                ? "Guardando…"
                : editingResourceKey
                  ? "Guardar recurso"
                  : "Crear recurso"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setResourceFormOpen(false);
                setEditingResourceKey(null);
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
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
                  {matrixActions.map((action) => (
                    <th scope="col" key={action.key}>{action.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {catalog?.resources.map((resource) => (
                  <tr key={resource.key}>
                    <th scope="row">
                      <div className="rbac-panel__resource-cell">
                        <span>{getResourceLabel(resource)}</span>
                        {!systemResourceKeys.has(resource.key) && (
                          <span className="rbac-panel__resource-controls">
                            {canUpdatePermissions && (
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => editResource(resource)}
                              >
                                Editar
                              </button>
                            )}
                            {canDeleteRoles && (
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => void deleteResource(resource)}
                              >
                                Eliminar
                              </button>
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                    {matrixActions.map((action) => {
                      if (!resource.actions.some((item) => item.key === action.key)) {
                        return <td key={action.key} aria-label="No disponible" />;
                      }
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
                        ((resource.key === "users" && action.key === "manage") ||
                          (resource.key === "shelters" && action.key === "verify") ||
                          (resource.key === "rolePermissions" && action.key === "manage"));
                      return (
                        <td key={action.key}>
                          <input
                            type="checkbox"
                            aria-label={`${getResourceLabel(resource)}: ${action.label}`}
                            checked={Boolean(checked)}
                            disabled={
                              saving ||
                              !canUpdatePermissions ||
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
            <div className="rbac-panel__footer-actions">
              <button
                type="button"
                className="rbac-panel__remove-permissions"
                onClick={() => void removePermissions()}
                disabled={saving || !currentRole || !canUpdatePermissions || !canEditCurrentRole}
              >
                Quitar permisos
              </button>
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving || !currentRole || !canUpdatePermissions || !canEditCurrentRole}
              >
                {saving ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </footer>
          <SidebarLabelsEditor onLabelsChange={handleSidebarLabelsChange} />
        </>
      )}
    </main>
  );
}
