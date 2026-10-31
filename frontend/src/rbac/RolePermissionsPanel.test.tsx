import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AuthProvider } from "./auth";
import { RolePermissionsPanel } from "./RolePermissionsPanel";
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
      key: "messages",
      label: "Mensajes",
      actions: [
        { key: "read", label: "Consultar" },
        { key: "create", label: "Crear" },
        { key: "update", label: "Editar" },
        { key: "delete", label: "Eliminar" },
        { key: "manage", label: "Administrar" },
      ],
    },
  ],
  roles: [
    {
      id: 1,
      name: "administrador",
      label: "Administrador",
      description: null,
      permissions: [{ resource: "users", action: "manage" }],
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
    await user.selectOptions(screen.getByRole("combobox"), "adoptante");
    const deletePermission = screen.getByRole("checkbox", {
      name: "Mascotas: Eliminar",
    });
    await user.click(deletePermission);
    expect(deletePermission).toBeChecked();
    const adopterMessagePermission = screen.getByRole("checkbox", {
      name: "Mensajes: Crear",
    });
    await user.click(adopterMessagePermission);
    expect(adopterMessagePermission).toBeChecked();
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
      resource: "messages",
      action: "create",
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
