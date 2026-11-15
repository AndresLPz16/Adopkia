import { useCallback, useEffect, useMemo, useState } from "react";
import { confirmAction } from "../ui/confirm";
import { useAuth } from "./auth";
import type { PermissionCatalog } from "./types";
import { ACTIONS, RESOURCES, ROLES } from "./types";
import { can } from "./permissions";
import { SidebarLabelsEditor } from "./SidebarLabelsEditor";
import { PermissionMatrix } from "./panel/PermissionMatrix";
import { ResourceForm } from "./panel/ResourceForm";
import { RoleForm } from "./panel/RoleForm";
import {
  rolePermissionsToPayload,
  sidebarSectionByResource,
  systemResourceKeys,
  toggleRolePermission,
} from "./panel/resources";
import type { ResourceFormState, RoleFormState } from "./panel/resources";
import * as api from "./panel/api";
import "./RolePermissionsPanel.css";

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
  const [roleForm, setRoleForm] = useState<RoleFormState>({ name: "", label: "", description: "" });
  const [resourceFormOpen, setResourceFormOpen] = useState(false);
  const [editingResourceKey, setEditingResourceKey] = useState<string | null>(null);
  const [resourceForm, setResourceForm] = useState<ResourceFormState>({
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
      const result = await api.fetchCatalog(request, signal);
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
  const isPlatformSuperadmin = user?.isPlatformSuperadmin === true;
  const canEditCurrentRole =
    currentRole?.name !== ROLES.ADMIN || isPlatformSuperadmin;
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
    const resourceActions =
      catalog.resources.find((item) => item.key === resource)?.actions ?? [];
    const updatedRole = {
      ...currentRole,
      permissions: toggleRolePermission(currentRole, resourceActions, resource, action),
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
      const updatedCatalog = await api.putRolePermissions(
        request,
        currentRole.name,
        rolePermissionsToPayload(currentRole),
        "No se pudieron guardar los permisos",
      );
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
      !(await confirmAction({
        title: `¿Quitar los permisos asignados a ${currentRole.label}?`,
        message: "Esta acción se guardará de inmediato.",
        confirmLabel: "Quitar permisos",
      }))
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
      const updatedCatalog = await api.putRolePermissions(
        request,
        currentRole.name,
        requiredAdminPermissions,
        "No se pudieron quitar los permisos",
      );
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
      const savedRole = await api.saveRole(
        request,
        roleForm,
        editing ? editing.id : null,
      );
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
      !(await confirmAction({
        title: `¿Eliminar el rol ${currentRole.label}?`,
        message: "Esta acción no se puede deshacer.",
      }))
    ) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await api.deleteRole(request, currentRole.id);
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
      const updatedCatalog = await api.saveResource(
        request,
        resourceForm,
        editingResourceKey,
      );
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
      !(await confirmAction({
        title: `¿Eliminar el recurso "${resource.label}"?`,
        message: "También se quitarán sus permisos de todos los roles.",
      }))
    ) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const updatedCatalog = await api.deleteResource(request, resource.key);
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
        <ResourceForm
          resourceForm={resourceForm}
          setResourceForm={setResourceForm}
          editingResourceKey={editingResourceKey}
          matrixActions={matrixActions}
          saving={saving}
          onSubmit={(event) => void saveResource(event)}
          onCancel={() => {
            setResourceFormOpen(false);
            setEditingResourceKey(null);
          }}
        />
      )}
      {!canEditCurrentRole && (
        <p role="status">
          No tienes autorización para modificar los permisos de este rol.
        </p>
      )}
      {roleFormMode && (
        <RoleForm
          roleForm={roleForm}
          setRoleForm={setRoleForm}
          mode={roleFormMode}
          saving={saving}
          onSubmit={(event) => void saveRole(event)}
          onCancel={() => setRoleFormMode(null)}
        />
      )}
      {loading ? (
        <p role="status">Cargando permisos…</p>
      ) : (
        <>
          <PermissionMatrix
            resources={catalog?.resources ?? []}
            matrixActions={matrixActions}
            currentRole={currentRole}
            getResourceLabel={getResourceLabel}
            saving={saving}
            canUpdatePermissions={canUpdatePermissions}
            canDeleteRoles={canDeleteRoles}
            canEditCurrentRole={canEditCurrentRole}
            isPlatformSuperadmin={isPlatformSuperadmin}
            onEditResource={editResource}
            onDeleteResource={(resource) => void deleteResource(resource)}
            onToggle={togglePermission}
          />
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
