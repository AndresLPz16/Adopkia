import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ROLES } from "../rbac/types";
import { DashboardSection, StatisticsSection } from "./OverviewSections";

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

  describe("adoption statistics", () => {
    it("shows charts and exports the complete report for printing", () => {
      const print = vi.fn();
      vi.stubGlobal("print", print);
      render(
        <StatisticsSection
          stats={{
            total_adoptions: 12,
            active_adoptions: 5,
            adopted_pets: 7,
            returned_adoptions: 2,
            returned_pets: 2,
            return_rate: 16.67,
          }}
        />,
      );

      expect(screen.getByRole("img", { name: /Estado de las adopciones/ })).toBeInTheDocument();
      expect(screen.getByRole("img", { name: /Estado de las mascotas/ })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Exportar informe / PDF" }));
      expect(print).toHaveBeenCalledOnce();
    });

    it("exports all statistics as CSV", () => {
      const createObjectURL = vi.fn(() => "blob:statistics");
      const revokeObjectURL = vi.fn();
      vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
      const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
      render(
        <StatisticsSection
          stats={{
            total_adoptions: 12,
            active_adoptions: 5,
            adopted_pets: 7,
            returned_adoptions: 2,
            returned_pets: 2,
            return_rate: 16.67,
          }}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Exportar CSV" }));

      expect(createObjectURL).toHaveBeenCalledOnce();
      expect(click).toHaveBeenCalledOnce();
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:statistics");
      expect(document.querySelector('a[download="estadisticas-adopkia.csv"]')).toBeNull();
    });
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
