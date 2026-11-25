import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LandingStats } from "./LandingStats";
import type { PetCatalog } from "./usePetCatalog";

const pets = [
  { id: 1, species: "Perro", city: "Riohacha" },
  { id: 2, species: "Gato", city: "Riohacha" },
  { id: 3, species: "Tortuga", city: "Maicao" },
];

function catalog(overrides: Partial<PetCatalog> = {}) {
  return { pets, petsLoading: false, petsError: "", ...overrides } as unknown as PetCatalog;
}

describe("LandingStats", () => {
  it("shows figures computed from the catalog and the verified shelter count", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ count: 4, results: [] }))));
    render(<LandingStats catalog={catalog()} />);

    expect(screen.getByText("mascotas esperan un hogar")).toBeInTheDocument();
    expect(screen.getByText("ciudades con mascotas")).toBeInTheDocument();
    expect(screen.getByText("especies en el catálogo")).toBeInTheDocument();
    expect(await screen.findByText("refugios verificados")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/v1/shelters/?page_size=1", expect.anything());
  });

  it("leaves out the shelter figure when it cannot be loaded", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 500 })));
    render(<LandingStats catalog={catalog()} />);

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.queryByText(/refugios? verificados?/)).not.toBeInTheDocument();
    expect(screen.getByText("mascotas esperan un hogar")).toBeInTheDocument();
  });

  it("shows nothing until the catalog has loaded", () => {
    vi.stubGlobal("fetch", vi.fn());
    const { container } = render(<LandingStats catalog={catalog({ petsLoading: true })} />);

    expect(container).toBeEmptyDOMElement();
    expect(fetch).not.toHaveBeenCalled();
  });
});
