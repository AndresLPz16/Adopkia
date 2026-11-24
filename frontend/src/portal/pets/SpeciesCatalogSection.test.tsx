import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SpeciesCatalogSection } from "./SpeciesCatalogSection";

const species = [
  { id: 1, name: "Perro" },
  { id: 2, name: "Tortuga" },
];
const breeds = [
  { id: 10, species: 1, name: "Mestizo" },
  { id: 11, species: 1, name: "Labrador" },
  { id: 20, species: 2, name: "Sin raza definida" },
];

function renderSection(canDo: (resource: string, action: string) => boolean = () => true) {
  const send = vi.fn(async () => true);
  render(
    <SpeciesCatalogSection
      species={species}
      breeds={breeds}
      canDo={canDo}
      send={send}
      loading={false}
      busy={false}
    />,
  );
  return send;
}

describe("species and breeds catalog", () => {
  it("lists each species with its own breeds", () => {
    renderSection();

    const dogBreeds = screen.getByRole("list", { name: "Razas de Perro" });
    expect(within(dogBreeds).getAllByRole("listitem")).toHaveLength(2);
    expect(within(screen.getByRole("list", { name: "Razas de Tortuga" })).getByText("Sin raza definida"))
      .toBeInTheDocument();
  });

  it("adds a species and a breed to the right species", () => {
    const send = renderSection();

    fireEvent.change(screen.getByLabelText("Nueva especie"), { target: { value: "Conejo" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar especie" }));
    expect(send).toHaveBeenCalledWith("/api/v1/species/", "POST", { name: "Conejo" }, "Especie agregada.");

    fireEvent.change(screen.getByLabelText("Nueva raza de Tortuga"), { target: { value: "Morrocoy" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Agregar raza" })[1]);
    expect(send).toHaveBeenLastCalledWith(
      "/api/v1/breeds/",
      "POST",
      { species: 2, name: "Morrocoy" },
      "Raza agregada.",
    );
  });

  it("renames a breed and removes one after confirming", async () => {
    const send = renderSection();

    fireEvent.click(screen.getByRole("button", { name: "Cambiar nombre de la raza Mestizo" }));
    fireEvent.change(screen.getByLabelText("Nombre de la raza"), { target: { value: "Criollo" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(send).toHaveBeenCalledWith("/api/v1/breeds/10/", "PATCH", { name: "Criollo" }, "Raza actualizada.");

    fireEvent.click(screen.getByRole("button", { name: "Quitar la raza Labrador" }));
    const confirmation = await screen.findByRole("alertdialog");
    fireEvent.click(within(confirmation).getByRole("button", { name: "Eliminar" }));
    await waitFor(() =>
      expect(send).toHaveBeenLastCalledWith("/api/v1/breeds/11/", "DELETE", undefined, "Raza eliminada."),
    );
  });

  it("shows the catalog read-only without edit permissions", () => {
    renderSection((_resource, action) => action === "read");

    expect(screen.queryByLabelText("Nueva especie")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Quitar la raza/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Eliminar especie" })).not.toBeInTheDocument();
  });
});
