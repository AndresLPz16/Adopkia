import type { PermissionCatalog } from "../types";
import type { ResourceFormState, RoleFormState } from "./resources";

// Llamadas del panel de permisos a la API. Cada una devuelve el dato ya
// validado o lanza un Error con el mensaje que se muestra en el panel.

type Request = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const JSON_HEADERS = { "Content-Type": "application/json" };

/** Primer mensaje de texto de una respuesta de validación `{ campo: [mensajes] }`. */
function firstValidationMessage(details: unknown): string | null {
  if (!details || typeof details !== "object") return null;
  const message = Object.values(details).flat().find((item) => typeof item === "string");
  return typeof message === "string" && message ? message : null;
}

async function errorDetails(response: Response): Promise<any> {
  return response.json().catch(() => null);
}

export async function fetchCatalog(
  request: Request,
  signal?: AbortSignal,
): Promise<PermissionCatalog> {
  const response = await request("/api/v1/auth/permissions/", { signal });
  if (!response.ok) {
    throw new Error(`No se pudo cargar la matriz (${response.status}).`);
  }
  const result = (await response.json()) as PermissionCatalog;
  if (!Array.isArray(result.roles) || !Array.isArray(result.resources)) {
    throw new Error("La respuesta de permisos tiene un formato inválido.");
  }
  return result;
}

/** Reemplaza los permisos de un rol; `failure` describe la acción si falla. */
export async function putRolePermissions(
  request: Request,
  roleName: string,
  permissions: readonly { resource: string; action: string }[],
  failure: string,
): Promise<PermissionCatalog> {
  const response = await request(
    `/api/v1/auth/permissions/${encodeURIComponent(roleName)}/`,
    { method: "PUT", headers: JSON_HEADERS, body: JSON.stringify(permissions) },
  );
  if (!response.ok) {
    const details = await errorDetails(response);
    throw new Error(details?.detail ?? `${failure} (${response.status}).`);
  }
  return (await response.json()) as PermissionCatalog;
}

/** Crea un rol, o edita el de `editingId`; devuelve el rol guardado. */
export async function saveRole(
  request: Request,
  form: RoleFormState,
  editingId: string | number | null,
): Promise<{ id: string | number; name: string }> {
  const response = await request(
    editingId !== null
      ? `/api/v1/auth/roles/${encodeURIComponent(editingId)}/`
      : "/api/v1/auth/roles/",
    {
      method: editingId !== null ? "PATCH" : "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(form),
    },
  );
  if (!response.ok) {
    throw new Error(
      firstValidationMessage(await errorDetails(response)) ||
        `No se pudo guardar el rol (${response.status}).`,
    );
  }
  return (await response.json()) as { id: string | number; name: string };
}

export async function deleteRole(request: Request, roleId: string | number): Promise<void> {
  const response = await request(
    `/api/v1/auth/roles/${encodeURIComponent(roleId)}/`,
    { method: "DELETE" },
  );
  if (!response.ok) {
    const details = await errorDetails(response);
    throw new Error(
      details?.role?.[0] ?? `No se pudo eliminar el rol (${response.status}).`,
    );
  }
}

/** Crea un recurso, o edita el de `editingKey`; devuelve el catálogo actualizado. */
export async function saveResource(
  request: Request,
  form: ResourceFormState,
  editingKey: string | null,
): Promise<PermissionCatalog> {
  const editing = editingKey !== null;
  const response = await request(
    editing
      ? `/api/v1/auth/resources/${encodeURIComponent(editingKey)}/`
      : "/api/v1/auth/resources/",
    {
      method: editing ? "PATCH" : "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(
        editing ? { label: form.label, actions: form.actions } : form,
      ),
    },
  );
  if (!response.ok) {
    throw new Error(
      firstValidationMessage(await errorDetails(response)) ||
        `No se pudo crear el recurso (${response.status}).`,
    );
  }
  const catalog = (await response.json()) as PermissionCatalog;
  if (!Array.isArray(catalog.resources)) {
    throw new Error("La respuesta del catálogo tiene un formato inválido.");
  }
  return catalog;
}

/** Elimina un recurso propio y sus permisos; devuelve el catálogo actualizado. */
export async function deleteResource(
  request: Request,
  resourceKey: string,
): Promise<PermissionCatalog> {
  const response = await request(
    `/api/v1/auth/resources/${encodeURIComponent(resourceKey)}/`,
    { method: "DELETE" },
  );
  if (!response.ok) {
    const details = await errorDetails(response);
    throw new Error(
      details?.detail ?? `No se pudo eliminar el recurso (${response.status}).`,
    );
  }
  const catalog = (await response.json()) as PermissionCatalog;
  if (!Array.isArray(catalog.resources) || !Array.isArray(catalog.roles)) {
    throw new Error("La respuesta del catálogo tiene un formato inválido.");
  }
  return catalog;
}
