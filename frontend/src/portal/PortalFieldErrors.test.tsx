import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../rbac/auth";
import Portal from "../Portal";
import { ApiError, apiFieldErrors } from "./shared";

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function stubApi(validationErrors: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url.includes("/api/v1/auth/me/")) {
        return jsonResponse({ id: 7, name: "Refugio Huellas", email: "r@example.com", role: "refugio" });
      }
      if (url.includes("/api/v1/auth/permissions/")) {
        return jsonResponse({
          roles: [
            {
              name: "refugio",
              permissions: [
                { resource: "shelters", action: "read" },
                { resource: "shelters", action: "create" },
              ],
            },
          ],
          resources: [],
        });
      }
      if (url.includes("/api/v1/auth/sidebar-labels/")) {
        return jsonResponse({ defaults: {}, labels: {} });
      }
      if (url.includes("/api/v1/shelters/") && method === "POST") {
        return jsonResponse(validationErrors, 400);
      }
      return jsonResponse([]);
    }),
  );
}

async function submitShelterForm() {
  render(
    <MemoryRouter initialEntries={["/app/shelters"]}>
      <AuthProvider getAccessToken={() => "mock-jwt-token"}>
        <Portal onLogout={vi.fn()} />
      </AuthProvider>
    </MemoryRouter>,
  );
  const name = await screen.findByLabelText("Nombre");
  fireEvent.change(name, { target: { value: "Huellas" } });
  fireEvent.change(screen.getByLabelText("Dirección"), { target: { value: "Calle 1" } });
  fireEvent.change(screen.getByLabelText("Ciudad"), { target: { value: "Riohacha" } });
  fireEvent.change(screen.getByLabelText("Correo de contacto"), { target: { value: "mal@correo" } });
  fireEvent.click(screen.getByRole("button", { name: "Registrar refugio" }));
}

describe("validation errors next to the field", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("marks the fields the server rejected and moves focus to the first one", async () => {
    stubApi({
      name: ["Ya existe un refugio con este nombre."],
      contact_email: ["Introduzca una dirección de correo electrónico válida."],
    });
    await submitShelterForm();

    const email = await screen.findByRole("textbox", { name: "Correo de contacto" });
    // La pestaña del navegador nombra la sección abierta.
    expect(document.title).toBe("Mi refugio y equipo · Adopkia");
    await waitFor(() => expect(email).toHaveAttribute("aria-invalid", "true"));
    expect(email).toHaveAccessibleDescription(
      "Introduzca una dirección de correo electrónico válida.",
    );
    const name = screen.getByRole("textbox", { name: "Nombre" });
    expect(name).toHaveAccessibleDescription("Ya existe un refugio con este nombre.");
    expect(screen.getByRole("textbox", { name: "Ciudad" })).not.toHaveAttribute("aria-invalid");
    expect(screen.getByRole("alert")).toHaveTextContent("Revisa los campos marcados.");
    await waitFor(() => expect(name).toHaveFocus());

    // Corregir un campo quita su error y deja el otro.
    fireEvent.change(name, { target: { value: "Huellas del Norte" } });
    expect(name).not.toHaveAttribute("aria-invalid");
    expect(email).toHaveAttribute("aria-invalid", "true");
  });

  it("keeps errors without a visible field in the general alert", async () => {
    stubApi({
      city: ["Este campo no puede estar en blanco."],
      verification_status: ["No puedes cambiar la verificación."],
    });
    await submitShelterForm();

    const city = await screen.findByRole("textbox", { name: "Ciudad" });
    await waitFor(() => expect(city).toHaveAttribute("aria-invalid", "true"));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Verification status: No puedes cambiar la verificación.",
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent("Este campo no puede estar en blanco.");
  });
});

describe("apiFieldErrors", () => {
  it("keeps per-field messages and leaves out general ones", () => {
    expect(
      apiFieldErrors({
        email: ["Ya está en uso."],
        phone: "Número no válido.",
        non_field_errors: ["Las fechas no coinciden."],
        detail: "No encontrado.",
      }),
    ).toEqual({ email: ["Ya está en uso."], phone: ["Número no válido."] });
    expect(apiFieldErrors("Error del servidor")).toEqual({});
  });

  it("is available on the error thrown for a failed response", () => {
    const error = new ApiError({ name: ["Obligatorio."] }, 400);
    expect(error.message).toBe("Nombre: Obligatorio.");
    expect(error.fieldErrors).toEqual({ name: ["Obligatorio."] });
  });
});
