import { useEffect, useState } from "react";
import CountUp from "../ui/reactbits/CountUp";
import type { PetCatalog } from "./usePetCatalog";

type Stat = { key: string; value: number; label: string };

// Cifras reales del catálogo público: nada se escribe a mano. Si un dato no se
// puede cargar, esa cifra no se muestra en lugar de inventar un número.
export function LandingStats({ catalog }: { catalog: PetCatalog }) {
  const { pets, petsLoading, petsError } = catalog;
  const [shelterCount, setShelterCount] = useState<number | null>(null);

  const ready = !petsLoading && !petsError;

  // Se pide después del catálogo: las cifras solo se muestran cuando ya hay
  // mascotas, y así las dos peticiones no compiten al cargar la página.
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    // La lista pública de refugios solo incluye los verificados.
    fetch("/api/v1/shelters/?page_size=1", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { count?: unknown } | null) => {
        if (typeof data?.count === "number") setShelterCount(data.count);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [ready]);

  if (!ready || pets.length === 0) return null;

  const cities = new Set(pets.map((pet) => pet.city).filter(Boolean)).size;
  const species = new Set(pets.map((pet) => pet.species).filter(Boolean)).size;
  const stats: Stat[] = [
    { key: "pets", value: pets.length, label: pets.length === 1 ? "mascota espera un hogar" : "mascotas esperan un hogar" },
    ...(shelterCount !== null && shelterCount > 0
      ? [{ key: "shelters", value: shelterCount, label: shelterCount === 1 ? "refugio verificado" : "refugios verificados" }]
      : []),
    { key: "cities", value: cities, label: cities === 1 ? "ciudad con mascotas" : "ciudades con mascotas" },
    { key: "species", value: species, label: species === 1 ? "especie en el catálogo" : "especies en el catálogo" },
  ];

  return (
    <section className="landing-stats" aria-label="Adopkia en cifras">
      {stats.map((stat) => (
        <div key={stat.key} className="landing-stats__item">
          <strong>
            <CountUp to={stat.value} duration={1.4} />
          </strong>
          <span>{stat.label}</span>
        </div>
      ))}
    </section>
  );
}
