import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ROLES } from "../rbac/types";
import { DashboardSection } from "./OverviewSections";

function makeProps(role: string) {
  return {
    userName: "Alex",
    role,
    roleName: role,
    isAdmin: role === ROLES.ADMIN,
    shelters: [],
    pets: [{ status: "disponible" }],
    managedPets: [{ status: "disponible" }, { status: "adoptada" }],
    records: [{ id: 1 }],
    vaccines: [{ id: 1 }, { id: 2 }],
    requests: [{ status: "pendiente" }],
    adoptions: [{ status: "activa" }],
    notifications: [],
    visibleLinks: ["dashboard", "pets", "records", "requests", "adoptions"],
    sectionNames: {
      pets: "Mascotas",
      records: "Atención veterinaria",
      requests: "Solicitudes",
    },
    navTo: vi.fn(),
  };
}

describe("role-specific dashboard", () => {
  it("prioritizes adoption discovery for adopters", () => {
    const props = makeProps(ROLES.ADOPTER);
    render(<DashboardSection {...props} />);

    expect(
      screen.getByRole("heading", { name: "Encuentra a tu nuevo compañero" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Mascotas disponibles")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Explorar mascotas" }));
    expect(props.navTo).toHaveBeenCalledWith("pets");
  });

  it("prioritizes medical records and vaccines for veterinarians", () => {
    const props = makeProps(ROLES.VETERINARIAN);
    render(<DashboardSection {...props} />);

    expect(
      screen.getByRole("heading", { name: "Cuida cada historia" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Expedientes médicos")).toHaveLength(2);
    expect(screen.getByText("Vacunas registradas")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Abrir expedientes" }));
    expect(props.navTo).toHaveBeenCalledWith("records");
  });
});
