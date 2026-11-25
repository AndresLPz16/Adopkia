// Sesión del portal. El token de acceso vive solo en memoria y dura unos
// minutos; el de renovación está en una cookie HttpOnly que JavaScript no puede
// leer. Así, aunque un script ajeno llegara a ejecutarse en la página, no
// encontraría nada que llevarse en el almacenamiento del navegador.

// Solo una marca de "hay sesión" para no pedir una renovación a cada visitante
// anónimo; no contiene ningún dato que sirva para entrar.
const SESSION_HINT_KEY = "adopkia_session";
// Versiones anteriores guardaban los tokens aquí; se borran al cargar.
const LEGACY_TOKEN_KEYS = ["adopkia_access", "adopkia_refresh"];

let accessToken: string | null = null;
let pendingRenewal: Promise<string | null> | null = null;

function writeHint(present: boolean) {
  try {
    if (present) window.localStorage.setItem(SESSION_HINT_KEY, "1");
    else window.localStorage.removeItem(SESSION_HINT_KEY);
  } catch {
    // Sin almacenamiento (modo privado estricto) la sesión dura lo que la pestaña.
  }
}

export function forgetLegacyTokens() {
  try {
    for (const key of LEGACY_TOKEN_KEYS) window.localStorage.removeItem(key);
  } catch {
    // Nada que borrar.
  }
}

export function hasSessionHint(): boolean {
  try {
    return window.localStorage.getItem(SESSION_HINT_KEY) === "1";
  } catch {
    return false;
  }
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function startSession(token: string) {
  accessToken = token;
  writeHint(true);
}

export function clearSession() {
  accessToken = null;
  writeHint(false);
}

// Pide un token de acceso nuevo con la cookie. Varias peticiones que vencen a
// la vez comparten una sola renovación.
export function renewAccessToken(): Promise<string | null> {
  if (!pendingRenewal) {
    pendingRenewal = (async () => {
      try {
        const response = await fetch("/api/v1/auth/refresh/", {
          method: "POST",
          credentials: "same-origin",
        });
        const data = response.ok ? ((await response.json()) as { access?: unknown }) : null;
        if (typeof data?.access !== "string") {
          clearSession();
          return null;
        }
        startSession(data.access);
        return data.access;
      } catch {
        clearSession();
        return null;
      }
    })().finally(() => {
      pendingRenewal = null;
    });
  }
  return pendingRenewal;
}

// Revoca la cookie en el servidor. Si la red falla, la sesión local se borra
// igual y la cookie vence sola.
export async function endSession() {
  clearSession();
  try {
    await fetch("/api/v1/auth/logout/", { method: "POST", credentials: "same-origin" });
  } catch {
    // Sin conexión no hay nada más que hacer.
  }
}
