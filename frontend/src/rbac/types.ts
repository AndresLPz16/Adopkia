export const ROLES = {
  ADOPTER: "adoptante",
  SHELTER: "refugio",
  ADMIN: "administrador",
  VETERINARIAN: "veterinario",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const RESOURCES = {
  DASHBOARD: "dashboard",
  PETS: "pets",
  SHELTERS: "shelters",
  ADOPTION_REQUESTS: "adoptionRequests",
  ADOPTIONS: "adoptions",
  MEDICAL_RECORDS: "medicalRecords",
  CONVERSATIONS: "conversations",
  NOTIFICATIONS: "notifications",
  USERS: "users",
  STATISTICS: "statistics",
} as const;

export type Resource = (typeof RESOURCES)[keyof typeof RESOURCES];

export const ACTIONS = {
  READ: "read",
  CREATE: "create",
  UPDATE: "update",
  DELETE: "delete",
  APPROVE: "approve",
  REJECT: "reject",
  VERIFY: "verify",
  MANAGE: "manage",
} as const;

export type Action = (typeof ACTIONS)[keyof typeof ACTIONS];

export interface AuthUser {
  id: number | string;
  name: string;
  email: string;
  roles: readonly string[];
  active?: boolean;
}

export interface BackendUserProfile {
  id: number | string;
  name: string;
  email: string;
  role: string;
  active?: boolean;
}

export interface BackendRolePermissions {
  resource: string;
  action: string;
}

export interface PermissionRole {
  name: string;
  label: string;
  description: string | null;
  permissions: BackendRolePermissions[];
}

export interface PermissionCatalog {
  resources: {
    key: string;
    label: string;
    actions: { key: string; label: string }[];
  }[];
  roles: PermissionRole[];
}

export type AuthStatus =
  | "loading"
  | "authenticated"
  | "unauthenticated"
  | "error";
