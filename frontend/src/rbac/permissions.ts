import { ACTIONS, RESOURCES, ROLES } from "./types";
import type { Action, AuthUser, Resource, Role } from "./types";

export type RolePermissions = Partial<Record<string, readonly string[]>>;
export type PermissionMap = Readonly<Record<string, RolePermissions>>;

export const ROLE_PERMISSIONS: PermissionMap = {
  [ROLES.ADOPTER]: {
    [RESOURCES.DASHBOARD]: [ACTIONS.READ],
    [RESOURCES.PETS]: [ACTIONS.READ],
    [RESOURCES.SHELTERS]: [ACTIONS.READ],
    [RESOURCES.ADOPTION_REQUESTS]: [
      ACTIONS.READ,
      ACTIONS.CREATE,
      ACTIONS.UPDATE,
    ],
    [RESOURCES.ADOPTIONS]: [ACTIONS.READ],
    [RESOURCES.MEDICAL_RECORDS]: [ACTIONS.READ],
    [RESOURCES.CONVERSATIONS]: [ACTIONS.READ, ACTIONS.CREATE],
    [RESOURCES.NOTIFICATIONS]: [ACTIONS.READ],
  },
  [ROLES.SHELTER]: {
    [RESOURCES.DASHBOARD]: [ACTIONS.READ],
    [RESOURCES.PETS]: [
      ACTIONS.READ,
      ACTIONS.CREATE,
      ACTIONS.UPDATE,
      ACTIONS.DELETE,
    ],
    [RESOURCES.SHELTERS]: [ACTIONS.READ, ACTIONS.UPDATE],
    [RESOURCES.ADOPTION_REQUESTS]: [
      ACTIONS.READ,
      ACTIONS.APPROVE,
      ACTIONS.REJECT,
    ],
    [RESOURCES.ADOPTIONS]: [ACTIONS.READ],
    [RESOURCES.MEDICAL_RECORDS]: [ACTIONS.READ],
    [RESOURCES.CONVERSATIONS]: [ACTIONS.READ, ACTIONS.CREATE],
    [RESOURCES.NOTIFICATIONS]: [ACTIONS.READ],
  },
  [ROLES.VETERINARIAN]: {
    [RESOURCES.DASHBOARD]: [ACTIONS.READ],
    [RESOURCES.PETS]: [ACTIONS.READ],
    [RESOURCES.ADOPTIONS]: [ACTIONS.READ],
    [RESOURCES.MEDICAL_RECORDS]: [
      ACTIONS.READ,
      ACTIONS.CREATE,
      ACTIONS.UPDATE,
    ],
    [RESOURCES.NOTIFICATIONS]: [ACTIONS.READ],
  },
  [ROLES.ADMIN]: {
    [RESOURCES.DASHBOARD]: [ACTIONS.READ],
    [RESOURCES.PETS]: [ACTIONS.MANAGE],
    [RESOURCES.SHELTERS]: [ACTIONS.MANAGE, ACTIONS.VERIFY],
    [RESOURCES.ADOPTION_REQUESTS]: [ACTIONS.MANAGE],
    [RESOURCES.ADOPTIONS]: [ACTIONS.MANAGE],
    [RESOURCES.MEDICAL_RECORDS]: [ACTIONS.MANAGE],
    [RESOURCES.CONVERSATIONS]: [ACTIONS.MANAGE],
    [RESOURCES.NOTIFICATIONS]: [ACTIONS.MANAGE],
    [RESOURCES.USERS]: [ACTIONS.MANAGE],
    [RESOURCES.STATISTICS]: [ACTIONS.READ],
  },
};

/**
 * Frontend permissions are for presentation only. Every protected API
 * operation must independently authorize the authenticated user on the server.
 */
export function can(
  user: Pick<AuthUser, "roles"> & Partial<Pick<AuthUser, "active">> | null | undefined,
  resource: Resource,
  action: Action,
  permissions: PermissionMap = ROLE_PERMISSIONS,
): boolean {
  if (!user || user.active === false) return false;

  return user.roles.some((role) => {
    const allowed = permissions[role]?.[resource] ?? [];
    return allowed.includes(action) || allowed.includes(ACTIONS.MANAGE);
  });
}
