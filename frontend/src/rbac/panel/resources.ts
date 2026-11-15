import type { PermissionCatalog, PermissionRole } from "../types";
import { RESOURCES } from "../types";

export type CatalogResource = PermissionCatalog["resources"][number];
export type CatalogAction = CatalogResource["actions"][number];
export type ResourceFormState = { key: string; label: string; actions: string[] };
export type RoleFormState = { name: string; label: string; description: string };

// Sección del menú lateral que corresponde a cada recurso: si la sección tiene
// un nombre personalizado, la matriz lo muestra en lugar del nombre del recurso.
export const sidebarSectionByResource: Record<string, string> = {
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

/** Recursos que trae la aplicación; los demás los creó un administrador. */
export const systemResourceKeys = new Set<string>(Object.values(RESOURCES));

export function rolePermissionsToPayload(role: PermissionRole) {
  return role.permissions.map(({ resource, action }) => ({ resource, action }));
}

/**
 * Marca o desmarca una acción de un recurso en el rol y devuelve sus permisos.
 *
 * "manage" incluye a todas las demás: al marcarlo se sustituyen por él, y al
 * desmarcar una acción suelta estando "manage" activo, este se reparte en las
 * acciones individuales menos la que se quitó.
 */
export function toggleRolePermission(
  role: PermissionRole,
  resourceActions: readonly CatalogAction[],
  resource: string,
  action: string,
): PermissionRole["permissions"] {
  const permissions = new Map<string, { resource: string; action: string }>();
  for (const permission of role.permissions) {
    permissions.set(`${permission.resource}:${permission.action}`, permission);
  }
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

  return Array.from(permissions.values()) as PermissionRole["permissions"];
}
