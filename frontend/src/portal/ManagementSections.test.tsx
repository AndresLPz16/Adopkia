import type { FormEvent } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SheltersSection, UsersSection } from "./ManagementSections";

function makeProps(isPlatformSuperadmin: boolean) {
  return {
    isAdmin: true,
    userId: 1,
    isPlatformSuperadmin,
    canDo: () => false,
    users: [
      {
        id: 1,
        name: "Ana López",
        username: "ana_adopta",
        email: "ana@example.com",
        role: "adoptante",
        active: true,
      },
      {
        id: 2,
        name: "Esperanza Animal",
        username: "esperanza_org",
        email: "contacto@example.com",
        role: "refugio",
        active: true,
      },
    ],
    availableRoleRows: [],
    form: {},
    setForm: vi.fn(),
    setValue: vi.fn(),
    submit: (callback: () => Promise<void>) => (event: FormEvent) => {
      event.preventDefault();
      void callback();
    },
    send: vi.fn(async () => {}),
    editingUser: "",
    setEditingUser: vi.fn(),
    roleNames: { adoptante: "Adoptante", refugio: "Refugio" },
    loading: false,
    busy: false,
    setError: vi.fn(),
  };
}

describe("user management search", () => {
  it("filters accounts by username, email, name, or role for the platform superadmin", () => {
    render(<UsersSection {...makeProps(true)} />);

    expect(screen.getByText("Usuarios registrados")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();

    const search = screen.getByRole("searchbox", {
      name: "Buscar por nombre, usuario, correo o rol",
    });
    const filterBy = (value: string) =>
      fireEvent.change(search, { target: { value } });

    filterBy("esperanza_org");
    expect(screen.getByRole("heading", { name: "Esperanza Animal" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Ana López" })).not.toBeInTheDocument();

    filterBy("ana@example.com");
    expect(screen.getByRole("heading", { name: "Ana López" })).toBeInTheDocument();

    filterBy("refugio");
    expect(screen.getByRole("heading", { name: "Esperanza Animal" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Ana López" })).not.toBeInTheDocument();

    filterBy("lópez");
    expect(screen.getByRole("heading", { name: "Ana López" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Esperanza Animal" })).not.toBeInTheDocument();
  });

  it("does not expose the search field to other administrators", () => {
    render(<UsersSection {...makeProps(false)} />);

    expect(
      screen.queryByRole("searchbox", {
        name: "Buscar por nombre, usuario, correo o rol",
      }),
    ).not.toBeInTheDocument();
  });
});

describe("shelter team management", () => {
  it("shows verification and rejection actions for each pending shelter to administrators", async () => {
    const send = vi.fn().mockResolvedValue(true);
    render(
      <SheltersSection
        role="administrador"
        userId={1}
        canDo={(_resource, action) => action === "verify"}
        shelters={[
          {
            id: 10,
            name: "Huellas",
            city: "Riohacha",
            address: "Calle 1",
            verification_status: "Pendiente",
          },
        ]}
        members={[]}
        form={{}}
        setForm={vi.fn()}
        setValue={vi.fn()}
        submit={vi.fn()}
        send={send}
        editingShelter=""
        setEditingShelter={vi.fn()}
        loading={false}
        busy={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Verificar" }));
    await vi.waitFor(() =>
      expect(send).toHaveBeenCalledWith(
        "/api/v1/shelters/10/verify/",
        "POST",
        { approved: true },
        "Refugio verificado.",
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Rechazar" }));
    await vi.waitFor(() =>
      expect(send).toHaveBeenCalledWith(
        "/api/v1/shelters/10/verify/",
        "POST",
        { approved: false },
        "Solicitud de refugio rechazada.",
      ),
    );
  });

  it("keeps each shelter's account email and position fields independent", async () => {
    const send = vi.fn().mockResolvedValue(true);
    render(
      <SheltersSection
        role="refugio"
        userId={1}
        canDo={() => true}
        shelters={[
          { id: 10, name: "Huellas", city: "Riohacha", address: "Calle 1" },
          { id: 20, name: "Patitas", city: "Bogotá", address: "Calle 2" },
        ]}
        members={[]}
        form={{}}
        setForm={vi.fn()}
        setValue={vi.fn()}
        submit={(callback) => (event) => {
          event.preventDefault();
          void callback();
        }}
        send={send}
        editingShelter=""
        setEditingShelter={vi.fn()}
        loading={false}
        busy={false}
      />,
    );

    expect(
      screen.queryByLabelText("ID de la cuenta de refugio a agregar"),
    ).not.toBeInTheDocument();
    const emails = screen.getAllByLabelText(
      "Correo de la cuenta de refugio a agregar",
    );
    const positions = screen.getAllByLabelText("Cargo");
    expect(emails).toHaveLength(2);
    expect(positions).toHaveLength(2);

    fireEvent.change(emails[0], { target: { value: "equipo@example.com" } });
    fireEvent.change(positions[0], { target: { value: "responsable" } });

    expect(emails[1]).toHaveValue("");
    expect(positions[0]).toHaveValue("responsable");
    expect(positions[1]).toHaveValue("colaborador");

    fireEvent.submit(emails[0].closest("form")!);
    await vi.waitFor(() =>
      expect(send).toHaveBeenCalledWith(
        "/api/v1/shelters/10/members/",
        "POST",
        { email: "equipo@example.com", position: "responsable" },
        "Integrante agregado.",
      ),
    );
  });
});
