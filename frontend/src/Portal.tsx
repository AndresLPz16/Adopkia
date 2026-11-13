import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./rbac/auth";
import { can } from "./rbac/permissions";
import { ACTIONS, RESOURCES, ROLES } from "./rbac/types";
import type { Action, Resource } from "./rbac/types";
import { isAvailablePet, responseData, rows, text } from "./portal/shared";
import type { PortalDataRow, PortalPetSaver } from "./portal/shared";
import { loadAllPages } from "./portal/loadAllPages";
import { loadSectionData } from "./portal/loadSectionData";
import {
  allSections,
  endpointResources,
  endpointsAffectedBy,
  linksForRole,
  pathsForRole,
  roleSectionNames,
  roleSidebarCopy,
  sectionAccess,
  sectionNames,
} from "./portal/navigation";
import { PortalHeader } from "./portal/PortalHeader";
import { PortalSidebar } from "./portal/PortalSidebar";
import { SectionContent } from "./portal/SectionContent";

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
      if (isPlatformSuperadmin) return true;
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

  const links = useMemo(
    () => linksForRole(role, isPlatformSuperadmin),
    [isPlatformSuperadmin, role],
  );
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

  const visibleLinksKey = visibleLinks.join("|");

  const pathsForSection = pathsForRole(role);


  // Sin argumentos carga toda la sección. Con `only` (lo que cambió tras una
  // acción) recarga solo esas listas, en segundo plano y sin el aviso de carga.
  const reload = useCallback(async (only?: readonly string[] | null) => {
    const partial = Boolean(only);
    if (section === "permissions" && !partial) {
      setData({});
      return;
    }
    const sectionEndpoints = pathsForSection[section];
    if (!partial && (!sectionEndpoints || !visibleLinks.includes(section))) return;
    const endpoints = only
      ? only.filter(
          (endpoint) =>
            (sectionEndpoints ?? []).includes(endpoint) ||
            // La campana de la cabecera es visible en todas las secciones.
            endpoint === "/api/v1/notifications/",
        )
      : sectionEndpoints ?? [];
    const allowedEndpoints = endpoints.filter((endpoint) => {
      if (["/api/v1/form-questions/", "/api/v1/vaccines/", "/api/v1/species/"].includes(endpoint)) {
        return true;
      }
      const resource = endpointResources[endpoint];
      return resource && canDo(resource, ACTIONS.READ);
    });
    if (partial && allowedEndpoints.length === 0) return;
    if (!partial) setLoading(true);
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
            return loadAllPages(request, `${endpoint}${suffix}`);
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
      if (!partial) setLoading(false);
    }
    // Depende del contenido de visibleLinks, no de su identidad: el arreglo se
    // recrea al llegar los recursos dinámicos y eso repetía la carga inicial.
  }, [request, section, selectedConversation, visibleLinksKey, permissions, user]);

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
      await reload(endpointsAffectedBy(endpoint));
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

  // Marca varias notificaciones en paralelo y recarga la lista una sola vez,
  // sin tocar el formulario que el usuario pueda tener a medio escribir.
  const markNotificationsRead = async (ids: string[]) => {
    if (ids.length === 0) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const outcomes = await Promise.allSettled(
        ids.map(async (id) =>
          responseData(
            await request(`/api/v1/notifications/${encodeURIComponent(id)}/`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ is_read: true }),
            }),
          ),
        ),
      );
      const failed = outcomes.filter((outcome) => outcome.status === "rejected").length;
      await reload(["/api/v1/notifications/"]);
      if (failed > 0) {
        setError(
          `No se pudieron marcar ${failed} de ${ids.length} notificaciones como leídas.`,
        );
      } else {
        setNotice("Todas las notificaciones fueron marcadas como leídas.");
      }
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
      await reload(endpointsAffectedBy(endpoint));
      return true;
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : "No se pudo completar la publicación de la mascota.";
      if (petWasSaved) {
        setEditingPet(petId);
        await reload(endpointsAffectedBy(endpoint));
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

  return (
    <div className="app-shell" data-role={role}>
      <PortalHeader
        role={role}
        user={user}
        notifications={notifications}
        canDo={canDo}
        send={send}
        onMarkAllRead={markNotificationsRead}
        navTo={navTo}
        onLogout={onLogout}
      />
      <div className="app-layout">
        <PortalSidebar
          section={section}
          visibleLinks={visibleLinks}
          dynamicResources={dynamicResources}
          visibleSectionNames={visibleSectionNames}
          sidebarCopy={sidebarCopy}
          navTo={navTo}
        />
        <main className="app-content">
          {error && <div className="portal-alert portal-alert--error" role="alert">{error}<button onClick={() => setError("")} aria-label="Cerrar error">×</button></div>}
          {notice && <div className="portal-alert portal-alert--success" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Cerrar aviso">×</button></div>}
          {loading && <p className="portal-loading" role="status">Cargando información…</p>}
          <SectionContent
            {...{
              section,
              dynamicResourceKey,
              dynamicResources,
              setDynamicResources,
              setCustomSectionNames,
              data,
              user,
              role,
              isAdmin,
              isPlatformSuperadmin,
              canDo,
              visibleLinks,
              visibleSectionNames,
              navTo,
              pets,
              managedPets,
              visiblePets,
              shelters,
              managedShelters,
              breeds,
              questions,
              requests,
              adoptions,
              followUps,
              reminders,
              conversations,
              messages,
              records,
              vaccines,
              species,
              veterinarians,
              members,
              notifications,
              users,
              availableRoleRows,
              profile,
              form,
              setForm,
              setValue,
              answers,
              setAnswers,
              selectedConversation,
              setSelectedConversation,
              editingPet,
              setEditingPet,
              editingShelter,
              setEditingShelter,
              editingUser,
              setEditingUser,
              petSearch,
              setPetSearch,
              requestedPetId,
              setRequestedPetId,
              submit,
              send,
              savePet,
              setError,
              busy,
              loading,
            }}
          />
        </main>
      </div>
    </div>
  );
}

export default Portal;
