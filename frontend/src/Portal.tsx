import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./rbac/auth";
import { RolePermissionsPanel } from "./rbac";
import { can } from "./rbac/permissions";
import { ACTIONS, RESOURCES, ROLES } from "./rbac/types";
import type { Action, Resource } from "./rbac/types";
import {
  isAvailablePet,
  labelStatus,
  responseData,
  rows,
  text,
} from "./portal/shared";
import type { PortalDataRow, PortalPetSaver } from "./portal/shared";
import {
  NotificationsSection,
  ProfileSection,
} from "./portal/AccountSections";
import {
  DashboardSection,
  StatisticsSection,
} from "./portal/OverviewSections";
import { PetsSection, RequestsSection } from "./portal/PetSections";
import {
  AdoptionsSection,
  MessagesSection,
  RecordsSection,
  VaccineCatalogSection,
  VeterinariansSection,
} from "./portal/CareSections";
import { SheltersSection, UsersSection } from "./portal/ManagementSections";
import { loadSectionData } from "./portal/loadSectionData";

const roleNames: Record<string, string> = {
  [ROLES.ADOPTER]: "Adoptante",
  [ROLES.SHELTER]: "Refugio",
  [ROLES.ADMIN]: "Administración",
  [ROLES.VETERINARIAN]: "Veterinario",
};

const sectionNames: Record<string, string> = {
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

const roleSectionNames: Record<string, Record<string, string>> = {
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

const roleSidebarCopy: Record<string, { heading: string; title: string; description: string }> = {
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

function Portal({ onLogout }: { onLogout: () => void }) {
  const { user, status, request, permissions } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const role = user?.roles[0] ?? "";
  const isAdmin = role === ROLES.ADMIN;
  const isPlatformSuperadmin = user?.isPlatformSuperadmin === true;
  const pathSegments = location.pathname.split("/").filter(Boolean);
  const dynamicResourceKey =
    pathSegments[1] === "resources" ? pathSegments[2] ?? "" : "";
  const section = dynamicResourceKey
    ? `resource:${dynamicResourceKey}`
    : location.pathname.startsWith("/admin/permissions")
      ? "permissions"
      : pathSegments[1] || "dashboard";
  const sectionAccess: Record<
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
  const hasAccess = (key: string) => {
    if (key.startsWith("resource:")) {
      const resource = key.slice("resource:".length);
      return (
        can(user, resource, ACTIONS.READ, permissions ?? {}) ||
        can(user, RESOURCES.ROLE_PERMISSIONS, ACTIONS.MANAGE, permissions ?? {})
      );
    }
    if (key === "requests") {
      return (
        can(user, RESOURCES.ADOPTION_REQUESTS, ACTIONS.READ, permissions ?? {}) ||
        can(user, RESOURCES.FORM_QUESTIONS, ACTIONS.CREATE, permissions ?? {}) ||
        can(user, RESOURCES.FORM_QUESTIONS, ACTIONS.UPDATE, permissions ?? {}) ||
        can(user, RESOURCES.FORM_QUESTIONS, ACTIONS.DELETE, permissions ?? {})
      );
    }
    if (key === "permissions") {
      return (sectionAccess.permissions ?? []).some(([resource, action]) =>
        can(user, RESOURCES[resource], ACTIONS[action], permissions ?? {}),
      );
    }
    return (sectionAccess[key] ?? []).every(([resource, action]) =>
      can(user, RESOURCES[resource], ACTIONS[action], permissions ?? {}),
    );
  };
  const canDo = (resource: Resource, action: Action) =>
    can(user, resource, action, permissions ?? {});

  const [data, setData] = useState<Record<string, unknown>>({});
  const [customSectionNames, setCustomSectionNames] = useState<Record<string, string>>({});
  const [dynamicResources, setDynamicResources] = useState<
    { key: string; label: string }[]
  >([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selectedConversation, setSelectedConversation] = useState("");
  const [editingPet, setEditingPet] = useState("");
  const [editingShelter, setEditingShelter] = useState("");
  const [editingUser, setEditingUser] = useState("");
  const [petSearch, setPetSearch] = useState("");
  const [requestedPetId, setRequestedPetId] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const dynamicResourceSections = dynamicResources.map(
    (resource) => `resource:${resource.key}`,
  );

  const links = useMemo(() => {
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
  }, [isPlatformSuperadmin, role]);
  const allSections = [
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
  const visibleLinks = useMemo(
    () => [
      ...new Set([
        ...links,
        ...allSections.filter(hasAccess),
        ...dynamicResourceSections.filter(hasAccess),
      ]),
    ].filter(hasAccess),
    [dynamicResources, links, permissions, user],
  );
  const sidebarGroups = [
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
  ]
    .map((group) => ({
      ...group,
      sections: group.sections.filter((key) => visibleLinks.includes(key)),
    }))
    .filter((group) => group.sections.length > 0);
  const visibleDynamicResources = dynamicResources.filter((resource) =>
    visibleLinks.includes(`resource:${resource.key}`),
  );
  if (visibleDynamicResources.length > 0) {
    sidebarGroups.push({
      key: "custom-resources",
      label: "Recursos",
      sections: visibleDynamicResources.map(
        (resource) => `resource:${resource.key}`,
      ),
    });
  }

  const pathsForSection: Record<string, string[]> = {
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

  const reload = useCallback(async () => {
    if (section === "permissions") {
      setData({});
      return;
    }
    const endpoints = pathsForSection[section];
    if (!endpoints || !visibleLinks.includes(section)) return;
    const endpointResources: Record<string, Resource> = {
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
    const allowedEndpoints = endpoints.filter((endpoint) => {
      if (["/api/v1/form-questions/", "/api/v1/vaccines/", "/api/v1/species/"].includes(endpoint)) {
        return true;
      }
      const resource = endpointResources[endpoint];
      return resource && canDo(resource, ACTIONS.READ);
    });
    setLoading(true);
    setError("");
    try {
      const { data: loadedData, failures } = await loadSectionData(
        allowedEndpoints.map((endpoint) => ({
          key: endpoint,
          load: async () => {
            const suffix =
              endpoint === "/api/v1/messages/" && selectedConversation
                ? `?conversation=${encodeURIComponent(selectedConversation)}`
                : "";
            const response = await request(`${endpoint}${suffix}`);
            return responseData(response);
          },
        })),
      );
      setData((current) => {
        const next = { ...current, ...loadedData };
        failures.forEach(({ key }) => {
          delete next[key];
        });
        return next;
      });
      if (failures.length > 0) {
        const details = failures
          .map(({ key, message }) => `${key}: ${message}`)
          .join(" · ");
        setError(`No se pudieron cargar algunos datos. ${details}`);
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudieron cargar los datos de esta sección.",
      );
    } finally {
      setLoading(false);
    }
  }, [request, section, selectedConversation, visibleLinks, permissions, user]);

  useEffect(() => {
    if (status === "unauthenticated") onLogout();
  }, [status, onLogout]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const controller = new AbortController();
    void request("/api/v1/auth/sidebar-labels/", { signal: controller.signal })
      .then(responseData)
      .then((result) => {
        if (
          result &&
          typeof result === "object" &&
          "labels" in result &&
          result.labels &&
          typeof result.labels === "object"
        ) {
          setCustomSectionNames(result.labels as Record<string, string>);
        } else {
          throw new Error("La respuesta de nombres del menú tiene un formato inválido.");
        }
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) {
          setError(caught instanceof Error ? caught.message : "No se pudieron cargar los nombres del menú.");
        }
      });
    return () => controller.abort();
  }, [request, status]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const controller = new AbortController();
    void request("/api/v1/auth/permissions/", { signal: controller.signal })
      .then(responseData)
      .then((result) => {
        if (
          !result ||
          typeof result !== "object" ||
          !("resources" in result) ||
          !Array.isArray(result.resources)
        ) {
          throw new Error("La respuesta de recursos tiene un formato inválido.");
        }
        const staticResources = new Set(Object.values(RESOURCES));
        const resources = result.resources.filter(
          (resource): resource is { key: string; label: string } =>
            Boolean(
              resource &&
                typeof resource === "object" &&
                "key" in resource &&
                typeof resource.key === "string" &&
                !staticResources.has(resource.key) &&
                "label" in resource &&
                typeof resource.label === "string",
            ),
        );
        setDynamicResources(resources);
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            caught instanceof Error
              ? caught.message
              : "No se pudieron cargar los recursos dinámicos.",
          );
        }
      });
    return () => controller.abort();
  }, [request, status]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    setForm({});
    setAnswers({});
    setEditingPet("");
    setEditingShelter("");
    setEditingUser("");
    setSelectedConversation("");
    setError("");
    setNotice("");
  }, [section]);

  const setValue = (name: string, value: string) => {
    setForm((current) => ({ ...current, [name]: value }));
  };

  const send = async (
    endpoint: string,
    method: string,
    body?: unknown,
    successMessage = "Cambios guardados correctamente.",
  ): Promise<boolean> => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await request(endpoint, {
        method,
        headers: body === undefined ? undefined : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      await responseData(response);
      setNotice(successMessage);
      setForm({});
      setAnswers({});
      setEditingPet("");
      setEditingShelter("");
      setEditingUser("");
      await reload();
      return true;
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "No se pudo completar la acción.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  };

  const savePet: PortalPetSaver = async (
    endpoint,
    method,
    body,
    photoUrls,
    photoFiles,
  ) => {
    setBusy(true);
    setError("");
    setNotice("");
    let petWasSaved = false;
    let petId = "";
    let uploadedPhotos = 0;
    const totalPhotos = photoUrls.length + photoFiles.length;
    try {
      const petResponse = await request(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const petData = await responseData(petResponse);
      petWasSaved = true;
      if (
        petData &&
        typeof petData === "object" &&
        "id" in petData &&
        (typeof petData.id === "number" || typeof petData.id === "string")
      ) {
        petId = String(petData.id);
      }

      if (totalPhotos > 0 && !petId) {
        throw new Error("No se pudo identificar la mascota para asociar sus fotos.");
      }

      const uploadPhoto = async (formData: FormData) => {
        formData.append("pet", petId);
        const response = await request("/api/v1/pet-photos/", {
          method: "POST",
          body: formData,
        });
        await responseData(response);
        uploadedPhotos += 1;
      };

      for (const url of photoUrls) {
        const formData = new FormData();
        formData.append("url", url);
        await uploadPhoto(formData);
      }
      for (const file of photoFiles) {
        const formData = new FormData();
        formData.append("image", file);
        await uploadPhoto(formData);
      }

      setNotice(
        totalPhotos > 0
          ? `Perfil de mascota guardado con ${totalPhotos} ${totalPhotos === 1 ? "foto" : "fotos"}.`
          : "Perfil de mascota guardado.",
      );
      setForm({});
      setEditingPet("");
      await reload();
      return true;
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : "No se pudo completar la publicación de la mascota.";
      if (petWasSaved) {
        setEditingPet(petId);
        await reload();
        setError(
          uploadedPhotos > 0
            ? `La mascota se guardó, pero solo se pudieron guardar ${uploadedPhotos} de ${totalPhotos} fotos. ${message}`
            : `La mascota se guardó, pero no se pudieron guardar sus fotos. ${message}`,
        );
      } else {
        setError(message);
      }
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submit = (callback: () => Promise<void>) => (event: FormEvent) => {
    event.preventDefault();
    void callback();
  };

  const pets = rows(data["/api/v1/pets/"]);
  const shelters = rows(data["/api/v1/shelters/"]);
  const breeds = rows(data["/api/v1/breeds/"]);
  const questions = rows(data["/api/v1/form-questions/"]);
  const requests = rows(data["/api/v1/adoption-requests/"]);
  const adoptions = rows(data["/api/v1/adoptions/"]);
  const followUps = rows(data["/api/v1/follow-ups/"]);
  const reminders = rows(data["/api/v1/reminders/"]);
  const conversations = rows(data["/api/v1/conversations/"]);
  const messages = rows(data["/api/v1/messages/"]);
  const records = rows(data["/api/v1/medical-records/"]);
  const vaccines = rows(data["/api/v1/vaccines/"]);
  const species = rows(data["/api/v1/species/"]);
  const veterinarians = rows(data["/api/v1/veterinarians/"]);
  const members = rows(data["/api/v1/shelter-members/"]);
  const notifications = rows(data["/api/v1/notifications/"]);
  const users = rows(data["/api/v1/auth/users/"]);
  const availableRoleRows = rows(data["/api/v1/auth/roles/"]);
  const profile = data["/api/v1/auth/me/"] as PortalDataRow | undefined;
  const myShelterIds = new Set(
    members
      .filter((member) => text(member.user) === text(user?.id))
      .map((member) => text(member.shelter)),
  );
  const managedPets =
    role === ROLES.SHELTER
      ? pets.filter((pet) => myShelterIds.has(text(pet.shelter)))
      : pets;
  const managedShelters =
    role === ROLES.SHELTER
      ? shelters.filter((shelter) => myShelterIds.has(text(shelter.id)))
      : shelters;
  const visiblePets = (role === ROLES.ADOPTER
    ? pets.filter(isAvailablePet)
    : managedPets
  ).filter((pet) =>
    [pet.name, pet.species, pet.city, pet.temperament]
      .map(text)
      .join(" ")
      .toLocaleLowerCase()
      .includes(petSearch.trim().toLocaleLowerCase()),
  );
  const sidebarCopy = roleSidebarCopy[role] ?? {
    heading: "MI ESPACIO",
    title: "Adopkia",
    description: "Un hogar y una segunda oportunidad para cada mascota.",
  };
  const visibleSectionNames = {
    ...sectionNames,
    ...roleSectionNames[role],
    ...customSectionNames,
    ...Object.fromEntries(
      dynamicResources.map((resource) => [
        `resource:${resource.key}`,
        resource.label,
      ]),
    ),
  };

  useEffect(() => {
    if (
      section === "messages" &&
      !selectedConversation &&
      conversations.length > 0
    ) {
      setSelectedConversation(text(conversations[0].id));
    }
  }, [conversations, section, selectedConversation]);

  const navTo = (key: string) =>
    navigate(
      key === "permissions"
        ? "/admin/permissions"
        : key.startsWith("resource:")
          ? `/app/resources/${encodeURIComponent(key.slice("resource:".length))}`
          : `/app/${key}`,
    );

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  const unreadNotifications = useMemo(
    () => notifications.filter((item) => item.is_read !== true),
    [notifications],
  );
  const unreadNotificationsCount = unreadNotifications.length;

  useEffect(() => {
    if (!notificationsOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNotificationsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [notificationsOpen]);

  if (status === "error") {
    return (
      <main className="login">
        <div className="login__card">
          <p role="alert">No se pudo verificar la sesión. Comprueba que el backend esté disponible.</p>
          <button type="button" onClick={onLogout}>Volver a iniciar sesión</button>
        </div>
      </main>
    );
  }
  if (status === "loading" || !user) {
    return <p className="app-loading" role="status">Verificando tu cuenta…</p>;
  }
  if (!visibleLinks.includes(section)) {
    return <Navigate to="/app/dashboard" replace />;
  }

  const stats = data["/api/v1/statistics/adoptions/"] as PortalDataRow | undefined;
  const activeDynamicResource = dynamicResources.find(
    (resource) => resource.key === dynamicResourceKey,
  );
  const content = activeDynamicResource
    ? (
      <section className="portal-section" aria-labelledby="dynamic-resource-title">
        <p className="portal-eyebrow">Recurso RBAC</p>
        <h1 id="dynamic-resource-title">{activeDynamicResource.label}</h1>
        <p>
          Este recurso ya está disponible en la matriz de permisos. Su vista y
          funcionalidad específica todavía deben implementarse.
        </p>
      </section>
    )
    : section === "permissions"
    ? (
      <RolePermissionsPanel
        onSidebarLabelsChange={setCustomSectionNames}
        onResourcesChange={setDynamicResources}
      />
    )
    : section === "dashboard"
      ? <DashboardSection
          userName={user.name}
          role={role}
          roleName={roleNames[role] ?? ""}
          isAdmin={isAdmin}
          shelters={shelters}
          pets={pets}
          managedPets={managedPets}
          records={records}
          vaccines={vaccines}
          requests={requests}
          adoptions={adoptions}
          notifications={notifications}
          stats={stats}
          visibleLinks={visibleLinks}
          sectionNames={visibleSectionNames}
          navTo={navTo}
        />
      : section === "pets"
          ? <PetsSection
              role={role}
              canDo={canDo}
              visiblePets={visiblePets}
              managedShelters={managedShelters}
              breeds={breeds}
              form={form}
              setValue={setValue}
              submit={submit}
              savePet={savePet}
              send={send}
              setForm={setForm}
              editingPet={editingPet}
              setEditingPet={setEditingPet}
              busy={busy}
              loading={loading}
              petSearch={petSearch}
              setPetSearch={setPetSearch}
              onRequestAdoption={(petId) => {
                setRequestedPetId(petId);
                navTo("requests");
              }}
            />
          : section === "requests"
            ? <RequestsSection
                role={role}
                isPlatformSuperadmin={isPlatformSuperadmin}
                canDo={canDo}
                questions={questions}
                pets={pets}
                requests={requests}
                requestedPetId={requestedPetId}
                onRequestSubmitted={() => setRequestedPetId("")}
                form={form}
                answers={answers}
                setAnswers={setAnswers}
                setValue={setValue}
                submit={submit}
                send={send}
                setError={setError}
                loading={loading}
                busy={busy}
              />
          : section === "adoptions"
            ? <AdoptionsSection
                role={role}
                isPlatformSuperadmin={isPlatformSuperadmin}
                canDo={canDo}
                adoptions={adoptions}
                followUps={followUps}
                reminders={reminders}
                vaccines={vaccines}
                form={form}
                setValue={setValue}
                submit={submit}
                send={send}
                loading={loading}
                busy={busy}
              />
            : section === "messages"
              ? <MessagesSection
                  role={role}
                  isPlatformSuperadmin={isPlatformSuperadmin}
                  canDo={canDo}
                  userId={user.id}
                  pets={pets}
                  conversations={conversations}
                  messages={messages}
                  selectedConversation={selectedConversation}
                  setSelectedConversation={setSelectedConversation}
                  form={form}
                  setValue={setValue}
                  submit={submit}
                  send={send}
                  setError={setError}
                  loading={loading}
                  busy={busy}
                />
              : section === "records"
                ? <RecordsSection
                    role={role}
                      isPlatformSuperadmin={isPlatformSuperadmin}
                      canDo={canDo}
                    userId={user.id}
                    pets={pets}
                    records={records}
                    vaccines={vaccines}
                    veterinarians={veterinarians}
                    form={form}
                    setValue={setValue}
                    submit={submit}
                    send={send}
                    loading={loading}
                    busy={busy}
                  />
                : section === "veterinarians"
                  ? <VeterinariansSection veterinarians={veterinarians} loading={loading} />
                    : section === "vaccines"
                      ? <VaccineCatalogSection
                          vaccines={vaccines}
                          species={species}
                          canDo={canDo}
                          send={send}
                          loading={loading}
                          busy={busy}
                        />
                : section === "shelters"
                  ? <SheltersSection
                      role={role}
                      userId={user.id}
                      canDo={canDo}
                      shelters={shelters}
                      members={members}
                      form={form}
                      setForm={setForm}
                      setValue={setValue}
                      submit={submit}
                      send={send}
                      editingShelter={editingShelter}
                      setEditingShelter={setEditingShelter}
                      loading={loading}
                      busy={busy}
                    />
                  : section === "notifications"
                    ? <NotificationsSection
                        notifications={notifications}
                        loading={loading}
                        send={send}
                        isPlatformSuperadmin={isPlatformSuperadmin}
                      />
                    : section === "profile"
                      ? <ProfileSection
                          profile={profile}
                          role={role}
                          roleName={roleNames[role] ?? role}
                          form={form}
                          setValue={setValue}
                          submit={submit}
                          send={send}
                          busy={busy}
                        />
                      : section === "users"
                        ? <UsersSection
                            userId={user.id}
                            isPlatformSuperadmin={isPlatformSuperadmin}
                            canDo={canDo}
                            users={users}
                            availableRoleRows={availableRoleRows}
                            form={form}
                            setForm={setForm}
                            setValue={setValue}
                            submit={submit}
                            send={send}
                            editingUser={editingUser}
                            setEditingUser={setEditingUser}
                            roleNames={roleNames}
                            loading={loading}
                            busy={busy}
                            setError={setError}
                          />
                      : section === "statistics"
                        ? <StatisticsSection stats={stats} />
                        : <DashboardSection
                            userName={user.name}
                            role={role}
                            roleName={roleNames[role] ?? ""}
                            isAdmin={isAdmin}
                            shelters={shelters}
                            pets={pets}
                            managedPets={managedPets}
                            records={records}
                            vaccines={vaccines}
                            requests={requests}
                            adoptions={adoptions}
                            notifications={notifications}
                            stats={stats}
                            visibleLinks={visibleLinks}
                            sectionNames={visibleSectionNames}
                            navTo={navTo}
                          />;

  const markAllNotificationsAsRead = async () => {
    for (const item of unreadNotifications) {
      await send(
        `/api/v1/notifications/${text(item.id)}/`,
        "PATCH",
        { is_read: true },
      );
    }
    setNotice("Todas las notificaciones fueron marcadas como leídas.");
  };

  return (
    <div className="app-shell" data-role={role}>
      <header className="app-header">
        <button className="app-header__brand" type="button" onClick={() => navTo("dashboard")}>
          <img className="app-header__logo" src="/logo-adopkia-mark.png" alt="" />
          <span>Adopkia <small>{roleNames[role] ?? "Mi espacio"}</small></span>
        </button>
        <div className="app-header__actions">
          {canDo(RESOURCES.NOTIFICATIONS, ACTIONS.READ) && (
            <div className="app-header__notifications" ref={bellRef}>
              <button
                className={`app-header__bell ${unreadNotificationsCount > 0 ? "has-unread" : ""}`}
                type="button"
                aria-label={
                  unreadNotificationsCount > 0
                    ? `Notificaciones: ${unreadNotificationsCount} sin leer`
                    : "Notificaciones"
                }
                aria-expanded={notificationsOpen}
                onClick={() => setNotificationsOpen((prev) => !prev)}
              >
                <span className="app-header__bell-icon" aria-hidden="true">🔔</span>
                {unreadNotificationsCount > 0 && (
                  <span className="app-header__bell-badge" aria-hidden="true">
                    {unreadNotificationsCount > 99 ? "99+" : unreadNotificationsCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div
                  className="app-header__notifications-popover"
                  role="dialog"
                  aria-label="Panel de notificaciones"
                >
                  <div className="app-header__notifications-header">
                    <div>
                      <strong>Notificaciones</strong>
                      {unreadNotificationsCount > 0 && (
                        <span className="app-header__notifications-count">
                          {unreadNotificationsCount} nueva{unreadNotificationsCount === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                    {unreadNotificationsCount > 0 && (
                      <button
                        type="button"
                        className="app-header__notifications-mark-all"
                        onClick={() => void markAllNotificationsAsRead()}
                      >
                        Marcar todas leídas
                      </button>
                    )}
                  </div>

                  <div className="app-header__notifications-list">
                    {notifications.length === 0 ? (
                      <div className="app-header__notifications-empty">
                        <span aria-hidden="true">🔕</span>
                        <p>No tienes notificaciones pendientes.</p>
                      </div>
                    ) : (
                      notifications.slice(0, 6).map((item) => (
                        <div
                          key={text(item.id)}
                          className={`app-header__notification-item ${item.is_read ? "is-read" : "is-unread"}`}
                        >
                          <span className="app-header__notification-icon" aria-hidden="true">
                            {item.notification_type === "mensaje"
                              ? "✉️"
                              : item.notification_type === "solicitud"
                                ? "📋"
                                : item.notification_type === "recordatorio"
                                  ? "⏰"
                                  : "🐾"}
                          </span>
                          <div className="app-header__notification-body">
                            <p className="app-header__notification-message">{text(item.message)}</p>
                            <div className="app-header__notification-meta">
                              <small>{labelStatus(item.notification_type)}</small>
                              {Boolean(item.sent_at) && <small>{text(item.sent_at)}</small>}
                            </div>
                          </div>
                          {!item.is_read && (
                            <button
                              type="button"
                              className="app-header__notification-action"
                              title="Marcar como leída"
                              aria-label={`Marcar como leída: ${text(item.message)}`}
                              onClick={() =>
                                void send(
                                  `/api/v1/notifications/${text(item.id)}/`,
                                  "PATCH",
                                  { is_read: true },
                                  "Notificación leída.",
                                )
                              }
                            >
                              ✓
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  <div className="app-header__notifications-footer">
                    <button
                      type="button"
                      className="portal-button portal-button--secondary"
                      onClick={() => {
                        setNotificationsOpen(false);
                        navTo("notifications");
                      }}
                    >
                      Ver todas las notificaciones
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="app-header__account">
            <div><strong>{user.name}</strong><span>{roleNames[role] ?? role}</span></div>
            <button type="button" onClick={onLogout}>Cerrar sesión</button>
          </div>
        </div>
      </header>
      <div className="app-layout">
        <aside className="app-sidebar">
          <p>{sidebarCopy.heading}</p>
          <nav aria-label="Navegación principal">
            {sidebarGroups.map((group) => (
              <div className="app-sidebar__group" key={group.key}>
                <h2 className="app-sidebar__group-title">{group.label}</h2>
                {group.sections.map((key) => (
                  <button
                    key={key}
                    className={`app-sidebar__link ${section === key ? "app-sidebar__link--active" : ""}`}
                    type="button"
                    aria-current={section === key ? "page" : undefined}
                    onClick={() => navTo(key)}
                  >
                    <span aria-hidden="true">{({ dashboard: "⌂", pets: "♡", requests: "▤", adoptions: "⌂", messages: "✉", records: "+", shelters: "⌂", notifications: "♧", profile: "◉", statistics: "▥", permissions: "▦" } as Record<string, string>)[key] ?? "›"}</span>
                    {visibleSectionNames[key] ?? "Permisos por rol"}
                  </button>
                ))}
              </div>
            ))}
          </nav>
          <div className="app-sidebar__note"><strong>{sidebarCopy.title}</strong><span>{sidebarCopy.description}</span></div>
        </aside>
        <main className="app-content">
          {error && <div className="portal-alert portal-alert--error" role="alert">{error}<button onClick={() => setError("")} aria-label="Cerrar error">×</button></div>}
          {notice && <div className="portal-alert portal-alert--success" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Cerrar aviso">×</button></div>}
          {loading && <p className="portal-loading" role="status">Cargando información…</p>}
          {content}
        </main>
      </div>
    </div>
  );
}

export default Portal;
