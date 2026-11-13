import { ACTIONS, RESOURCES, ROLES } from "../rbac/types";
import type { Resource } from "../rbac/types";


export const roleNames: Record<string, string> = {
  [ROLES.ADOPTER]: "Adoptante",
  [ROLES.SHELTER]: "Refugio",
  [ROLES.ADMIN]: "Administración",
  [ROLES.VETERINARIAN]: "Veterinario",
};

export const sectionNames: Record<string, string> = {
  dashboard: "Inicio",
  pets: "Mascotas",
  vaccines: "Catálogo de vacunas",
  requests: "Solicitudes",
  adoptions: "Adopciones y cuidados",
  messages: "Mensajes",
  records: "Atención veterinaria",
  veterinarians: "Perfiles veterinarios",
  shelters: "Refugios y equipo",
  notifications: "Notificaciones",
  profile: "Mi perfil",
  users: "Usuarios",
  statistics: "Estadísticas",
};

export const roleSectionNames: Record<string, Record<string, string>> = {
  [ROLES.ADOPTER]: {
    pets: "Explorar mascotas",
    requests: "Mis solicitudes",
    adoptions: "Mis adopciones",
  },
  [ROLES.SHELTER]: {
    pets: "Mis mascotas",
    requests: "Solicitudes de adopción",
    shelters: "Mi refugio y equipo",
  },
  [ROLES.VETERINARIAN]: {
    records: "Expedientes médicos",
    adoptions: "Seguimientos",
  },
  [ROLES.ADMIN]: {
    shelters: "Refugios",
    requests: "Solicitudes de adopción",
    adoptions: "Adopciones y cuidados",
    messages: "Mensajes",
    records: "Atención veterinaria",
    veterinarians: "Perfiles veterinarios",
    notifications: "Notificaciones",
    users: "Usuarios y roles",
    permissions: "Permisos",
  },
};

export const roleSidebarCopy: Record<string, { heading: string; title: string; description: string }> = {
  [ROLES.ADOPTER]: {
    heading: "MI ADOPCIÓN",
    title: "Tu próxima historia",
    description: "Encuentra una mascota, conoce su perfil y sigue tu proceso de adopción.",
  },
  [ROLES.SHELTER]: {
    heading: "GESTIÓN DEL REFUGIO",
    title: "Herramientas del refugio",
    description: "Organiza perfiles, solicitudes y el trabajo de tu equipo.",
  },
  [ROLES.VETERINARIAN]: {
    heading: "ÁREA VETERINARIA",
    title: "Atención y seguimiento",
    description: "Consulta información clínica y mantén al día la atención de las mascotas.",
  },
  [ROLES.ADMIN]: {
    heading: "ADMINISTRACIÓN",
    title: "Control de plataforma",
    description: "Supervisa el estado de Adopkia y administra sus participantes.",
  },
};

// Permisos que debe tener un rol para ver cada sección del portal.
export const sectionAccess: Record<
  string,
  [keyof typeof RESOURCES, keyof typeof ACTIONS][]
> = {
  dashboard: [["DASHBOARD", "READ"]],
  profile: [["PROFILE", "READ"]],
  pets: [["PETS", "READ"]],
  vaccines: [["VACCINES", "READ"]],
  requests: [["ADOPTION_REQUESTS", "READ"]],
  adoptions: [["ADOPTIONS", "READ"]],
  messages: [["MESSAGING", "READ"]],
  records: [["MEDICAL_RECORDS", "READ"]],
  veterinarians: [["VETERINARIANS", "READ"]],
  shelters: [["SHELTERS", "READ"]],
  notifications: [["NOTIFICATIONS", "READ"]],
  users: [["USERS", "READ"]],
  statistics: [["STATISTICS", "READ"]],
  permissions: [
    ["ROLE_PERMISSIONS", "READ"],
    ["ROLE_PERMISSIONS", "CREATE"],
    ["ROLE_PERMISSIONS", "UPDATE"],
    ["ROLE_PERMISSIONS", "DELETE"],
    ["ROLE_PERMISSIONS", "MANAGE"],
  ],
};

export const allSections = [
  "dashboard",
  "profile",
  "pets",
  "vaccines",
  "requests",
  "adoptions",
  "messages",
  "records",
  "veterinarians",
  "shelters",
  "notifications",
  "users",
  "statistics",
  "permissions",
];

// Secciones que cada rol ve siempre; el resto depende de sus permisos.
export function linksForRole(role: string, isPlatformSuperadmin: boolean): string[] {
  if (role === ROLES.ADOPTER) {
    return [
      "dashboard",
      "pets",
      "requests",
      "adoptions",
      "messages",
      "notifications",
      "profile",
    ];
  }
  if (role === ROLES.SHELTER) {
    return [
      "dashboard",
      "pets",
      "requests",
      "adoptions",
      "messages",
      "shelters",
      "notifications",
      "profile",
    ];
  }
  if (role === ROLES.VETERINARIAN) {
    return [
      "dashboard",
      "records",
      "veterinarians",
      "adoptions",
      "notifications",
      "profile",
    ];
  }
  return [
    "dashboard",
    "shelters",
    "statistics",
    "users",
    "permissions",
    "profile",
    ...(isPlatformSuperadmin
      ? ["requests", "adoptions", "messages", "records", "notifications"]
      : []),
  ];
}

export type SidebarGroup = { key: string; label: string; sections: string[] };

export const sidebarGroupDefinitions: SidebarGroup[] = [
  { key: "home", label: "General", sections: ["dashboard"] },
  { key: "adoption", label: "Adopción", sections: ["pets", "requests", "adoptions"] },
  {
    key: "care",
    label: "Atención y seguimiento",
    sections: ["messages", "records", "veterinarians", "vaccines"],
  },
  {
    key: "management",
    label: "Gestión",
    sections: ["shelters", "users", "statistics", "permissions"],
  },
  { key: "account", label: "Mi cuenta", sections: ["notifications", "profile"] },
];

export const sidebarGroupIcons: Record<string, string> = {
  home: "⌂",
  adoption: "♡",
  care: "✚",
  management: "▦",
  account: "◉",
  "custom-resources": "◇",
};

// Endpoints que carga cada sección; el panel de inicio varía según el rol.
export function pathsForRole(role: string): Record<string, string[]> {
  return {
    dashboard:
      role === ROLES.ADMIN
        ? ["/api/v1/shelters/", "/api/v1/statistics/adoptions/", "/api/v1/notifications/"]
        : role === ROLES.VETERINARIAN
          ? [
              "/api/v1/medical-records/",
              "/api/v1/pets/",
              "/api/v1/vaccines/",
              "/api/v1/notifications/",
            ]
          : role === ROLES.SHELTER
            ? [
                "/api/v1/pets/",
                "/api/v1/adoption-requests/",
                "/api/v1/adoptions/",
                "/api/v1/notifications/",
                "/api/v1/shelter-members/",
              ]
        : [
            "/api/v1/pets/",
            "/api/v1/adoption-requests/",
            "/api/v1/adoptions/",
            "/api/v1/notifications/",
          ],
    pets: ["/api/v1/pets/", "/api/v1/shelters/", "/api/v1/breeds/", "/api/v1/shelter-members/"],
    vaccines: ["/api/v1/vaccines/", "/api/v1/species/"],
    requests: ["/api/v1/adoption-requests/", "/api/v1/form-questions/"],
    adoptions: [
      "/api/v1/adoptions/",
      "/api/v1/follow-ups/",
      "/api/v1/reminders/",
    ],
    messages: ["/api/v1/conversations/", "/api/v1/messages/"],
    records: [
      "/api/v1/medical-records/",
      "/api/v1/pets/",
      "/api/v1/vaccines/",
      "/api/v1/veterinarians/",
    ],
    veterinarians: ["/api/v1/veterinarians/"],
    shelters: ["/api/v1/shelters/", "/api/v1/shelter-members/"],
    notifications: ["/api/v1/notifications/"],
    profile: ["/api/v1/auth/me/"],
    users: ["/api/v1/auth/users/", "/api/v1/auth/roles/"],
    statistics: ["/api/v1/statistics/adoptions/"],
  };
}

// Recurso RBAC cuya lectura se exige antes de consultar cada endpoint.
export const endpointResources: Record<string, Resource> = {
  "/api/v1/pets/": RESOURCES.PETS,
  "/api/v1/shelters/": RESOURCES.SHELTERS,
  "/api/v1/breeds/": RESOURCES.PETS,
  "/api/v1/shelter-members/": RESOURCES.SHELTER_MEMBERS,
  "/api/v1/adoption-requests/": RESOURCES.ADOPTION_REQUESTS,
  "/api/v1/form-questions/": RESOURCES.FORM_QUESTIONS,
  "/api/v1/adoptions/": RESOURCES.ADOPTIONS,
  "/api/v1/follow-ups/": RESOURCES.FOLLOW_UPS,
  "/api/v1/reminders/": RESOURCES.REMINDERS,
  "/api/v1/conversations/": RESOURCES.MESSAGING,
  "/api/v1/messages/": RESOURCES.MESSAGING,
  "/api/v1/medical-records/": RESOURCES.MEDICAL_RECORDS,
  "/api/v1/vaccines/": RESOURCES.VACCINES,
  "/api/v1/veterinarians/": RESOURCES.VETERINARIANS,
  "/api/v1/notifications/": RESOURCES.NOTIFICATIONS,
  "/api/v1/auth/users/": RESOURCES.USERS,
  "/api/v1/auth/roles/": RESOURCES.USERS,
  "/api/v1/auth/me/": RESOURCES.PROFILE,
  "/api/v1/statistics/adoptions/": RESOURCES.STATISTICS,
};

// Listas que puede cambiar una escritura sobre cada recurso de la API. Tras
// guardar se recargan solo estas, no toda la sección. Un recurso que no esté
// aquí provoca la recarga completa, que siempre es correcta.
const mutationEffects: Record<string, string[]> = {
  pets: ["/api/v1/pets/"],
  "pet-photos": ["/api/v1/pets/"],
  shelters: ["/api/v1/shelters/", "/api/v1/shelter-members/", "/api/v1/pets/"],
  "shelter-members": ["/api/v1/shelter-members/", "/api/v1/shelters/"],
  "form-questions": ["/api/v1/form-questions/"],
  "adoption-requests": [
    "/api/v1/adoption-requests/",
    "/api/v1/adoptions/",
    "/api/v1/pets/",
    "/api/v1/notifications/",
    "/api/v1/statistics/adoptions/",
  ],
  adoptions: [
    "/api/v1/adoptions/",
    "/api/v1/pets/",
    "/api/v1/follow-ups/",
    "/api/v1/reminders/",
    "/api/v1/statistics/adoptions/",
  ],
  "follow-ups": ["/api/v1/follow-ups/"],
  reminders: ["/api/v1/reminders/"],
  conversations: ["/api/v1/conversations/", "/api/v1/messages/"],
  messages: [
    "/api/v1/messages/",
    "/api/v1/conversations/",
    "/api/v1/notifications/",
  ],
  "medical-records": ["/api/v1/medical-records/", "/api/v1/reminders/"],
  vaccines: ["/api/v1/vaccines/"],
  veterinarians: ["/api/v1/veterinarians/"],
  notifications: ["/api/v1/notifications/"],
  "auth/users": ["/api/v1/auth/users/"],
  "auth/roles": ["/api/v1/auth/roles/", "/api/v1/auth/users/"],
  "auth/me": ["/api/v1/auth/me/"],
};

export function endpointsAffectedBy(endpoint: string): string[] | null {
  const match = endpoint.match(/^\/api\/v1\/((?:auth\/)?[a-z-]+)\//);
  return match ? mutationEffects[match[1]] ?? null : null;
}
