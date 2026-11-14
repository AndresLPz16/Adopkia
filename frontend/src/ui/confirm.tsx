import { useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";
import { createRoot } from "react-dom/client";
import { TriangleAlert } from "lucide-react";

// Confirmación con el estilo de Adopkia en lugar del cuadro del navegador.
// Se usa como función: `if (await confirmAction({ ... })) { ... }`.

export type ConfirmOptions = {
  title: string;
  /** Explica la consecuencia; se omite si el título ya lo dice todo. */
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

function ConfirmDialog({
  options,
  onClose,
}: {
  options: ConfirmOptions;
  onClose: (confirmed: boolean) => void;
}) {
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  // El foco empieza en "Cancelar": Enter por reflejo no borra nada.
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose(false);
      return;
    }
    if (event.key !== "Tab") return;
    // Solo hay dos botones: el tabulador alterna entre ellos sin salir.
    event.preventDefault();
    const next =
      document.activeElement === cancelRef.current
        ? confirmRef.current
        : cancelRef.current;
    next?.focus();
  };

  return (
    <div
      className="confirm-dialog__backdrop"
      onKeyDown={onKeyDown}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose(false);
      }}
    >
      <section
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={options.message ? "confirm-dialog-message" : undefined}
      >
        <span className="confirm-dialog__icon" aria-hidden="true">
          <TriangleAlert size={22} />
        </span>
        <h2 id="confirm-dialog-title">{options.title}</h2>
        {options.message && <p id="confirm-dialog-message">{options.message}</p>}
        <div className="confirm-dialog__actions">
          <button
            ref={cancelRef}
            type="button"
            className="portal-button portal-button--secondary"
            onClick={() => onClose(false)}
          >
            {options.cancelLabel ?? "Cancelar"}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className="portal-button confirm-dialog__confirm"
            onClick={() => onClose(true)}
          >
            {options.confirmLabel ?? "Eliminar"}
          </button>
        </div>
      </section>
    </div>
  );
}

/**
 * Pide confirmación antes de una acción que no se puede deshacer.
 *
 * Monta el diálogo por su cuenta, así que funciona desde cualquier componente
 * sin proveedor. Al cerrarse devuelve el foco al botón que lo abrió.
 */
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const opener =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    let settled = false;

    const close = (confirmed: boolean) => {
      if (settled) return;
      settled = true;
      root.unmount();
      container.remove();
      if (opener?.isConnected) opener.focus();
      resolve(confirmed);
    };

    root.render(<ConfirmDialog options={options} onClose={close} />);
  });
}
