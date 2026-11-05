import { describe, expect, it } from "vitest";
import { apiErrorMessage, isAvailablePet } from "./shared";

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

  it("preserves API detail messages", () => {
    expect(apiErrorMessage({ detail: "No autorizado." }, 400)).toBe(
      "No autorizado.",
    );
  });
});
