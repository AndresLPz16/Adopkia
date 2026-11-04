import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  AdoptionsSection,
  RecordsSection,
  VaccineCatalogSection,
  VeterinariansSection,
} from "./CareSections";

describe("vaccine catalog", () => {
  it("allows roles with catalog permissions to add and edit available vaccines", async () => {
    const send = vi.fn(async () => true);
    const canDo = (_resource: string, action: string) =>
      ["create", "update"].includes(action);
    const { rerender } = render(
      <VaccineCatalogSection
        vaccines={[]}
        species={[{ id: 1, name: "Perro" }]}
        canDo={canDo}
        send={send}
        loading={false}
        busy={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Agregar vacuna" }));
    fireEvent.change(screen.getByLabelText("Especie"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Moquillo" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar vacuna" }));
    expect(send).toHaveBeenCalledWith(
      "/api/v1/vaccines/",
      "POST",
      expect.objectContaining({ species: 1, name: "Moquillo" }),
      "Vacuna agregada.",
    );

    rerender(
      <VaccineCatalogSection
        vaccines={[{ id: 3, species: 1, species_name: "Perro", name: "Moquillo" }]}
        species={[{ id: 1, name: "Perro" }]}
        canDo={canDo}
        send={send}
        loading={false}
        busy={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Editar vacuna" }));
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Moquillo modificado" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar vacuna" }));
    expect(send).toHaveBeenLastCalledWith(
      "/api/v1/vaccines/3/",
      "PATCH",
      expect.objectContaining({ name: "Moquillo modificado" }),
      "Vacuna actualizada.",
    );
  });
});

describe("reminder management", () => {
  it("lets a shelter record notes and mark a reminder as completed", async () => {
    const send = vi.fn(async () => true);
    render(
      <AdoptionsSection
        role="refugio"
        isPlatformSuperadmin={false}
        canDo={(resource, action) =>
          resource === "reminders" && action === "update"
        }
        adoptions={[]}
        followUps={[]}
        reminders={[
          {
            id: 8,
            adoption: 4,
            pet: 12,
            vaccine_name: "Antirrábica",
            reminder_type: "vacuna",
            scheduled_date: "2026-11-10",
            status: "pendiente",
          },
        ]}
        vaccines={[]}
        form={{}}
        setValue={vi.fn()}
        submit={(callback) => (event) => {
          event.preventDefault();
          void callback();
        }}
        send={send}
        loading={false}
        busy={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("Notas"), {
      target: { value: "Aplicada sin novedades." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(send).toHaveBeenCalledWith(
      "/api/v1/reminders/8/",
      "PATCH",
      expect.objectContaining({ notes: "Aplicada sin novedades." }),
      "Recordatorio actualizado.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Marcar realizado" }));
    expect(send).toHaveBeenLastCalledWith(
      "/api/v1/reminders/8/",
      "PATCH",
      { status: "cumplido" },
      "Recordatorio marcado como realizado.",
    );
  });
});

describe("veterinarian directory", () => {
  it("shows a registered veterinarian profile in the directory", () => {
    render(
      <VeterinariansSection
        loading={false}
        veterinarians={[
          {
            id: 2,
            user: 7,
            user_name: "Dra. Ana",
            professional_card: "TP-001",
            clinic: "Clínica Huellas",
            specialty: "Cirugía",
          },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Perfiles veterinarios" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Dra. Ana" })).toBeInTheDocument();
    expect(screen.getByText("Tarjeta profesional: TP-001")).toBeInTheDocument();
    expect(screen.getByText("Clínica: Clínica Huellas")).toBeInTheDocument();
  });
});

describe("medical record permissions", () => {
  it("shows edit and delete actions only when the role has those permissions", async () => {
    const send = vi.fn(async () => true);
    vi.stubGlobal("confirm", () => true);
    render(
      <RecordsSection
        role="administrador"
        isPlatformSuperadmin={false}
        canDo={(_resource, action) =>
          action === "update" || action === "delete"
        }
        userId={1}
        pets={[{ id: 12, name: "Luna", species: "Perro" }]}
        records={[
          {
            id: 9,
            pet: 12,
            pet_name: "Luna",
            date: "2026-10-25",
            record_type: "consulta",
            description: "Control general",
          },
        ]}
        vaccines={[]}
        veterinarians={[]}
        form={{}}
        setValue={vi.fn()}
        submit={(callback) => (event) => {
          event.preventDefault();
          void callback();
        }}
        send={send}
        loading={false}
        busy={false}
      />,
    );

    expect(screen.getByText("Luna · 2026-10-25")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Editar atención" }));
    fireEvent.change(screen.getByLabelText("Descripción y recomendaciones"), {
      target: { value: "Control actualizado." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(send).toHaveBeenCalledWith(
      "/api/v1/medical-records/9/",
      "PATCH",
      expect.objectContaining({ description: "Control actualizado." }),
      "Atención actualizada.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Eliminar atención" }));
    expect(send).toHaveBeenLastCalledWith(
      "/api/v1/medical-records/9/",
      "DELETE",
      undefined,
      "Registro médico eliminado.",
    );
  });
});
