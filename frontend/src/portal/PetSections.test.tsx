import type { FormEvent } from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PetsSection, RequestsSection } from "./PetSections";

function makePetsSectionProps(overrides: Record<string, unknown> = {}) {
  return {
    role: "adoptante",
    canDo: () => true,
    visiblePets: [],
    managedShelters: [],
    breeds: [],
    form: {},
    setValue: vi.fn(),
    submit: (callback: () => Promise<void>) => (event: FormEvent) => {
      event.preventDefault();
      void callback();
    },
    savePet: vi.fn().mockResolvedValue(true),
    send: vi.fn().mockResolvedValue(undefined),
    setForm: vi.fn(),
    editingPet: "",
    setEditingPet: vi.fn(),
    busy: false,
    loading: false,
    petSearch: "",
    setPetSearch: vi.fn(),
    onRequestAdoption: vi.fn(),
    ...overrides,
  };
}

describe("pet photo uploads", () => {
  it("shows an error when more than ten photos are selected", async () => {
    const user = userEvent.setup();
    const savePet = vi.fn().mockResolvedValue(true);
    render(
      <PetsSection
        role="refugio"
        canDo={() => true}
        visiblePets={[]}
        managedShelters={[{ id: 1, name: "Refugio" }]}
        breeds={[{ id: 1, name: "Mestizo" }]}
        form={{ shelter: "1", breed: "1", name: "Luna", size: "mediano" }}
        setValue={vi.fn()}
        submit={(callback) => (event) => {
          event.preventDefault();
          void callback();
        }}
        savePet={savePet}
        send={vi.fn().mockResolvedValue(undefined)}
        setForm={vi.fn()}
        editingPet=""
        setEditingPet={vi.fn()}
        busy={false}
        loading={false}
        petSearch=""
        setPetSearch={vi.fn()}
        onRequestAdoption={vi.fn()}
      />,
    );

    const input = screen.getByLabelText("O selecciona fotos desde tu dispositivo");
    const makePhotos = (count: number) =>
      Array.from({ length: count }, (_, index) =>
        new File([`photo-${index}`], `photo-${index}.jpg`, { type: "image/jpeg" }),
      );

    await user.upload(input, makePhotos(10));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    await user.upload(input, makePhotos(11));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "No se pueden subir más de 10 fotos por mascota.",
    );
    await user.click(screen.getByRole("button", { name: "Publicar mascota" }));
    expect(savePet).not.toHaveBeenCalled();
  });
});

describe("editing returned pets", () => {
  it("re-lists a returned pet before opening its edit form", async () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const send = vi.fn().mockResolvedValue(true);
    const setEditingPet = vi.fn();
    const setForm = vi.fn();
    render(
      <PetsSection
        {...makePetsSectionProps({
          role: "refugio",
          canDo: () => true,
          visiblePets: [
            {
              id: 33,
              name: "Neron",
              shelter: 4,
              breed: 2,
              size: "mediano",
              status: "Devuelta",
              status_code: "devuelta",
            },
          ],
          managedShelters: [{ id: 4, name: "Huellas" }],
          breeds: [{ id: 2, name: "Mestizo" }],
          send,
          setEditingPet,
          setForm,
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Editar" }));

    await waitFor(() => {
      expect(send).toHaveBeenCalledWith(
        "/api/v1/pets/33/relist/",
        "POST",
        {},
        "Mascota disponible nuevamente.",
      );
      expect(setEditingPet).toHaveBeenCalledWith("33");
    });
    expect(setForm).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Neron", shelter: "4" }),
    );
    vi.restoreAllMocks();
  });

  it("keeps edit mode available if the server blocks relisting", async () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const send = vi.fn().mockResolvedValue(false);
    const setEditingPet = vi.fn();
    render(
      <PetsSection
        {...makePetsSectionProps({
          role: "refugio",
          canDo: () => true,
          visiblePets: [
            {
              id: 33,
              name: "Neron",
              shelter: 4,
              breed: 2,
              size: "mediano",
              status: "Devuelta",
              status_code: "devuelta",
            },
          ],
          send,
          setEditingPet,
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    await waitFor(() => expect(send).toHaveBeenCalledOnce());

    expect(setEditingPet).toHaveBeenCalledWith("33");
    vi.restoreAllMocks();
  });
});

describe("adopter pet discovery", () => {
  it("opens a detailed photo gallery and starts a request for the selected pet", async () => {
    const onRequestAdoption = vi.fn();
    render(
      <PetsSection
        {...makePetsSectionProps({
          visiblePets: [
            {
              id: 42,
              name: "Luna",
              species: "Perro",
              breed_name: "Criolla",
              shelter_name: "Huellas",
              city: "Riohacha",
              age: 2,
              size: "mediano",
              health: "Vacunada y saludable.",
              temperament: "Cariñosa y tranquila.",
              status: "Disponible",
              photos: [
                { id: 1, url: "/luna-1.jpg", is_primary: true },
                { id: 2, url: "/luna-2.jpg", is_primary: false },
              ],
            },
          ],
          onRequestAdoption,
        })}
      />,
    );

    expect(
      screen.getByRole("region", { name: "Catálogo de mascotas disponibles" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ver detalles de Luna" }));

    const dialog = screen.getByRole("dialog", { name: "Luna" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText("Huellas")).toBeInTheDocument();
    expect(
      within(dialog).getByText("Vacunada y saludable."),
    ).toBeInTheDocument();
    expect(screen.getByAltText("Foto 1 de Luna")).toHaveAttribute(
      "src",
      "/luna-1.jpg",
    );
    fireEvent.click(screen.getByRole("button", { name: "Foto siguiente" }));
    expect(screen.getByAltText("Foto 2 de Luna")).toHaveAttribute(
      "src",
      "/luna-2.jpg",
    );
    expect(
      dialog.querySelector(".portal-pet-details-dialog__gallery-track"),
    ).toHaveStyle({ transform: "translateY(-100%)" });

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Solicitar adopción" }),
    );
    expect(onRequestAdoption).toHaveBeenCalledWith("42");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows adopter pets in pages of fifteen with numbered navigation", async () => {
    const pets = Array.from({ length: 17 }, (_, index) => ({
      id: index + 1,
      name: `Mascota ${index + 1}`,
      species: "Perro",
      status: "Disponible",
      photos: [],
    }));
    render(
      <PetsSection
        {...makePetsSectionProps({
          visiblePets: pets,
        })}
      />,
    );

    const catalog = screen.getByRole("region", {
      name: "Catálogo de mascotas disponibles",
    });
    const catalogViewport = within(catalog).getByRole("region", {
      name: "Listado de mascotas",
    });
    expect(within(catalogViewport).getAllByRole("article")).toHaveLength(15);
    expect(catalogViewport).toHaveAttribute("tabindex", "0");
    expect(
      within(catalog).getByRole("button", { name: "Página 1" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(catalog).getByRole("heading", { name: "Mascota 15" }),
    ).toBeInTheDocument();
    expect(
      within(catalog).queryByRole("heading", { name: "Mascota 16" }),
    ).not.toBeInTheDocument();

    await userEvent.click(within(catalog).getByRole("button", { name: "Página 2" }));

    expect(within(catalog).getAllByRole("article")).toHaveLength(2);
    expect(
      within(catalog).getByRole("button", { name: "Página 2" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(catalog).getByRole("heading", { name: "Mascota 16" }),
    ).toBeInTheDocument();
    expect(
      within(catalog).getByRole("heading", { name: "Mascota 17" }),
    ).toBeInTheDocument();
  });

  it("keeps catalog page controls visible when there is only one page", () => {
    render(
      <PetsSection
        {...makePetsSectionProps({
          visiblePets: [
            { id: 1, name: "Luna", species: "Gato", status: "Disponible" },
          ],
        })}
      />,
    );

    const pagination = screen.getByRole("navigation", {
      name: "Páginas de mascotas",
    });
    expect(
      within(pagination).getByRole("button", { name: "Página 1" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(pagination).getByRole("button", { name: "Página anterior" }),
    ).toBeDisabled();
    expect(
      within(pagination).getByRole("button", { name: "Página siguiente" }),
    ).toBeDisabled();
  });

  it("loads an adopter's pending request for editing and saves it with PATCH", async () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const setAnswers = vi.fn();
    const send = vi.fn().mockResolvedValue(true);
    const onRequestSubmitted = vi.fn();
    render(
      <RequestsSection
        role="adoptante"
        isPlatformSuperadmin={false}
        canDo={() => true}
        questions={[{ id: 5, prompt: "Cuéntanos sobre tu hogar", required: false }]}
        pets={[
          {
            id: 42,
            name: "Luna",
            species: "Perro",
            status: "En proceso",
          },
        ]}
        requests={[
          {
            id: 7,
            pet: 42,
            status: "Pending",
            status_code: "pendiente",
            answers: [{ question: 5, value: "Tengo patio" }],
          },
        ]}
        onRequestSubmitted={onRequestSubmitted}
        form={{ pet: "42" }}
        answers={{ "5": "Tengo patio" }}
        setAnswers={setAnswers}
        setValue={vi.fn()}
        submit={(callback) => (event) => {
          event.preventDefault();
          void callback();
        }}
        send={send}
        setError={vi.fn()}
        loading={false}
        busy={false}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Editar solicitud" }));

    expect(screen.getByRole("heading", { name: "Editar solicitud" })).toBeInTheDocument();
    const updateAnswers = setAnswers.mock.calls[0][0] as (
      current: Record<string, string>,
    ) => Record<string, string>;
    expect(updateAnswers({})).toEqual({ "5": "Tengo patio" });
    expect(screen.getByRole("combobox", { name: "Mascota" })).toHaveValue("42");

    fireEvent.submit(
      screen.getByRole("heading", { name: "Editar solicitud" }).closest("form")!,
    );

    await waitFor(() => {
      expect(send).toHaveBeenCalledWith(
        "/api/v1/adoption-requests/7/",
        "PATCH",
        {
          pet: 42,
          answers: [{ question: 5, value: "Tengo patio" }],
        },
        "Tu solicitud fue actualizada.",
      );
    });
    expect(onRequestSubmitted).toHaveBeenCalledOnce();

    await userEvent.click(screen.getByRole("button", { name: "Cancelar solicitud" }));
    await waitFor(() => {
      expect(send).toHaveBeenCalledWith(
        "/api/v1/adoption-requests/7/cancel/",
        "POST",
        {},
        "Solicitud cancelada.",
      );
    });
    vi.restoreAllMocks();
  });
});

describe("adoption request pet selection", () => {
  it("preselects the pet chosen from Explore pets and submits its id", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const onRequestSubmitted = vi.fn();
    render(
      <RequestsSection
        role="adoptante"
        isPlatformSuperadmin={false}
        canDo={() => true}
        questions={[{ id: 5, prompt: "Cuéntanos sobre tu hogar", required: false }]}
        pets={[
          {
            id: 42,
            name: "Luna",
            species: "Perro",
            status: "Disponible",
          },
        ]}
        requests={[]}
        requestedPetId="42"
        onRequestSubmitted={onRequestSubmitted}
        form={{}}
        answers={{}}
        setAnswers={vi.fn()}
        setValue={vi.fn()}
        submit={(callback) => (event) => {
          event.preventDefault();
          void callback();
        }}
        send={send}
        setError={vi.fn()}
        loading={false}
        busy={false}
      />,
    );

    expect(screen.getByRole("combobox", { name: "Mascota" })).toHaveValue("42");
    fireEvent.submit(screen.getByRole("heading", { name: "Iniciar una solicitud" }).closest("form")!);

    await waitFor(() => {
      expect(send).toHaveBeenCalledWith(
        "/api/v1/adoption-requests/",
        "POST",
        expect.objectContaining({ pet: 42 }),
        "Tu solicitud fue enviada al refugio.",
      );
    });
    expect(onRequestSubmitted).toHaveBeenCalledOnce();
  });
});

describe("adoption request review", () => {
  it("lets administrators decide pending requests and inspect the form answers", async () => {
    const send = vi.fn().mockResolvedValue(true);
    render(
      <RequestsSection
        role="administrador"
        isPlatformSuperadmin={false}
        canDo={() => true}
        questions={[{ id: 8, prompt: "¿Tienes experiencia con mascotas?" }]}
        pets={[]}
        requests={[
          {
            id: 12,
            pet: 5,
            pet_name: "Luna",
            applicant_name: "Ana",
            status: "pendiente",
            status_code: "pendiente",
            requested_at: "2026-03-15T13:45:00Z",
            answers: [{ question: 8, value: "Sí, tuve dos perros." }],
          },
        ]}
        form={{}}
        answers={{}}
        setAnswers={vi.fn()}
        setValue={vi.fn()}
        submit={(callback) => (event) => {
          event.preventDefault();
          void callback();
        }}
        send={send}
        setError={vi.fn()}
        loading={false}
        busy={false}
      />,
    );

    expect(screen.getByRole("button", { name: "Aprobar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rechazar" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver solicitud completa" }));
    expect(screen.getByText("¿Tienes experiencia con mascotas?")).toBeInTheDocument();
    expect(screen.getByText("Sí, tuve dos perros.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Aprobar" }));
    await waitFor(() =>
      expect(send).toHaveBeenCalledWith(
        "/api/v1/adoption-requests/12/approve/",
        "POST",
        { message: "" },
        "Solicitud aprobada.",
      ),
    );
  });
});
