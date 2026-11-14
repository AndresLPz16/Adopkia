import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { confirmAction } from "./confirm";

describe("confirmAction", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("resolves true when the action is confirmed and removes the dialog", async () => {
    const answer = confirmAction({ title: "¿Eliminar a Luna?", message: "No se puede deshacer." });

    const dialog = await screen.findByRole("alertdialog", { name: "¿Eliminar a Luna?" });
    expect(within(dialog).getByText("No se puede deshacer.")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Eliminar" }));

    await expect(answer).resolves.toBe(true);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("starts on Cancelar and resolves false when cancelled or dismissed with Escape", async () => {
    const cancelled = confirmAction({ title: "¿Quitar permisos?", confirmLabel: "Quitar" });
    const dialog = await screen.findByRole("alertdialog");
    const cancel = within(dialog).getByRole("button", { name: "Cancelar" });
    await waitFor(() => expect(cancel).toHaveFocus());
    fireEvent.click(cancel);
    await expect(cancelled).resolves.toBe(false);

    const dismissed = confirmAction({ title: "¿Quitar permisos?" });
    fireEvent.keyDown(await screen.findByRole("alertdialog"), { key: "Escape" });
    await expect(dismissed).resolves.toBe(false);
  });

  it("returns focus to the button that opened it", async () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();

    const answer = confirmAction({ title: "¿Eliminar?" });
    fireEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Cancelar" }),
    );
    await answer;

    expect(opener).toHaveFocus();
  });
});
