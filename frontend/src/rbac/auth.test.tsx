import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./auth";
import { clearSession, getAccessToken, startSession } from "../session";

function ProtectedRequest() {
  const { request } = useAuth();
  const [result, setResult] = useState("");

  const send = async () => {
    const response = await request("/protected/");
    setResult(String(response.status));
  };

  return (
    <>
      <button onClick={() => void send()}>Request protected data</button>
      <output>{result}</output>
    </>
  );
}

function PermissionStatus() {
  const { permissions, status } = useAuth();
  // El proveedor solo escucha el foco de la ventana con la sesión autenticada.
  // Mostrar "cannot-manage-roles" antes hacía que la prueba disparara el foco
  // demasiado pronto en máquinas lentas (CI) y el evento se perdía.
  if (status !== "authenticated") return <output>loading</output>;
  return (
    <output>
      {permissions?.adoptante?.rolePermissions?.includes("manage")
        ? "can-manage-roles"
        : "cannot-manage-roles"}
    </output>
  );
}

describe("AuthProvider token renewal", () => {
  it("refreshes role permissions when the authenticated tab regains focus", async () => {
    let granted = false;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/me/")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 2,
            name: "Adopter",
            email: "adopter@example.test",
            role: "adoptante",
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          resources: [],
          roles: [
            {
              name: "adoptante",
              permissions: granted
                ? [{ resource: "rolePermissions", action: "manage" }]
                : [],
            },
          ],
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AuthProvider getAccessToken={() => "valid-access"}>
        <PermissionStatus />
      </AuthProvider>,
    );

    expect(await screen.findByText("cannot-manage-roles")).toBeInTheDocument();
    granted = true;
    fireEvent.focus(window);

    expect(await screen.findByText("can-manage-roles")).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.filter(([input]) =>
        String(input).includes("/auth/permissions/"),
      ),
    ).toHaveLength(2);
  });

  it("renews an expired access token and retries the original request", async () => {
    startSession("expired-access");
    let protectedCalls = 0;
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
      if (url.includes("/permissions/")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ resources: [], roles: [] }),
        };
      }
      if (url.includes("/auth/refresh/")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ access: "new-access" }),
        };
      }
      protectedCalls += 1;
      return {
        ok: protectedCalls > 1,
        status: protectedCalls > 1 ? 200 : 401,
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AuthProvider getAccessToken={getAccessToken}>
        <ProtectedRequest />
      </AuthProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Request protected data" }));
    await waitFor(() => expect(screen.getByText("200")).toBeInTheDocument());
    // El token nuevo queda en memoria, no en el almacenamiento del navegador.
    expect(getAccessToken()).toBe("new-access");
    expect(window.localStorage.getItem("adopkia_access")).toBeNull();
    const renewal = fetchMock.mock.calls.find(([input]) =>
      String(input).includes("/auth/refresh/"),
    );
    // La renovación viaja en la cookie HttpOnly: no lleva token en el cuerpo.
    expect(renewal?.[1]?.body).toBeUndefined();
    expect(renewal?.[1]?.credentials).toBe("same-origin");
    clearSession();
    expect(protectedCalls).toBe(2);
    const protectedRequests = fetchMock.mock.calls.filter(
      ([input]) => String(input) === "/protected/",
    );
    expect(new Headers(protectedRequests[0][1]?.headers).get("Authorization")).toBe(
      "Bearer expired-access",
    );
    expect(new Headers(protectedRequests[1][1]?.headers).get("Authorization")).toBe(
      "Bearer new-access",
    );
  });
});
