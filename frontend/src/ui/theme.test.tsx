import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ThemeToggle, applyStoredTheme } from "./theme";

describe("theme", () => {
  afterEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it("starts in light mode and remembers the dark choice", () => {
    applyStoredTheme();
    expect(document.documentElement.dataset.theme).toBe("light");

    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: "Activar modo oscuro" }));

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(window.localStorage.getItem("adopkia.theme")).toBe("dark");
    expect(screen.getByRole("button", { name: "Activar modo claro" })).toBeInTheDocument();

    delete document.documentElement.dataset.theme;
    applyStoredTheme();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("keeps every toggle on screen in agreement", () => {
    render(
      <>
        <ThemeToggle />
        <ThemeToggle />
      </>,
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Activar modo oscuro" })[0]);
    expect(screen.getAllByRole("button", { name: "Activar modo claro" })).toHaveLength(2);
  });
});
