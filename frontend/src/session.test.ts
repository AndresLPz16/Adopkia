import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearSession,
  endSession,
  forgetLegacyTokens,
  getAccessToken,
  hasSessionHint,
  renewAccessToken,
  startSession,
} from "./session";

afterEach(() => {
  clearSession();
  window.localStorage.clear();
});

describe("session", () => {
  it("keeps the access token in memory and only a hint in storage", () => {
    startSession("secret-access");

    expect(getAccessToken()).toBe("secret-access");
    expect(hasSessionHint()).toBe(true);
    expect(JSON.stringify({ ...window.localStorage })).not.toContain("secret-access");
  });

  it("removes tokens saved by earlier versions", () => {
    window.localStorage.setItem("adopkia_access", "old-access");
    window.localStorage.setItem("adopkia_refresh", "old-refresh");

    forgetLegacyTokens();

    expect(window.localStorage.getItem("adopkia_access")).toBeNull();
    expect(window.localStorage.getItem("adopkia_refresh")).toBeNull();
  });

  it("shares one renewal between requests that expire together", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ access: "fresh" })));
    vi.stubGlobal("fetch", fetchMock);

    const [first, second] = await Promise.all([renewAccessToken(), renewAccessToken()]);

    expect(first).toBe("fresh");
    expect(second).toBe("fresh");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBe("fresh");
  });

  it("ends the session when the cookie is no longer valid", async () => {
    startSession("expired");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));

    expect(await renewAccessToken()).toBeNull();
    expect(getAccessToken()).toBeNull();
    expect(hasSessionHint()).toBe(false);
  });

  it("revokes the cookie on the server when signing out", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    startSession("access");

    await endSession();

    expect(getAccessToken()).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/auth/logout/", expect.objectContaining({ method: "POST" }));
  });
});
