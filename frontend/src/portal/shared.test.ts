import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  apiErrorMessage,
  DataCard,
  isAvailablePet,
  labelStatus,
  statusTone,
} from "./shared";

describe("isAvailablePet", () => {
  it("recognizes availability across localized display labels", () => {
    expect(isAvailablePet({ status_code: "disponible", status: "Available" })).toBe(true);
    expect(isAvailablePet({ status: "Disponible" })).toBe(true);
    expect(isAvailablePet({ status: "Available" })).toBe(true);
    expect(isAvailablePet({ status_code: "adoptada", status: "Adopted" })).toBe(false);
    expect(isAvailablePet({ status: "En proceso" })).toBe(false);
  });
});

describe("status presentation", () => {
  it("uses consistent labels and color tones for translated and coded statuses", () => {
    expect(labelStatus("PENDING")).toBe("Pendiente");
    expect(labelStatus("En proceso")).toBe("En proceso");
    expect(labelStatus("AVAILABLE")).toBe("Disponible");
    expect(labelStatus("Estado nuevo")).toBe("Estado nuevo");

    expect(statusTone("Disponible")).toBe("positive");
    expect(statusTone("pending")).toBe("warning");
    expect(statusTone("En proceso")).toBe("warning");
    expect(statusTone("Rechazada")).toBe("negative");
    expect(statusTone("Estado nuevo")).toBe("neutral");
  });

  it("renders card statuses with a semantic, accessible tone", () => {
    render(createElement(DataCard, { title: "Solicitud", status: "pending" }));

    expect(screen.getByText("Pendiente")).toHaveClass(
      "portal-badge",
      "portal-badge--warning",
    );
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
