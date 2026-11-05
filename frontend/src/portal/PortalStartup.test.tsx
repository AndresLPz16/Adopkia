import { render, screen } from "@testing-library/react";
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
                    ],
                  },
                ],
                resources: [],
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
    expect(
      screen.queryByText("Verificando tu cuenta…"),
    ).not.toBeInTheDocument();
  });
});
