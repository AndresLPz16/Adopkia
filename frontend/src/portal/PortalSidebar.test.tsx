import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PortalSidebar } from "./PortalSidebar";

function renderSidebar(section: string) {
  const navTo = vi.fn();
  const props = {
    visibleLinks: ["dashboard", "pets", "requests"],
    dynamicResources: [],
    visibleSectionNames: {
      dashboard: "Inicio",
      pets: "Mascotas",
      requests: "Solicitudes",
    },
    sidebarCopy: { heading: "Mi adopción", title: "Título", description: "Texto" },
    navTo,
  };
  const view = render(<PortalSidebar section={section} {...props} />);
  return {
    navTo,
    rerender: (next: string) =>
      view.rerender(<PortalSidebar section={next} {...props} />),
  };
}

describe("PortalSidebar mobile menu", () => {
  it("starts collapsed, shows the current section and toggles the navigation", () => {
    renderSidebar("pets");
    const navigation = screen.getByRole("navigation", { name: "Navegación principal" });
    const toggle = screen.getByRole("button", { name: "Abrir menú de navegación" });

    expect(navigation).toHaveAttribute("data-mobile-open", "false");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", navigation.id);
    expect(toggle).toHaveTextContent("Mascotas");

    fireEvent.click(toggle);

    expect(navigation).toHaveAttribute("data-mobile-open", "true");
    expect(
      screen.getByRole("button", { name: "Cerrar menú de navegación" }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("collapses again after moving to another section", () => {
    const { navTo, rerender } = renderSidebar("pets");
    fireEvent.click(screen.getByRole("button", { name: "Abrir menú de navegación" }));
    fireEvent.click(screen.getByRole("button", { name: /Solicitudes/ }));
    expect(navTo).toHaveBeenCalledWith("requests");

    rerender("requests");

    expect(
      screen.getByRole("navigation", { name: "Navegación principal" }),
    ).toHaveAttribute("data-mobile-open", "false");
    expect(
      screen.getByRole("button", { name: "Abrir menú de navegación" }),
    ).toHaveTextContent("Solicitudes");
  });
});
