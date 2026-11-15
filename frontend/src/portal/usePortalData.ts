import { useCallback, useEffect, useState } from "react";
import type { PermissionMap } from "../rbac/permissions";
import { ACTIONS } from "../rbac/types";
import type { AuthUser } from "../rbac/types";
import { loadAllPages } from "./loadAllPages";
import { loadSectionData } from "./loadSectionData";
import { endpointResources, pathsForRole } from "./navigation";
import type { PermissionCheck, PortalRequest } from "./shared";

/** Recarga la sección entera, o solo las listas indicadas tras una acción. */
export type PortalReload = (only?: readonly string[] | null) => Promise<void>;

// Catálogos que cualquier cuenta con acceso a la sección puede leer.
const OPEN_ENDPOINTS = ["/api/v1/form-questions/", "/api/v1/vaccines/", "/api/v1/species/"];

/**
 * Datos de la sección abierta. Se cargan al entrar en ella y `reload` los
 * vuelve a pedir cuando una acción los cambia.
 */
export function usePortalData({
  request,
  role,
  section,
  selectedConversation,
  visibleLinks,
  canDo,
  permissions,
  user,
  setError,
}: {
  request: PortalRequest;
  role: string;
  section: string;
  selectedConversation: string;
  visibleLinks: string[];
  canDo: PermissionCheck;
  permissions: PermissionMap | null;
  user: AuthUser | null;
  setError: (message: string) => void;
}) {
  const [data, setData] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const visibleLinksKey = visibleLinks.join("|");
  const pathsForSection = pathsForRole(role);

  // Sin argumentos carga toda la sección. Con `only` (lo que cambió tras una
  // acción) recarga solo esas listas, en segundo plano y sin el aviso de carga.
  const reload: PortalReload = useCallback(async (only) => {
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
      if (OPEN_ENDPOINTS.includes(endpoint)) return true;
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
    void reload();
  }, [reload]);

  return { data, loading, reload };
}
