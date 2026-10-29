export const ROLES = {
  ADOPTER: "adoptante",
  SHELTER: "refugio",
  ADMIN: "administrador",
  VETERINARIAN: "veterinario",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const RESOURCES = {
  DASHBOARD: "dashboard",
  PROFILE: "profile",
  PETS: "pets",
  PET_PHOTOS: "petPhotos",
  SHELTERS: "shelters",
  SHELTER_MEMBERS: "shelterMembers",
  FORM_QUESTIONS: "formQuestions",
  ADOPTION_REQUESTS: "adoptionRequests",
  ADOPTIONS: "adoptions",
  FOLLOW_UPS: "followUps",
  VETERINARIANS: "veterinarians",
  MEDICAL_RECORDS: "medicalRecords",
  VACCINES: "vaccines",
  REMINDERS: "reminders",
  CONVERSATIONS: "conversations",
  MESSAGES: "messages",
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
  RETURN: "return",
  MANAGE: "manage",
} as const;

export type Action = (typeof ACTIONS)[keyof typeof ACTIONS];

export interface AuthUser {
  id: number | string;
  name: string;
  email: string;
  roles: readonly string[];
  active?: boolean;
  isPlatformSuperadmin?: boolean;
}

export interface BackendUserProfile {
  id: number | string;
  name: string;
  email: string;
  role: string;
  active?: boolean;
  is_platform_superadmin?: boolean;
}

export interface BackendRolePermissions {
  resource: string;
  action: string;
}

export interface PermissionRole {
  id: number | string;
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
