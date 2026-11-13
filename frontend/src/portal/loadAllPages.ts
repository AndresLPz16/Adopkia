import { responseData } from "./shared";

type PortalRequest = (input: string) => Promise<Response>;

type Page = { results: unknown[]; next: string | null };

// Tope defensivo: 500 páginas de 20 registros son 10 000 filas por lista.
const MAX_PAGES = 500;

function isPage(value: unknown): value is Page {
  return Boolean(
    value &&
      typeof value === "object" &&
      "results" in value &&
      Array.isArray(value.results) &&
      "next" in value &&
      (value.next === null || typeof value.next === "string"),
  );
}

/**
 * Carga un endpoint y, si la respuesta está paginada, sigue `next` hasta
 * reunir todos los registros en un único arreglo. Las respuestas que no son
 * una página (un objeto o un arreglo) se devuelven tal cual.
 */
export async function loadAllPages(
  request: PortalRequest,
  url: string,
): Promise<unknown> {
  const first = await responseData(await request(url));
  if (!isPage(first)) return first;

  const expectedPath = new URL(url, window.location.origin).pathname;
  const visited = new Set<string>([url]);
  const results = [...first.results];
  let next = first.next;

  while (next) {
    // La API devuelve `next` como URL absoluta; se conserva solo ruta y
    // parámetros para seguir pasando por el mismo origen (y por el proxy).
    const nextUrl = new URL(next, window.location.origin);
    if (nextUrl.pathname !== expectedPath) {
      throw new Error("La siguiente página de resultados no es válida.");
    }
    const pageUrl = `${nextUrl.pathname}${nextUrl.search}`;
    if (visited.has(pageUrl)) {
      throw new Error("La paginación de resultados contiene un ciclo.");
    }
    if (visited.size >= MAX_PAGES) {
      throw new Error("Hay demasiados resultados para cargarlos de una vez.");
    }
    visited.add(pageUrl);

    const page = await responseData(await request(pageUrl));
    if (!isPage(page)) {
      throw new Error("Una página de resultados tiene un formato inválido.");
    }
    results.push(...page.results);
    next = page.next;
  }

  return results;
}
