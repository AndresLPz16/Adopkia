import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./auth";

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

describe("AuthProvider token renewal", () => {
  it("renews an expired access token and retries the original request", async () => {
    window.localStorage.setItem("adopkia_access", "expired-access");
    window.localStorage.setItem("adopkia_refresh", "valid-refresh");
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
      <AuthProvider
        getAccessToken={() => window.localStorage.getItem("adopkia_access")}
      >
        <ProtectedRequest />
      </AuthProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Request protected data" }));
    await waitFor(() => expect(screen.getByText("200")).toBeInTheDocument());
    expect(window.localStorage.getItem("adopkia_access")).toBe("new-access");
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
