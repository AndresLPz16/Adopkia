import type { PointerEvent } from "react";

// Movimiento con intención: aparición al desplazarse e inclinación 3D de las
// tarjetas. Todo se desactiva si la persona pidió reducir el movimiento.

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

let revealObserver: IntersectionObserver | null = null;

function getRevealObserver() {
  if (revealObserver) return revealObserver;
  revealObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        (entry.target as HTMLElement).dataset.revealed = "true";
        revealObserver?.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
  );
  return revealObserver;
}

/**
 * `ref` para una sección que debe entrar suavemente al llegar a ella.
 *
 * El estado oculto solo lo pone este código, así que sin JavaScript, sin
 * IntersectionObserver o con movimiento reducido la sección se ve normal.
 */
export function revealRef(element: HTMLElement | null) {
  if (!element) return;
  if (element.dataset.revealed === "true") return;
  if (typeof IntersectionObserver === "undefined" || prefersReducedMotion()) {
    element.dataset.revealed = "true";
    return;
  }
  // Lo que ya está en pantalla al cargar no se anima.
  const box = element.getBoundingClientRect();
  if (box.top < window.innerHeight && box.bottom > 0) {
    element.dataset.revealed = "true";
    return;
  }
  element.dataset.revealed = "false";
  getRevealObserver().observe(element);
}

const MAX_TILT_DEGREES = 5;

/** Inclina una tarjeta hacia el cursor. Solo con ratón, no al tocar. */
export const tiltHandlers = {
  onPointerMove(event: PointerEvent<HTMLElement>) {
    if (event.pointerType !== "mouse" || prefersReducedMotion()) return;
    const card = event.currentTarget;
    const box = card.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return;
    const x = (event.clientX - box.left) / box.width - 0.5;
    const y = (event.clientY - box.top) / box.height - 0.5;
    card.style.setProperty("--tilt-y", `${(x * 2 * MAX_TILT_DEGREES).toFixed(2)}deg`);
    card.style.setProperty("--tilt-x", `${(-y * 2 * MAX_TILT_DEGREES).toFixed(2)}deg`);
  },
  onPointerLeave(event: PointerEvent<HTMLElement>) {
    event.currentTarget.style.removeProperty("--tilt-x");
    event.currentTarget.style.removeProperty("--tilt-y");
  },
};
