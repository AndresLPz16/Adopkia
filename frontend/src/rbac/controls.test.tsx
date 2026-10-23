import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthProvider } from "./auth";
import { PermissionButton } from "./controls";
import { ACTIONS, RESOURCES } from "./types";

describe("PermissionButton", () => {
  it("deshabilita una acción que el usuario autenticado no puede realizar", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () =>
            String(input).includes("/permissions/")
              ? {
                  resources: [],
                  roles: [
                    {
                      name: "adoptante",
                      label: "Adoptante",
                      description: null,
                      permissions: [
                        { resource: "pets", action: "read" },
                      ],
                    },
                  ],
                }
              : {
                  id: 7,
                  name: "Ana",
                  email: "ana@example.test",
                  role: "adoptante",
                },
        }),
      ),
    );

    render(
      <AuthProvider getAccessToken={() => "access-token"}>
        <PermissionButton
          resource={RESOURCES.PETS}
          permissionAction={ACTIONS.DELETE}
        >
          Eliminar
        </PermissionButton>
      </AuthProvider>,
    );

    const button = await screen.findByRole("button", { name: "Eliminar" });
    await waitFor(() => expect(button).toBeDisabled());
  });
});
