export type SectionEndpointLoader = {
  key: string;
  load: () => Promise<unknown>;
};

export type SectionLoadFailure = {
  key: string;
  message: string;
};

type Page<T> = {
  results: T[];
  next: string | null;
};

function isPage(value: unknown): value is Page<unknown> {
  return Boolean(
    value &&
      typeof value === "object" &&
      "results" in value &&
      Array.isArray(value.results) &&
      "next" in value &&
      (value.next === null || typeof value.next === "string"),
  );
}

export async function loadAllPages(
  initial: unknown,
  endpoint: string,
  fetchPage: (url: string) => Promise<unknown>,
): Promise<unknown> {
  if (!isPage(initial)) return initial;

  const results = [...initial.results];
  const origin = window.location.origin;
  const endpointUrl = new URL(endpoint, origin);
  const visitedPages = new Set([`${endpointUrl.pathname}${endpointUrl.search}`]);
  let next = initial.next;

  while (next) {
    const nextUrl = new URL(next, origin);
    if (nextUrl.pathname !== endpointUrl.pathname) {
      throw new Error("La siguiente página de la lista no es válida.");
    }

    const pagePath = `${nextUrl.pathname}${nextUrl.search}`;
    if (visitedPages.has(pagePath)) {
      throw new Error("La paginación de la lista contiene un ciclo.");
    }
    visitedPages.add(pagePath);

    const page = await fetchPage(pagePath);
    if (!isPage(page)) {
      throw new Error("La respuesta de la página tiene un formato inválido.");
    }
    results.push(...page.results);
    next = page.next;
  }

  return { ...initial, count: results.length, next: null, results };
}

export async function loadSectionData(
  loaders: readonly SectionEndpointLoader[],
): Promise<{
  data: Record<string, unknown>;
  failures: SectionLoadFailure[];
}> {
  const results = await Promise.allSettled(loaders.map(({ load }) => load()));
  const data: Record<string, unknown> = {};
  const failures: SectionLoadFailure[] = [];

  results.forEach((result, index) => {
    const key = loaders[index].key;
    if (result.status === "fulfilled") {
      data[key] = result.value;
      return;
    }

    failures.push({
      key,
      message:
        result.reason instanceof Error
          ? result.reason.message
          : typeof result.reason === "string"
            ? result.reason
            : "Error desconocido.",
    });
  });

  return { data, failures };
}
