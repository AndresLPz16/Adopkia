import { describe, expect, it, vi } from "vitest";
import { loadSectionData } from "./loadSectionData";

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

  it("returns empty results when there are no endpoints", async () => {
    await expect(loadSectionData([])).resolves.toEqual({ data: {}, failures: [] });
  });
});
