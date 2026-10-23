import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AuthProvider } from "./auth";
import { RolePermissionsPanel } from "./RolePermissionsPanel";

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
  ],
  roles: [
    {
      name: "administrador",
      label: "Administrador",
      description: null,
      permissions: [{ resource: "users", action: "manage" }],
    },
    {
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
      async (input: RequestInfo | URL) => {
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
  });
});
