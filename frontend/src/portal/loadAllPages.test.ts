import { describe, expect, it, vi } from "vitest";
import { loadAllPages } from "./loadAllPages";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("loadAllPages", () => {
  it("follows next links and returns every record", async () => {
    const pages: Record<string, unknown> = {
      "/api/v1/pets/": {
        count: 5,
        next: "http://127.0.0.1:8000/api/v1/pets/?page=2",
        results: [{ id: 1 }, { id: 2 }],
      },
      "/api/v1/pets/?page=2": {
        count: 5,
        next: "http://127.0.0.1:8000/api/v1/pets/?page=3",
        results: [{ id: 3 }, { id: 4 }],
      },
      "/api/v1/pets/?page=3": { count: 5, next: null, results: [{ id: 5 }] },
    };
    const request = vi.fn(async (url: string) => json(pages[url]));

    const result = await loadAllPages(request, "/api/v1/pets/");

    expect(result).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }]);
    expect(request.mock.calls.map(([url]) => url)).toEqual([
      "/api/v1/pets/",
      "/api/v1/pets/?page=2",
      "/api/v1/pets/?page=3",
    ]);
  });

  it("keeps the original filters when following pages", async () => {
    const request = vi.fn(async (url: string) =>
      json(
        url.includes("page=2")
          ? { next: null, results: [{ id: 2 }] }
          : {
              next: "http://localhost/api/v1/messages/?conversation=7&page=2",
              results: [{ id: 1 }],
            },
      ),
    );

    await loadAllPages(request, "/api/v1/messages/?conversation=7");

    expect(request).toHaveBeenLastCalledWith(
      "/api/v1/messages/?conversation=7&page=2",
    );
  });

  it("returns unpaginated responses unchanged", async () => {
    const stats = { total: 3, returned: 1 };
    expect(await loadAllPages(async () => json(stats), "/api/v1/statistics/adoptions/")).toEqual(stats);
    const list = [{ id: 1 }];
    expect(await loadAllPages(async () => json(list), "/api/v1/auth/users/")).toEqual(list);
  });

  it("makes a single request when there is only one page", async () => {
    const request = vi.fn(async () => json({ next: null, results: [{ id: 1 }] }));
    expect(await loadAllPages(request, "/api/v1/pets/")).toEqual([{ id: 1 }]);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("rejects next links that leave the endpoint or loop", async () => {
    await expect(
      loadAllPages(
        async () => json({ next: "http://evil.example/api/v1/other/", results: [] }),
        "/api/v1/pets/",
      ),
    ).rejects.toThrow("no es válida");
    await expect(
      loadAllPages(
        async () => json({ next: "/api/v1/pets/?page=2", results: [] }),
        "/api/v1/pets/?page=2",
      ),
    ).rejects.toThrow("ciclo");
  });

  it("surfaces API errors from later pages", async () => {
    const request = vi.fn(async (url: string) =>
      url.includes("page=2")
        ? json({ detail: "Página inválida." }, 404)
        : json({ next: "/api/v1/pets/?page=2", results: [{ id: 1 }] }),
    );
    await expect(loadAllPages(request, "/api/v1/pets/")).rejects.toThrow("Página inválida.");
  });
});
