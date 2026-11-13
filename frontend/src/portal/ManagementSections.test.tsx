import { useState } from "react";
import type { FormEvent } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SheltersSection, UsersSection } from "./ManagementSections";

function makeProps(isPlatformSuperadmin: boolean) {
  return {
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
    availableRoleRows: [
      { name: "adoptante", label: "Adoptante" },
      { name: "refugio", label: "Refugio" },
      { name: "veterinario", label: "Veterinario" },
      { name: "administrador", label: "Administrador" },
      { name: "custom_role", label: "Rol personalizado" },
    ],
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
  it("shows all roles and keeps the edited user's current role selected", () => {
    const props = makeProps(false);
    const send = vi.fn(async () => {});
    const editableProps = {
      ...props,
      canDo: (_resource: string, action: string) =>
        action === "update" || action === "manage",
      send,
      editingUser: "1",
      form: { role: "adoptante" },
    };

    function EditableUsersSection() {
      const [form, setForm] = useState<Record<string, string>>(
        editableProps.form,
      );
      return (
        <UsersSection
          {...editableProps}
          form={form}
          setForm={setForm}
          setValue={(name, value) =>
            setForm((current) => ({ ...current, [name]: value }))
          }
        />
      );
    }

    render(<EditableUsersSection />);

    const roleSelect = screen.getByRole("combobox", { name: "Rol" });
    expect(roleSelect).toHaveValue("adoptante");
    expect(within(roleSelect).getByRole("option", { name: "Veterinario" })).toBeInTheDocument();
    expect(within(roleSelect).getByRole("option", { name: "Administrador" })).toBeInTheDocument();
    expect(within(roleSelect).getByRole("option", { name: "Rol personalizado" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeInTheDocument();

    fireEvent.change(roleSelect, { target: { value: "administrador" } });
    const form = screen.getByRole("button", { name: "Guardar cambios" }).closest("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form!);
    expect(send).toHaveBeenCalledWith(
      "/api/v1/auth/users/1/",
      "PATCH",
      expect.objectContaining({ role: "administrador" }),
      "Cuenta actualizada.",
    );
  });

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

  it("filters by role and status, and sorts the visible accounts", () => {
    render(<UsersSection {...makeProps(true)} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Filtrar por rol" }), {
      target: { value: "refugio" },
    });
    expect(screen.getByRole("heading", { name: "Esperanza Animal" })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Filtrar por estado" }), {
      target: { value: "inactive" },
    });
    expect(screen.getByText("No hay usuarios para mostrar.")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Filtrar por estado" }), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Filtrar por rol" }), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Ordenar por" }), {
      target: { value: "name-desc" },
    });
    expect(screen.getAllByRole("heading").map((heading) => heading.textContent)
      .filter((name) => name !== "Usuarios"))
      .toEqual(["Esperanza Animal", "Ana López"]);
  });

  it("paginates users and resets to the first page when the search changes", () => {
    const props = makeProps(true);
    render(
      <UsersSection
        {...props}
        users={Array.from({ length: 12 }, (_, index) => ({
          id: index + 1,
          name: `Usuario ${String(index + 1).padStart(2, "0")}`,
          username: `usuario_${index + 1}`,
          email: `usuario${index + 1}@example.com`,
          role: "adoptante",
          active: true,
        }))}
      />,
    );

    expect(screen.getByText("Mostrando 1–10 de 12 usuarios")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByText("Mostrando 11–12 de 12 usuarios")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Usuario 11" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Usuario 01" })).not.toBeInTheDocument();

    fireEvent.change(
      screen.getByRole("searchbox", { name: "Buscar por nombre, usuario, correo o rol" }),
      { target: { value: "Usuario 01" } },
    );
    expect(screen.getByText("Mostrando 1–1 de 1 usuarios")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Usuario 01" })).toBeInTheDocument();
  });

  it("allows other administrators to search accounts without exposing the superadmin count", () => {
    render(<UsersSection {...makeProps(false)} />);

    expect(screen.queryByText("Usuarios registrados")).not.toBeInTheDocument();
    const search = screen.getByRole("searchbox", {
        name: "Buscar por nombre, usuario, correo o rol",
      });
    fireEvent.change(search, { target: { value: "esperanza_org" } });
    expect(screen.getByRole("heading", { name: "Esperanza Animal" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Ana López" })).not.toBeInTheDocument();
  });
});

describe("shelter management actions", () => {
  it("shows and executes shelter deletion when the role has delete permission", () => {
    const send = vi.fn(async () => true);
    vi.stubGlobal("confirm", () => true);
    render(
      <SheltersSection
        role="refugio"
        userId={7}
        canDo={(resource, action) =>
          resource === "shelters" && action === "delete"
        }
        shelters={[
          {
            id: 3,
            name: "Huellas",
            city: "Riohacha",
            address: "Calle 1",
            verification_status: "verificado",
          },
        ]}
        members={[{ shelter: 3, user: 7 }]}
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

    fireEvent.click(screen.getByRole("button", { name: "Eliminar refugio" }));

    expect(send).toHaveBeenCalledWith(
      "/api/v1/shelters/3/",
      "DELETE",
      undefined,
      "Refugio eliminado.",
    );
    vi.unstubAllGlobals();
  });
});
