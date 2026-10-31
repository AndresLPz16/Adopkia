import { describe, expect, it } from "vitest";
import { apiErrorMessage, hasStatus, isAvailablePet } from "./shared";

describe("isAvailablePet", () => {
  it("recognizes availability across localized display labels", () => {
    expect(isAvailablePet({ status_code: "disponible", status: "Available" })).toBe(true);
    expect(isAvailablePet({ status: "Disponible" })).toBe(true);
    expect(isAvailablePet({ status: "Available" })).toBe(true);
    expect(isAvailablePet({ status_code: "adoptada", status: "Adopted" })).toBe(false);
    expect(isAvailablePet({ status: "En proceso" })).toBe(false);
  });
});

describe("apiErrorMessage", () => {
  it("shows field-specific validation errors from the API", () => {
    expect(
      apiErrorMessage(
        {
          password: ["This password is too common."],
          email: ["Ya existe una cuenta registrada con este correo."],
        },
        400,
      ),
    ).toBe(
      "Contraseña: This password is too common. · Correo electrónico: Ya existe una cuenta registrada con este correo.",
    );
  });

  describe("hasStatus", () => {
    it("matches localized labels without depending on capitalization", () => {
      expect(hasStatus("Disponible", "disponible")).toBe(true);
      expect(hasStatus("Pendiente", "pendiente")).toBe(true);
    });

    it("normalizes English status labels to their stored status codes", () => {
      expect(hasStatus("Available", "disponible")).toBe(true);
      expect(hasStatus("In progress", "en_proceso")).toBe(true);
      expect(hasStatus("Pending", "pendiente")).toBe(true);
    });
  });

  it("preserves API detail messages", () => {
    expect(apiErrorMessage({ detail: "No autorizado." }, 400)).toBe(
      "No autorizado.",
    );
  });

  it("does not display Django's HTML error page as an API message", () => {
    expect(
      apiErrorMessage("<!DOCTYPE html><html><body>Internal Server Error</body></html>", 500),
    ).toBe("El servidor tuvo un problema interno. Inténtalo más tarde.");
  });
});
