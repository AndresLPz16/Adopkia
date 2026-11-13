import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../rbac/auth";
import Portal from "../Portal";
import { endpointsAffectedBy } from "./navigation";

const jsonResponse = (data: unknown) =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

type Call = { url: string; method: string };

function stubApi(unread: number) {
  const calls: Call[] = [];
  let notifications = Array.from({ length: unread }, (_, index) => ({
    id: 101 + index,
    notification_type: "solicitud",
    message: `Aviso ${index + 1}`,
    is_read: false,
  }));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      calls.push({ url, method });
      if (url.includes("/api/v1/auth/me/")) {
        return jsonResponse({ id: 5, name: "Camila", email: "c@example.com", role: "adoptante" });
      }
      if (url.includes("/api/v1/auth/permissions/")) {
        return jsonResponse({
          roles: [
            {
              name: "adoptante",
              permissions: [
                { resource: "dashboard", action: "read" },
                { resource: "pets", action: "read" },
                { resource: "adoptionRequests", action: "read" },
                { resource: "adoptions", action: "read" },
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
          const id = Number(url.match(/notifications\/(\d+)\//)?.[1]);
          notifications = notifications.map((item) =>
            item.id === id ? { ...item, is_read: true } : item,
          );
          return jsonResponse({ id, is_read: true });
        }
        return jsonResponse(notifications);
      }
      return jsonResponse([]);
    }),
  );
  return calls;
}

function renderPortal() {
  render(
    <MemoryRouter initialEntries={["/app/dashboard"]}>
      <AuthProvider getAccessToken={() => "mock-jwt-token"}>
        <Portal onLogout={vi.fn()} />
      </AuthProvider>
    </MemoryRouter>,
  );
}

const dataGets = (calls: Call[]) =>
  calls
    .filter(({ url, method }) => method === "GET" && !url.includes("/api/v1/auth/"))
    .map(({ url }) => url);

const bellLabel = () =>
  document.querySelector(".app-header__bell")?.getAttribute("aria-label");

afterEach(() => vi.unstubAllGlobals());

describe("portal reloads after an action", () => {
  it("reloads only the lists the action can change", async () => {
    const calls = stubApi(1);
    renderPortal();
    fireEvent.click(await screen.findByRole("button", { name: /Notificaciones: 1 sin leer/i }));
    await waitFor(() => expect(dataGets(calls)).toHaveLength(4));
    expect(dataGets(calls).sort()).toEqual([
      "/api/v1/adoption-requests/",
      "/api/v1/adoptions/",
      "/api/v1/notifications/",
      "/api/v1/pets/",
    ]);
    calls.length = 0;

    fireEvent.click(screen.getByTitle("Marcar como leída"));

    await waitFor(() => expect(bellLabel()).toBe("Notificaciones"));
    expect(calls).toEqual([
      { url: "/api/v1/notifications/101/", method: "PATCH" },
      { url: "/api/v1/notifications/", method: "GET" },
    ]);
  });

  it("marks every notification as read with one reload", async () => {
    const calls = stubApi(3);
    renderPortal();
    fireEvent.click(await screen.findByRole("button", { name: /Notificaciones: 3 sin leer/i }));
    await waitFor(() => expect(dataGets(calls)).toHaveLength(4));
    calls.length = 0;

    fireEvent.click(screen.getByRole("button", { name: "Marcar todas leídas" }));

    expect(
      await screen.findByText("Todas las notificaciones fueron marcadas como leídas."),
    ).toBeInTheDocument();
    expect(calls.filter(({ method }) => method === "PATCH")).toHaveLength(3);
    expect(calls.filter(({ method }) => method === "GET")).toEqual([
      { url: "/api/v1/notifications/", method: "GET" },
    ]);
    expect(bellLabel()).toBe("Notificaciones");
  });
});

describe("endpointsAffectedBy", () => {
  it("maps a write to the lists it can change", () => {
    expect(endpointsAffectedBy("/api/v1/notifications/7/")).toEqual(["/api/v1/notifications/"]);
    expect(endpointsAffectedBy("/api/v1/pets/3/relist/")).toEqual(["/api/v1/pets/"]);
    expect(endpointsAffectedBy("/api/v1/adoption-requests/9/approve/")).toEqual(
      expect.arrayContaining([
        "/api/v1/adoption-requests/",
        "/api/v1/adoptions/",
        "/api/v1/pets/",
        "/api/v1/notifications/",
      ]),
    );
    expect(endpointsAffectedBy("/api/v1/auth/users/4/")).toEqual(["/api/v1/auth/users/"]);
  });

  it("returns null for unknown resources so the caller reloads everything", () => {
    expect(endpointsAffectedBy("/api/v1/something-new/")).toBeNull();
    expect(endpointsAffectedBy("/other/")).toBeNull();
  });
});
