import { can } from "../rbac/permissions";
import type { PermissionMap } from "../rbac/permissions";
import { ACTIONS, RESOURCES } from "../rbac/types";
import type { AuthUser } from "../rbac/types";
import { sectionAccess } from "./navigation";

/**
 * Devuelve la función que decide si la cuenta puede abrir una sección del
 * portal, según sus permisos de rol.
 */
export function sectionAccessFor(
  user: AuthUser | null,
  permissions: PermissionMap | null,
  isPlatformSuperadmin: boolean,
) {
  const granted = permissions ?? {};
  return (key: string): boolean => {
    if (key.startsWith("resource:")) {
      const resource = key.slice("resource:".length);
      return (
        can(user, resource, ACTIONS.READ, granted) ||
        can(user, RESOURCES.ROLE_PERMISSIONS, ACTIONS.MANAGE, granted)
      );
    }
    if (key === "requests") {
      return (
        can(user, RESOURCES.ADOPTION_REQUESTS, ACTIONS.READ, granted) ||
        can(user, RESOURCES.FORM_QUESTIONS, ACTIONS.CREATE, granted) ||
        can(user, RESOURCES.FORM_QUESTIONS, ACTIONS.UPDATE, granted) ||
        can(user, RESOURCES.FORM_QUESTIONS, ACTIONS.DELETE, granted)
      );
    }
    if (key === "permissions") {
      if (isPlatformSuperadmin) return true;
      return (sectionAccess.permissions ?? []).some(([resource, action]) =>
        can(user, RESOURCES[resource], ACTIONS[action], granted),
      );
    }
    return (sectionAccess[key] ?? []).every(([resource, action]) =>
      can(user, RESOURCES[resource], ACTIONS[action], granted),
    );
  };
}

/** Ruta del navegador para una sección del portal. */
export function sectionPath(key: string): string {
  if (key === "permissions") return "/admin/permissions";
  if (key.startsWith("resource:")) {
    return `/app/resources/${encodeURIComponent(key.slice("resource:".length))}`;
  }
  return `/app/${key}`;
}

/** Sección que corresponde a la ruta actual del navegador. */
export function sectionFromPath(pathname: string): {
  section: string;
  dynamicResourceKey: string;
} {
  const pathSegments = pathname.split("/").filter(Boolean);
  const dynamicResourceKey =
    pathSegments[1] === "resources" ? pathSegments[2] ?? "" : "";
  const section = dynamicResourceKey
    ? `resource:${dynamicResourceKey}`
    : pathname.startsWith("/admin/permissions")
      ? "permissions"
      : pathSegments[1] || "dashboard";
  return { section, dynamicResourceKey };
}
