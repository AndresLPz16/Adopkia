import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AuthProvider } from "./auth";
import { RolePermissionsPanel } from "./RolePermissionsPanel";
import { SidebarLabelsEditor } from "./SidebarLabelsEditor";
import type { PermissionCatalog } from "./types";

const permissionCatalog = {
  resources: [
    {
      key: "pets",
      label: "Mascotas",
      actions: [
        { key: "read", label: "Consultar" },
        { key: "create", label: "Crear" },
        { key: "delete", label: "Eliminar" },
        { key: "manage", label: "Administrar" },
      ],
    },
    {
      key: "messaging",
      label: "Conversaciones y mensajes",
      actions: [
        { key: "read", label: "Consultar" },
        { key: "create", label: "Crear" },
        { key: "update", label: "Editar" },
        { key: "delete", label: "Eliminar" },
        { key: "manage", label: "Administrar" },
      ],
    },
    {
      key: "rolePermissions",
      label: "Permisos por rol",
      actions: [{ key: "manage", label: "Administrar" }],
    },
  ],
  roles: [
    {
      id: 1,
      name: "administrador",
      label: "Administrador",
      description: null,
      permissions: [{ resource: "rolePermissions", action: "manage" }],
    },
    {
      id: 2,
      name: "adoptante",
      label: "Adoptante",
      description: null,
      permissions: [{ resource: "pets", action: "read" }],
    },
  ],
};

describe("RolePermissionsPanel", () => {
  it("builds permission columns and rows from the returned resource catalog", async () => {
    const dynamicCatalog = {
      ...permissionCatalog,
      resources: [
        ...permissionCatalog.resources,
        {
          key: "dynamicResource",
          label: "Recurso dinámico",
          actions: [
            { key: "read", label: "Consultar" },
            { key: "publish", label: "Publicar" },
          ],
        },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => ({
        ok: true,
        status: 200,
        json: async () =>
          String(input).includes("/me/")
            ? {
                id: 1,
                name: "Admin",
                email: "admin@example.test",
                role: "administrador",
              }
            : dynamicCatalog,
      })),
    );

    render(
      <AuthProvider getAccessToken={() => "access-token"}>
        <RolePermissionsPanel />
      </AuthProvider>,
    );

    expect(
      await screen.findByRole("checkbox", {
        name: "Recurso dinámico: Publicar",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Publicar" })).toBeInTheDocument();
  });

  it("creates a resource and adds it to the matrix catalog", async () => {
    let catalog: PermissionCatalog = permissionCatalog;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/me/")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 1,
            name: "Admin",
            email: "admin@example.test",
            role: "administrador",
          }),
        };
      }
      if (url.includes("/permissions/") && !url.includes("/roles/")) {
        return { ok: true, status: 200, json: async () => catalog };
      }
      if (url.includes("/resources/") && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as {
          key: string;
          label: string;
          actions: string[];
        };
        catalog = {
          ...catalog,
          resources: [
            ...catalog.resources,
            {
              key: body.key,
              label: body.label,
              actions: body.actions.map((key) => ({
                key,
                label: key === "read" ? "Consultar" : "Crear",
              })),
            },
          ],
        };
        return { ok: true, status: 201, json: async () => catalog };
      }
      return { ok: true, status: 200, json: async () => catalog };
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(
      <AuthProvider getAccessToken={() => "access-token"}>
        <RolePermissionsPanel />
      </AuthProvider>,
    );

    await screen.findByRole("checkbox", { name: "Mascotas: Consultar" });
    await user.click(screen.getByRole("button", { name: "Crear recurso" }));
    await user.type(screen.getByLabelText("Clave del recurso"), "adoptionReports");
    await user.type(screen.getByLabelText("Nombre visible"), "Informes de adopción");
    await user.click(screen.getByRole("button", { name: "Crear recurso" }));

    expect(await screen.findByRole("row", { name: /Informes de adopción/ })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/auth/resources/",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("edits a dynamic resource and removes it and its role grants", async () => {
    let catalog: PermissionCatalog = {
      ...permissionCatalog,
      resources: [
        ...permissionCatalog.resources,
        {
          key: "locoMedio",
          label: "LOCO y Medio",
          actions: [
            { key: "read", label: "Consultar" },
            { key: "create", label: "Crear" },
          ],
        },
      ],
      roles: permissionCatalog.roles.map((role) =>
        role.name === "adoptante"
          ? {
              ...role,
              permissions: [
                ...role.permissions,
                { resource: "locoMedio", action: "read" },
              ],
            }
          : role,
      ),
    };
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/me/")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              id: 1,
              name: "Admin",
              email: "admin@example.test",
              role: "administrador",
            }),
          };
        }
        if (url.includes("/sidebar-labels/")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ defaults: {}, labels: {} }),
          };
        }
        if (url.includes("/resources/locoMedio/") && init?.method === "PATCH") {
          const body = JSON.parse(String(init.body)) as {
            label: string;
            actions: string[];
          };
          catalog = {
            ...catalog,
            resources: catalog.resources.map((resource) =>
              resource.key === "locoMedio"
                ? {
                    ...resource,
                    label: body.label,
                    actions: body.actions.map((key) => ({
                      key,
                      label: key === "read" ? "Consultar" : "Crear",
                    })),
                  }
                : resource,
            ),
          };
        } else if (
          url.includes("/resources/locoMedio/") &&
          init?.method === "DELETE"
        ) {
          catalog = {
            ...catalog,
            resources: catalog.resources.filter(
              (resource) => resource.key !== "locoMedio",
            ),
            roles: catalog.roles.map((role) => ({
              ...role,
              permissions: role.permissions.filter(
                (permission) => permission.resource !== "locoMedio",
              ),
            })),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => catalog,
        };
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("confirm", vi.fn(() => true));
    const user = userEvent.setup();

    render(
      <AuthProvider getAccessToken={() => "access-token"}>
        <RolePermissionsPanel />
      </AuthProvider>,
    );

    const row = await screen.findByRole("row", { name: /LOCO y Medio/ });
    await user.click(within(row).getByRole("button", { name: "Editar" }));
    const labelInput = screen.getByLabelText("Nombre visible");
    await user.clear(labelInput);
    await user.type(labelInput, "Pepe");
    await user.click(screen.getByRole("button", { name: "Guardar recurso" }));

    const renamedRow = await screen.findByRole("row", { name: /Pepe/ });
    expect(
      within(renamedRow).getByRole("checkbox", { name: "Pepe: Consultar" }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/auth/resources/locoMedio/",
      expect.objectContaining({ method: "PATCH" }),
    );

    await user.click(within(renamedRow).getByRole("button", { name: "Eliminar" }));
    expect(await screen.findByText(/Se eliminó el recurso "Pepe"/)).toBeInTheDocument();
    expect(
      screen.queryByRole("row", { name: /Pepe/ }),
    ).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/auth/resources/locoMedio/",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("shows a read-only panel when the role has only the read permission", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      return {
        ok: true,
        status: 200,
        json: async () =>
          url.includes("/me/")
            ? {
                id: 8,
                name: "Reader",
                email: "reader@example.test",
                role: "adoptante",
              }
            : {
                ...permissionCatalog,
                roles: [
                  {
                    ...permissionCatalog.roles[1],
                    permissions: [
                      { resource: "pets", action: "read" },
                      { resource: "rolePermissions", action: "read" },
                    ],
                  },
                ],
              },
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AuthProvider getAccessToken={() => "access-token"}>
        <RolePermissionsPanel />
      </AuthProvider>,
    );

    const permission = await screen.findByRole("checkbox", {
      name: "Mascotas: Consultar",
    });
    expect(permission).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Crear rol" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
  });

  it("allows a non-admin role with the delegated permission to open the panel", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      return {
        ok: true,
        status: 200,
        json: async () =>
          url.includes("/me/")
            ? {
                id: 8,
                name: "Role Manager",
                email: "manager@example.test",
                role: "role_manager",
              }
            : {
                ...permissionCatalog,
                roles: [
                  ...permissionCatalog.roles,
                  {
                    id: 3,
                    name: "role_manager",
                    label: "Gestor de roles",
                    description: null,
                    permissions: [
                      { resource: "rolePermissions", action: "manage" },
                    ],
                  },
                ],
              },
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AuthProvider getAccessToken={() => "access-token"}>
        <RolePermissionsPanel />
      </AuthProvider>,
    );

    expect(
      await screen.findByRole("checkbox", { name: "Mascotas: Consultar" }),
    ).toBeInTheDocument();
  });

  it("saves global sidebar labels for all users", async () => {
    const defaults = { messages: "Mensajes" };
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const payload =
          init?.method === "PUT"
            ? JSON.parse(String(init.body))
            : { labels: defaults };
        return {
          ok: true,
          status: 200,
          json: async () => {
            if (url.includes("/me/")) {
              return {
                  id: 1,
                  name: "Admin",
                  email: "admin@example.test",
                  role: "administrador",
                };
            }
            if (url.includes("/permissions/")) {
              return {
                roles: [{
                  name: "administrador",
                  permissions: [{ resource: "rolePermissions", action: "manage" }],
                }],
              };
            }
            return { defaults, ...payload };
          },
        };
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(
      <AuthProvider getAccessToken={() => "access-token"}>
        <SidebarLabelsEditor />
      </AuthProvider>,
    );

    const labelInput = await screen.findByLabelText("Mensajes");
    await user.clear(labelInput);
    await user.type(labelInput, "Conversaciones");
    await user.click(screen.getByRole("button", { name: "Guardar nombres" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/auth/sidebar-labels/",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ labels: { messages: "Conversaciones" } }),
        }),
      ),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Nombres del menú actualizados para todos los usuarios.",
    );
  });

  it("updates matching permission matrix resource labels when sidebar labels change", async () => {
    const sidebarDefaults = { shelters: "Refugios y equipo" };
    const dynamicCatalog: PermissionCatalog = {
      ...permissionCatalog,
      resources: [
        ...permissionCatalog.resources,
        {
          key: "shelters",
          label: "Refugios",
          actions: [{ key: "read", label: "Consultar" }],
        },
      ],
    };
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const body =
          init?.method === "PUT"
            ? JSON.parse(String(init.body)) as { labels: Record<string, string> }
            : null;
        const result = url.includes("/me/")
          ? {
              id: 1,
              name: "Admin",
              email: "admin@example.test",
              role: "administrador",
              is_platform_superadmin: true,
            }
          : url.includes("/sidebar-labels/")
            ? {
                defaults: sidebarDefaults,
                labels: body?.labels ?? sidebarDefaults,
              }
            : dynamicCatalog;
        return {
          ok: true,
          status: 200,
          json: async () => result,
        };
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(
      <AuthProvider getAccessToken={() => "access-token"}>
        <RolePermissionsPanel />
      </AuthProvider>,
    );

    expect(
      await screen.findByRole("checkbox", {
        name: "Refugios y equipo: Consultar",
      }),
    ).toBeInTheDocument();
    const labelInput = await screen.findByLabelText("Refugios y equipo");
    await user.clear(labelInput);
    await user.type(labelInput, "Pepe");
    await user.click(screen.getByRole("button", { name: "Guardar nombres" }));

    expect(
      await screen.findByRole("checkbox", { name: "Pepe: Consultar" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /Pepe/ })).toBeInTheDocument();
  });

  it("allows an administrator to edit and persist a role permission", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = String(input);
        const profile = {
          id: 1,
          name: "Admin",
          email: "admin@example.test",
          role: "administrador",
        };
        const json = url.includes("/me/")
          ? profile
          : permissionCatalog;
        return {
          ok: true,
          status: 200,
          json: async () => json,
        };
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(
      <AuthProvider getAccessToken={() => "access-token"}>
        <RolePermissionsPanel />
      </AuthProvider>,
    );

    await screen.findByRole("checkbox", { name: "Mascotas: Consultar" });
    expect(
      screen.getByRole("checkbox", {
        name: "Conversaciones y mensajes: Crear",
      }),
    ).toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox"), "adoptante");
    const deletePermission = screen.getByRole("checkbox", {
      name: "Mascotas: Eliminar",
    });
    await user.click(deletePermission);
    expect(deletePermission).toBeChecked();
    const rolePanelPermission = screen.getByRole("checkbox", {
      name: "Permisos por rol: Administrar",
    });
    await user.click(rolePanelPermission);
    expect(rolePanelPermission).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/auth/permissions/adoptante/",
        expect.objectContaining({ method: "PUT" }),
      ),
    );
    const saveCall = fetchMock.mock.calls.find(
      ([input, init]) =>
        String(input).includes("/permissions/adoptante/") &&
        init?.method === "PUT",
    );
    expect(JSON.parse(String(saveCall?.[1]?.body))).toContainEqual({
      resource: "pets",
      action: "delete",
    });
    expect(JSON.parse(String(saveCall?.[1]?.body))).toContainEqual({
      resource: "rolePermissions",
      action: "manage",
    });
  });

  it("removes permissions from the selected role immediately", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, _init?: RequestInit) => ({
        ok: true,
        status: 200,
        json: async () =>
          String(input).includes("/me/")
            ? {
                id: 1,
                name: "Admin",
                email: "admin@example.test",
                role: "administrador",
              }
            : permissionCatalog,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("confirm", vi.fn(() => true));
    const user = userEvent.setup();

    render(
      <AuthProvider getAccessToken={() => "access-token"}>
        <RolePermissionsPanel />
      </AuthProvider>,
    );

    await screen.findByRole("checkbox", { name: "Mascotas: Consultar" });
    await user.selectOptions(screen.getByRole("combobox"), "adoptante");
    await user.click(screen.getByRole("button", { name: "Quitar permisos" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/auth/permissions/adoptante/",
        expect.objectContaining({ method: "PUT", body: "[]" }),
      );
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Se quitaron los permisos de Adoptante.",
    );
  });

  it("preserves mandatory administrator permissions when clearing its grants", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, _init?: RequestInit) => ({
        ok: true,
        status: 200,
        json: async () =>
          String(input).includes("/me/")
            ? {
                id: 1,
                name: "Admin",
                email: "admin@example.test",
                role: "administrador",
                is_platform_superadmin: true,
              }
            : permissionCatalog,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("confirm", vi.fn(() => true));
    const user = userEvent.setup();

    render(
      <AuthProvider getAccessToken={() => "access-token"}>
        <RolePermissionsPanel />
      </AuthProvider>,
    );

    await screen.findByRole("checkbox", { name: "Mascotas: Consultar" });
    await user.click(screen.getByRole("button", { name: "Quitar permisos" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/auth/permissions/administrador/",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify([
            { resource: "users", action: "manage" },
            { resource: "shelters", action: "verify" },
            { resource: "rolePermissions", action: "manage" },
          ]),
        }),
      );
    });
  });

  it("creates a custom role and includes it in the permission matrix", async () => {
      let catalog: PermissionCatalog = permissionCatalog;
      const fetchMock = vi.fn(
        async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = String(input);
          const profile = {
            id: 1,
            name: "Admin",
            email: "admin@example.test",
            role: "administrador",
          };
          if (url.includes("/me/")) {
            return { ok: true, status: 200, json: async () => profile };
          }
          if (url.includes("/roles/") && init?.method === "POST") {
            const createdRole = {
              id: 5,
              name: "content_moderator",
              label: "Moderador de contenido",
              description: "Revisa contenido.",
            };
            catalog = {
              ...catalog,
              roles: [...catalog.roles, { ...createdRole, permissions: [] }],
            };
            return { ok: true, status: 201, json: async () => createdRole };
          }
          return { ok: true, status: 200, json: async () => catalog };
        },
      );
      vi.stubGlobal("fetch", fetchMock);
      const user = userEvent.setup();

      render(
        <AuthProvider getAccessToken={() => "access-token"}>
          <RolePermissionsPanel />
        </AuthProvider>,
      );

      await screen.findByRole("checkbox", { name: "Mascotas: Consultar" });
      await user.click(screen.getByRole("button", { name: "Crear rol" }));
      await user.type(screen.getByLabelText("Identificador"), "content_moderator");
      await user.type(screen.getByLabelText("Nombre visible"), "Moderador de contenido");
      await user.type(screen.getByLabelText("Descripción"), "Revisa contenido.");
      await user.click(screen.getByRole("button", { name: "Guardar rol" }));

      await waitFor(() =>
        expect(screen.getByRole("combobox")).toHaveValue("content_moderator"),
      );
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/auth/roles/",
        expect.objectContaining({ method: "POST" }),
      );
      expect(screen.getByRole("checkbox", { name: "Mascotas: Consultar" })).toBeInTheDocument();
  });

  it("prevents a regular administrator from editing administrator permissions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => ({
        ok: true,
        status: 200,
        json: async () =>
          String(input).includes("/me/")
            ? {
                id: 1,
                name: "Admin",
                email: "admin@example.test",
                role: "administrador",
                is_platform_superadmin: false,
              }
            : permissionCatalog,
      })),
    );

    render(
      <AuthProvider getAccessToken={() => "access-token"}>
        <RolePermissionsPanel />
      </AuthProvider>,
    );

    expect(await screen.findByText(
      "No tienes autorización para modificar los permisos de este rol.",
    )).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
  });
});
