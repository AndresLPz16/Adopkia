import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../rbac/auth";
import Portal from "../Portal";

describe("portal authentication startup", () => {
  it("renders the dashboard after the account and permissions load", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        const body = url.includes("/api/v1/auth/me/")
          ? {
              id: 5,
              name: "Camila Adoptante",
              email: "camila@example.com",
              role: "adoptante",
            }
          : url.includes("/api/v1/auth/permissions/")
            ? {
                roles: [
                  {
                    name: "adoptante",
                    permissions: [
                      { resource: "dashboard", action: "read" },
                      { resource: "notifications", action: "read" },
                        { resource: "locoMedio", action: "read" },
                      ],
                  },
                ],
                resources: [
                  {
                    key: "locoMedio",
                    label: "LOCO y Medio",
                    actions: [{ key: "read", label: "Consultar" }],
                  },
                ],
              }
            : url.includes("/api/v1/auth/sidebar-labels/")
              ? { defaults: {}, labels: {} }
              : [];

        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );

    render(
      <MemoryRouter initialEntries={["/app/dashboard"]}>
        <AuthProvider getAccessToken={() => "mock-jwt-token"}>
          <Portal onLogout={vi.fn()} />
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", {
        name: "Encuentra a tu nuevo compañero",
      }),
    ).toBeInTheDocument();
    const resourceLink = await screen.findByRole("button", {
      name: "LOCO y Medio",
    });
    fireEvent.click(resourceLink);
    expect(
      await screen.findByRole("heading", { name: "LOCO y Medio" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Su vista y funcionalidad específica todavía deben implementarse/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Verificando tu cuenta…"),
    ).not.toBeInTheDocument();
  });
});
