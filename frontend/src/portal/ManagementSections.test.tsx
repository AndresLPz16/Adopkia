import { useState } from "react";
import type { FormEvent } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
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
    expect(screen.getByRole("option", { name: "Veterinario" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Administrador" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Rol personalizado" })).toBeInTheDocument();
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
      });
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
