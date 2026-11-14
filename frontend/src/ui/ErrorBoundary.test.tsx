import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

function Broken(): never {
  throw new Error("fallo de prueba");
}

describe("ErrorBoundary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows its children while nothing fails", () => {
    render(
      <ErrorBoundary>
        <p>Contenido</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText("Contenido")).toBeInTheDocument();
  });

  it("replaces a crashed page with a way to recover", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("heading", { name: "Algo no salió bien" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos mostrar esta página");
    expect(screen.getByRole("button", { name: "Recargar la página" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir al inicio" })).toHaveAttribute("href", "/");
  });
});
