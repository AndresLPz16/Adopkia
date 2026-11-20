import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ROLES } from "../../rbac/types";
import { PetCard } from "./PetCard";
import type { PortalDataRow } from "../shared";

// La API devuelve en `status` la etiqueta traducida y en `status_code` el código.
function renderCard(pet: PortalDataRow) {
  const send = vi.fn(async () => true);
  render(
    <PetCard
      pet={pet}
      role={ROLES.SHELTER}
      canDo={() => true}
      send={send}
      setEditingPet={vi.fn()}
      setForm={vi.fn()}
      clearPhotos={vi.fn()}
      onRequestAdoption={vi.fn()}
      photoOpenerRef={{ current: null }}
      setSelectedPhotoIndex={vi.fn()}
      setSelectedPet={vi.fn()}
    />,
  );
  return send;
}

describe("PetCard", () => {
  it("offers to put a returned pet up for adoption again", () => {
    const send = renderCard({
      id: 7,
      name: "neron",
      status: "Devuelta",
      status_code: "devuelta",
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Volver a poner en adopción" }),
    );
    expect(send).toHaveBeenCalledWith(
      "/api/v1/pets/7/relist/",
      "POST",
      {},
      "Mascota publicada de nuevo para adopción.",
    );
  });

  it("prefills the edit form with the size code, not its label", () => {
    const setForm = vi.fn();
    render(
      <PetCard
        pet={{ id: 9, name: "neron", size: "Mediano", size_code: "mediano" }}
        role={ROLES.SHELTER}
        canDo={() => true}
        send={vi.fn(async () => true)}
        setEditingPet={vi.fn()}
        setForm={setForm}
        clearPhotos={vi.fn()}
        onRequestAdoption={vi.fn()}
        photoOpenerRef={{ current: null }}
        setSelectedPhotoIndex={vi.fn()}
        setSelectedPet={vi.fn()}
      />,
    );
    window.scrollTo = vi.fn();

    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    expect(setForm).toHaveBeenCalledWith(expect.objectContaining({ size: "mediano" }));
  });

  it("does not offer it for an adopted pet", () => {
    renderCard({ id: 8, name: "alfredo", status: "Adoptada", status_code: "adoptada" });

    expect(
      screen.queryByRole("button", { name: "Volver a poner en adopción" }),
    ).not.toBeInTheDocument();
  });
});
