import { describe, expect, it } from "vitest";
import { apiErrorMessage } from "./shared";

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
