import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./rbac/auth";
import { RolePermissionsPanel } from "./rbac";
import { can } from "./rbac/permissions";
import { ACTIONS, RESOURCES, ROLES } from "./rbac/types";
import type { Action, Resource } from "./rbac/types";
import {
  isAvailablePet,
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
  requests: "Solicitudes",
  adoptions: "Adopciones y cuidados",
  messages: "Mensajes",
  records: "Atención veterinaria",
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
  const section = location.pathname.startsWith("/admin/permissions")
    ? "permissions"
    : location.pathname.split("/")[2] || "dashboard";
  const sectionAccess: Record<
    string,
    [keyof typeof RESOURCES, keyof typeof ACTIONS][]
  > = {
    dashboard: [["DASHBOARD", "READ"]],
    profile: [["PROFILE", "READ"]],
    pets: [["PETS", "READ"]],
    requests: [["ADOPTION_REQUESTS", "READ"]],
    adoptions: [["ADOPTIONS", "READ"]],
    messages: [["CONVERSATIONS", "READ"], ["MESSAGES", "READ"]],
    records: [["MEDICAL_RECORDS", "READ"]],
    shelters: [["SHELTERS", "READ"]],
    notifications: [["NOTIFICATIONS", "READ"]],
    users: [["USERS", "READ"]],
    statistics: [["STATISTICS", "READ"]],
    permissions: [["USERS", "MANAGE"]],
  };
  const hasAccess = (key: string) =>
    (sectionAccess[key] ?? []).every(([resource, action]) =>
      can(user, RESOURCES[resource], ACTIONS[action], permissions ?? {}),
    );
  const canDo = (resource: Resource, action: Action) =>
    can(user, resource, action, permissions ?? {});

  const [data, setData] = useState<Record<string, unknown>>({});
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
    "requests",
    "adoptions",
    "messages",
    "records",
    "shelters",
    "notifications",
    "users",
    "statistics",
    "permissions",
  ];
  const visibleLinks = useMemo(
    () => [...new Set([...links, ...allSections.filter(hasAccess)])].filter(hasAccess),
    [links, permissions, user],
  );

  const pathsForSection: Record<string, string[]> = {
    dashboard:
      role === ROLES.ADMIN
        ? ["/api/v1/shelters/", "/api/v1/statistics/adoptions/"]
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
    shelters: ["/api/v1/shelters/", "/api/v1/shelter-members/"],
    notifications: ["/api/v1/notifications/"],
    profile: ["/api/v1/auth/me/"],
    users: isAdmin
      ? ["/api/v1/auth/users/", "/api/v1/auth/roles/"]
      : ["/api/v1/auth/users/"],
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
      "/api/v1/conversations/": RESOURCES.CONVERSATIONS,
      "/api/v1/messages/": RESOURCES.MESSAGES,
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
      if (["/api/v1/form-questions/", "/api/v1/vaccines/"].includes(endpoint)) {
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
    navigate(key === "permissions" ? "/admin/permissions" : `/app/${key}`);

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
  const content = section === "permissions"
    ? <RolePermissionsPanel />
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
                            isAdmin={isAdmin}
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

  return (
    <div className="app-shell" data-role={role}>
      <header className="app-header">
        <button className="app-header__brand" type="button" onClick={() => navTo("dashboard")}>
          <img className="app-header__logo" src="/logo-adopkia-mark.png" alt="" />
          <span>Adopkia <small>{roleNames[role] ?? "Mi espacio"}</small></span>
        </button>
        <div className="app-header__account">
          <div><strong>{user.name}</strong><span>{roleNames[role] ?? role}</span></div>
          <button type="button" onClick={onLogout}>Cerrar sesión</button>
        </div>
      </header>
      <div className="app-layout">
        <aside className="app-sidebar">
          <p>{sidebarCopy.heading}</p>
          <nav aria-label="Navegación principal">
            {visibleLinks.map((key) => (
              <button key={key} className={`app-sidebar__link ${section === key ? "app-sidebar__link--active" : ""}`} type="button" onClick={() => navTo(key)}>
                <span aria-hidden="true">{({ dashboard: "⌂", pets: "♡", requests: "▤", adoptions: "⌂", messages: "✉", records: "+", shelters: "⌂", notifications: "♧", profile: "◉", statistics: "▥", permissions: "▦" } as Record<string, string>)[key] ?? "›"}</span>
                {visibleSectionNames[key] ?? "Permisos por rol"}
              </button>
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
