import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const pets = Array.from({ length: 7 }, (_, index) => ({
  id: index + 1,
  name: `Mascota ${index + 1}`,
  species: "Perro",
  city: "Bogotá",
  age: 2,
  approximate_birth_date: "2024-01-15",
  size: "Mediano",
  health: "Cuenta con vacunas al día; requiere control veterinario.",
  temperament: "Amigable",
  status: "disponible",
  shelter_name: "Refugio Huellas",
  breed_name: "Mestizo",
  published_at: "2026-09-10T12:00:00Z",
  photos: index === 0
    ? [
        { id: 1, url: "/luna-principal.jpg", is_primary: true },
        { id: 2, url: "/luna-jugando.jpg", is_primary: false },
      ]
    : [],
}));

describe("public landing page", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ results: pets, next: null }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
  });

  it("keeps sign-in off the landing page and opens it when someone wants to adopt", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Conoce a quienes buscan hogar" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Correo o nombre de usuario")).not.toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Quiero adoptar" })[0]);

    expect(
      screen.getByRole("heading", { name: "Inicia sesión para continuar" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Correo o nombre de usuario")).toBeInTheDocument();
  });

  it("loads an animated math challenge before login", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        if (String(input).includes("login-challenge")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                challenge_id: "challenge-1",
                question: "7 + 4 = ?",
              }),
              { status: 200, headers: { "Content-Type": "application/json" } },
            ),
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify({ results: pets, next: null }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }),
    );
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Iniciar sesión" }));

    expect(await screen.findByText("7 + 4 = ?")).toHaveClass(
      "login-math-challenge__question",
    );
    expect(screen.getByLabelText("Tu respuesta")).toBeInTheDocument();
  });

  it("shows six pets per horizontal carousel page and resets after filtering", async () => {
    const user = userEvent.setup();
    render(<App />);

    const nextPage = await screen.findByRole("button", {
      name: "Mostrar más mascotas",
    });
    expect(screen.getAllByRole("article")).toHaveLength(7);
    expect(screen.getByText("1 / 2")).toBeInTheDocument();

    await user.click(nextPage);
    expect(screen.getByText("2 / 2")).toBeInTheDocument();

    await user.type(screen.getByRole("textbox", { name: "Filtrar mascotas" }), "Mascota 7");
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Mostrar más mascotas" })).not.toBeInTheDocument();
    });
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Mascota 7" })).toBeInTheDocument();
  });

  it("opens a pet details dialog from its photo and restores focus when closed", async () => {
    const user = userEvent.setup();
    render(<App />);

    const photo = await screen.findByRole("button", {
      name: "Ver detalles de Mascota 1",
    });
    await user.click(photo);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "Mascota 1" })).toBeInTheDocument();
    expect(within(dialog).getByText("Amigable")).toBeInTheDocument();
    expect(within(dialog).getByText("Bogotá")).toBeInTheDocument();
    expect(within(dialog).getByText("Refugio Huellas")).toBeInTheDocument();
    expect(within(dialog).getByText("Mestizo")).toBeInTheDocument();
    expect(
      within(dialog).getByText("Cuenta con vacunas al día; requiere control veterinario."),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("Mediano")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("img", { name: "Foto 1 de Mascota 1" }),
    ).toHaveAttribute("src", "/luna-principal.jpg");
    expect(within(dialog).getByText("1 / 2")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Foto siguiente" }));
    expect(
      within(dialog).getByRole("img", { name: "Foto 2 de Mascota 1" }),
    ).toHaveAttribute("src", "/luna-jugando.jpg");
    expect(within(dialog).getByText("2 / 2")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Foto anterior" }));
    expect(
      within(dialog).getByRole("img", { name: "Foto 1 de Mascota 1" }),
    ).toHaveAttribute("src", "/luna-principal.jpg");

    const likeButton = within(dialog).getByRole("button", {
      name: "Dar like a Mascota 1",
    });
    await user.click(likeButton);
    expect(likeButton).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getAllByRole("button", {
        name: "Quitar de favoritos a Mascota 1",
      }),
    ).toHaveLength(2);

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(photo).toHaveFocus();

    await user.click(photo);
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Quiero adoptar",
      }),
    );
    expect(
      screen.getByRole("heading", { name: "Inicia sesión para continuar" }),
    ).toBeInTheDocument();
  });

  it("shows up to ten images in Simon's photo carousel", async () => {
    const user = userEvent.setup();
    const photos = Array.from({ length: 12 }, (_, index) => ({
      id: index + 1,
      url: `/simon-${index + 1}.jpg`,
      is_primary: index === 0,
    }));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            results: [{ ...pets[0], name: "Simón", photos }],
            next: null,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Ver detalles de Simón" }));
    const dialog = within(screen.getByRole("dialog"));

    expect(dialog.getByText("1 / 10")).toBeInTheDocument();
    expect(dialog.getAllByRole("img")).toHaveLength(10);

    await user.click(dialog.getByRole("button", { name: "Foto siguiente" }));
    expect(dialog.getByText("2 / 10")).toBeInTheDocument();
    expect(dialog.getByRole("img", { name: "Foto 2 de Simón" })).toHaveAttribute(
      "src",
      "/simon-2.jpg",
    );
  });
});
