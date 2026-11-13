import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../rbac/auth";
import Portal from "../Portal";

describe("Notification Bell in Main View Header", () => {
  it("shows the notification bell with unread badge and opens the interactive popover", async () => {
    const jsonResponse = (data: unknown) =>
      new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";

        if (url.includes("/api/v1/auth/me/")) {
          return jsonResponse({
              id: 5,
              name: "Camila Adoptante",
              email: "camila@example.com",
              role: "adoptante",
            });
        }

        if (url.includes("/api/v1/auth/permissions/")) {
          return jsonResponse({
              roles: [
                {
                  name: "adoptante",
                  permissions: [
                    { resource: "dashboard", action: "read" },
                    { resource: "notifications", action: "read" },
                    { resource: "notifications", action: "update" },
                  ],
                },
              ],
              resources: [],
            });
        }

        if (url.includes("/api/v1/auth/sidebar-labels/")) {
          return jsonResponse({ defaults: {}, labels: {} });
        }

        if (url.includes("/api/v1/notifications/")) {
          if (method === "PATCH") {
            return jsonResponse({ id: 101, is_read: true });
          }
          return jsonResponse([
              {
                id: 101,
                notification_type: "solicitud",
                message: "¡Tu solicitud para adoptar a Luna fue aprobada!",
                is_read: false,
                sent_at: "2026-11-04 18:30",
              },
            ]);
        }

        return jsonResponse([]);
      }),
    );

    render(
      <MemoryRouter initialEntries={["/app/dashboard"]}>
        <AuthProvider getAccessToken={() => "mock-jwt-token"}>
          <Portal onLogout={vi.fn()} />
        </AuthProvider>
      </MemoryRouter>,
    );

    // Verify the bell button renders with the unread count
    const bellButton = await screen.findByRole("button", {
      name: /Notificaciones: 1 sin leer/i,
    });
    expect(bellButton).toBeInTheDocument();
    expect(within(bellButton).getByText("1")).toBeInTheDocument();

    // Click the bell to open the notifications dropdown popover
    fireEvent.click(bellButton);

    expect(
      await screen.findByRole("dialog", { name: "Panel de notificaciones" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("¡Tu solicitud para adoptar a Luna fue aprobada!"),
    ).toBeInTheDocument();
    expect(screen.getByText("1 nueva")).toBeInTheDocument();

    // Click to mark as read
    const markReadBtn = screen.getByTitle("Marcar como leída");
    fireEvent.click(markReadBtn);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/notifications/101/"),
        expect.objectContaining({ method: "PATCH" }),
      );
    });
  });
});
