import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

// Tema claro u oscuro. El claro es el predeterminado; el oscuro se activa con
// el botón y se recuerda en este navegador.

export type Theme = "light" | "dark";

const THEME_KEY = "adopkia.theme";
const THEME_EVENT = "adopkia:theme";

function storedTheme(): Theme {
  try {
    return window.localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

/** Aplica el tema guardado a <html>. Se llama antes de pintar la aplicación. */
export function applyStoredTheme() {
  document.documentElement.dataset.theme = storedTheme();
}

function setTheme(theme: Theme) {
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Sin almacenamiento el tema vale solo para esta visita.
  }
  document.documentElement.dataset.theme = theme;
  window.dispatchEvent(new Event(THEME_EVENT));
}

/** Botón para alternar el tema; todos los botones en pantalla se mantienen de acuerdo. */
export function ThemeToggle() {
  const [theme, setCurrent] = useState<Theme>(storedTheme);

  useEffect(() => {
    const sync = () => setCurrent(storedTheme());
    window.addEventListener(THEME_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(THEME_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const next: Theme = theme === "dark" ? "light" : "dark";
  const label = next === "dark" ? "Activar modo oscuro" : "Activar modo claro";
  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={label}
      title={label}
      onClick={() => setTheme(next)}
    >
      {theme === "dark" ? (
        <Sun size={18} aria-hidden="true" />
      ) : (
        <Moon size={18} aria-hidden="true" />
      )}
    </button>
  );
}
