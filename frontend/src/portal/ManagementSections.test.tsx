import type { FormEvent } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UsersSection } from "./ManagementSections";

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
