import { SkeletonGrid } from "./ui/loading";
import { useDocumentTitle } from "./ui/useDocumentTitle";
import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./rbac/auth";
import { can } from "./rbac/permissions";
import { ROLES } from "./rbac/types";
import type { Action, Resource } from "./rbac/types";
import { FieldErrorsContext, text } from "./portal/shared";
import {
  allSections,
  linksForRole,
  roleSectionNames,
  roleSidebarCopy,
  sectionNames,
} from "./portal/navigation";
import { sectionAccessFor, sectionFromPath, sectionPath } from "./portal/portalAccess";
import { portalRows } from "./portal/portalRows";
import { PortalHeader } from "./portal/PortalHeader";
import { PortalSidebar } from "./portal/PortalSidebar";
import { SectionContent } from "./portal/SectionContent";
import { usePortalActions } from "./portal/usePortalActions";
import { usePortalData } from "./portal/usePortalData";
import { usePortalMetadata } from "./portal/usePortalMetadata";

// Arma el portal: decide qué sección se muestra, guarda el estado de los
// formularios y reparte datos y acciones a la sección abierta. La carga de
// datos y las acciones que escriben en la API viven en ./portal/usePortal*.
function Portal({ onLogout }: { onLogout: () => void }) {
  const { user, status, request, permissions } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const role = user?.roles[0] ?? "";
  const isAdmin = role === ROLES.ADMIN;
  const isPlatformSuperadmin = user?.isPlatformSuperadmin === true;
  const { section, dynamicResourceKey } = sectionFromPath(location.pathname);
  const hasAccess = sectionAccessFor(user, permissions, isPlatformSuperadmin);
  const canDo = (resource: Resource, action: Action) =>
    can(user, resource, action, permissions ?? {});

  // Estado de los formularios de la sección abierta.
  const [form, setForm] = useState<Record<string, string>>({});
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selectedConversation, setSelectedConversation] = useState("");
  const [editingPet, setEditingPet] = useState("");
  const [editingShelter, setEditingShelter] = useState("");
  const [editingUser, setEditingUser] = useState("");
  const [petSearch, setPetSearch] = useState("");
  const [requestedPetId, setRequestedPetId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const {
    customSectionNames,
    setCustomSectionNames,
    dynamicResources,
    setDynamicResources,
  } = usePortalMetadata({ request, status, setError });
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

  const { data, loading, reload } = usePortalData({
    request,
    role,
    section,
    selectedConversation,
    visibleLinks,
    canDo,
    permissions,
    user,
    setError,
  });

  const {
    busy,
    fieldErrors,
    clearFieldError,
    clearFieldErrors,
    changedPhotoUrl,
    send,
    markNotificationsRead,
    savePet,
    savePhoto,
  } = usePortalActions({
    request,
    reload,
    setError,
    setNotice,
    forms: {
      afterSave: () => {
        setForm({});
        setAnswers({});
        setEditingPet("");
        setEditingShelter("");
        setEditingUser("");
      },
      afterPetSave: () => {
        setForm({});
        setEditingPet("");
      },
      keepEditingPet: setEditingPet,
    },
  });

  useEffect(() => {
    if (status === "unauthenticated") onLogout();
  }, [status, onLogout]);

  // Cada sección empieza con sus formularios y avisos en blanco.
  useEffect(() => {
    setForm({});
    setAnswers({});
    setEditingPet("");
    setEditingShelter("");
    setEditingUser("");
    setSelectedConversation("");
    setError("");
    setNotice("");
    clearFieldErrors();
  }, [section]);

  // Un aviso de éxito se cierra solo; los errores esperan a que se lean.
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const setValue = (name: string, value: string) => {
    setForm((current) => ({ ...current, [name]: value }));
    clearFieldError(name);
  };

  const submit = (callback: () => Promise<void>) => (event: FormEvent) => {
    event.preventDefault();
    void callback();
  };

  const lists = portalRows(data, { role, userId: user?.id, petSearch });
  const { conversations, notifications } = lists;

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

  // Al abrir Mensajes se elige la primera conversación.
  useEffect(() => {
    if (
      section === "messages" &&
      !selectedConversation &&
      conversations.length > 0
    ) {
      setSelectedConversation(text(conversations[0].id));
    }
  }, [conversations, section, selectedConversation]);

  const navTo = (key: string) => navigate(sectionPath(key));

  useDocumentTitle(
    user ? (visibleSectionNames as Record<string, string>)[section] : undefined,
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
        user={{
          name: user.name,
          photoUrl: changedPhotoUrl !== undefined ? changedPhotoUrl : user.photoUrl,
        }}
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
          {/* Avisos flotantes: no desplazan el contenido al aparecer. */}
          <div className="portal-toasts">
            {error && <div className="portal-alert portal-alert--error" role="alert">{error}<button onClick={() => setError("")} aria-label="Cerrar error"><X size={16} aria-hidden="true" /></button></div>}
            {notice && <div className="portal-alert portal-alert--success" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Cerrar aviso"><X size={16} aria-hidden="true" /></button></div>}
          </div>
          {loading && <SkeletonGrid label="Cargando información…" />}
          {/* La clave reinicia la animación de entrada al cambiar de sección. */}
          <div className="portal-view" key={section}>
          <FieldErrorsContext.Provider value={fieldErrors}>
          <SectionContent
            {...lists}
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
              savePhoto,
              setError,
              busy,
              loading,
            }}
          />
          </FieldErrorsContext.Provider>
          </div>
        </main>
      </div>
    </div>
  );
}

export default Portal;
