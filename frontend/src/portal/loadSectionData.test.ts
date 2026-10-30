import { describe, expect, it, vi } from "vitest";
import { loadAllPages, loadSectionData } from "./loadSectionData";

describe("loadSectionData", () => {
  it("returns successful endpoint data and reports failed endpoints independently", async () => {
    const { data, failures } = await loadSectionData([
      { key: "/api/pets/", load: vi.fn().mockResolvedValue([{ id: 1 }]) },
      { key: "/api/shelters/", load: vi.fn().mockRejectedValue(new Error("Sin conexión")) },
      { key: "/api/messages/", load: vi.fn().mockRejectedValue("Timeout") },
    ]);

    expect(data).toEqual({ "/api/pets/": [{ id: 1 }] });
    expect(failures).toEqual([
      { key: "/api/shelters/", message: "Sin conexión" },
      { key: "/api/messages/", message: "Timeout" },
    ]);
  });

  describe("loadAllPages", () => {
    it("loads every page using a same-origin API path", async () => {
      const fetchPage = vi
        .fn()
        .mockResolvedValueOnce({
          results: [{ id: 2 }],
          next: null,
        });

      await expect(
        loadAllPages(
          {
            count: 2,
            results: [{ id: 3 }],
            next: "http://127.0.0.1:8000/api/v1/pets/?page=2",
          },
          "/api/v1/pets/",
          fetchPage,
        ),
      ).resolves.toEqual({
        count: 2,
        results: [{ id: 3 }, { id: 2 }],
        next: null,
      });
      expect(fetchPage).toHaveBeenCalledWith("/api/v1/pets/?page=2");
    });

    it("rejects pagination links outside the endpoint", async () => {
      await expect(
        loadAllPages(
          {
            results: [],
            next: "https://example.com/api/v1/other/?page=2",
          },
          "/api/v1/pets/",
          vi.fn(),
        ),
      ).rejects.toThrow("La siguiente página de la lista no es válida.");
    });
  });

  it("returns empty results when there are no endpoints", async () => {
    await expect(loadSectionData([])).resolves.toEqual({ data: {}, failures: [] });
  });
});
