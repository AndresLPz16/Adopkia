export type PublicPetPreview = {
  id: number;
  name: string;
  species: string;
  breed_name: string;
  shelter_name: string;
  city: string;
  age: number | null;
  approximate_birth_date: string | null;
  size: string;
  health: string | null;
  temperament: string | null;
  status: string;
  published_at: string;
  photos: { id: number; url: string; is_primary: boolean }[];
};

type PetPage = {
  results: PublicPetPreview[];
  next: string | null;
};

async function readPetPage(response: Response): Promise<PetPage> {
  const body = await response.text();
  let data: unknown = null;
  if (body) {
    try {
      data = JSON.parse(body);
    } catch {
      data = body;
    }
  }

  if (!response.ok) {
    const message =
      data &&
      typeof data === "object" &&
      "detail" in data &&
      typeof data.detail === "string"
        ? data.detail
        : typeof data === "string" && data
          ? data
          : `La solicitud falló (HTTP ${response.status}).`;
    throw new Error(message);
  }

  if (Array.isArray(data)) {
    return { results: data as PublicPetPreview[], next: null };
  }
  if (
    !data ||
    typeof data !== "object" ||
    !("results" in data) ||
    !Array.isArray(data.results) ||
    !("next" in data) ||
    (data.next !== null && typeof data.next !== "string")
  ) {
    throw new Error("El catálogo de mascotas tiene un formato inválido.");
  }

  return {
    results: data.results as PublicPetPreview[],
    next: data.next,
  };
}

export async function loadPublicPets(
  fetchPage: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<PublicPetPreview[]> {
  const pets: PublicPetPreview[] = [];
  const visitedPages = new Set<string>();
  let pageUrl = "/api/v1/pets/?status=disponible";

  while (pageUrl) {
    if (visitedPages.has(pageUrl)) {
      throw new Error("La paginación del catálogo contiene un ciclo.");
    }
    visitedPages.add(pageUrl);

    const page = await readPetPage(
      await fetchPage(pageUrl, signal ? { signal } : undefined),
    );
    pets.push(...page.results);

    if (!page.next) break;
    const nextUrl = new URL(page.next, window.location.origin);
    if (nextUrl.pathname !== "/api/v1/pets/") {
      throw new Error("La siguiente página del catálogo no es válida.");
    }
    nextUrl.searchParams.set("status", "disponible");
    pageUrl = `${nextUrl.pathname}${nextUrl.search}`;
  }

  return pets;
}
