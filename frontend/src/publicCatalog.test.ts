import { describe, expect, it, vi } from "vitest";
import { loadPublicPets } from "./publicCatalog";

describe("loadPublicPets", () => {
  it("loads every page of the public catalog through the same-origin API path", async () => {
    const fetchPage = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: [{ id: 1, name: "Luna", status: "disponible" }],
            next: "http://localhost/api/v1/pets/?page=2",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: [{ id: 2, name: "Sol", status: "disponible" }],
            next: null,
          }),
          { status: 200 },
        ),
      );

    const pets = await loadPublicPets(fetchPage);

    expect(fetchPage.mock.calls.map(([url]) => url)).toEqual([
      "/api/v1/pets/?status=disponible",
      "/api/v1/pets/?page=2&status=disponible",
    ]);
    expect(pets.map((pet) => pet.name)).toEqual(["Luna", "Sol"]);
  });

  it("fails clearly when a catalog page points outside the pet endpoint", async () => {
    const fetchPage = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({ results: [], next: "https://example.com/other/" }),
        { status: 200 },
      ),
    );

    await expect(loadPublicPets(fetchPage)).rejects.toThrow(
      "La siguiente página del catálogo no es válida.",
    );
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });
});
