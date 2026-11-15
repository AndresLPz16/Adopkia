import { useEffect, useState } from "react";
import { RESOURCES } from "../rbac/types";
import type { AuthStatus } from "../rbac/types";
import { responseData } from "./shared";
import type { PortalRequest } from "./shared";

export type DynamicResource = { key: string; label: string };

/**
 * Carga lo que el portal necesita una sola vez al entrar: los nombres del menú
 * personalizados y los recursos dinámicos creados desde el panel de permisos.
 */
export function usePortalMetadata({
  request,
  status,
  setError,
}: {
  request: PortalRequest;
  status: AuthStatus;
  setError: (message: string) => void;
}) {
  const [customSectionNames, setCustomSectionNames] = useState<Record<string, string>>({});
  const [dynamicResources, setDynamicResources] = useState<DynamicResource[]>([]);

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
          (resource): resource is DynamicResource =>
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

  return {
    customSectionNames,
    setCustomSectionNames,
    dynamicResources,
    setDynamicResources,
  };
}
