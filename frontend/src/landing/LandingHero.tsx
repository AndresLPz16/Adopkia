import { useState } from "react";
import { MapPin, PawPrint, Search } from "lucide-react";
import BlurText from "../ui/reactbits/BlurText";
import Stack from "../ui/reactbits/Stack";
import type { PublicPetPreview } from "../publicCatalog";
import type { PetCatalog } from "./usePetCatalog";

// Fotos que se apilan en el hero: pocas, para que la pila se lea de un vistazo.
const HERO_PET_COUNT = 5;

function primaryPhotoUrl(pet: PublicPetPreview): string | undefined {
  return (pet.photos.find((photo) => photo.is_primary) ?? pet.photos[0])?.url;
}

export function LandingHero({ catalog }: { catalog: PetCatalog }) {
  const {
    petSearch,
    setPetSearch,
    pets,
    speciesOptions,
    speciesFilter,
    setSpeciesFilter,
    setSelectedPet,
    setSelectedPhotoIndex,
    photoOpenerRef,
  } = catalog;
  const heroPets = pets.filter((pet) => primaryPhotoUrl(pet)).slice(0, HERO_PET_COUNT);
  const [topIndex, setTopIndex] = useState(0);
  const topPet = heroPets[topIndex] ?? heroPets[0];

  const goToCatalog = () =>
    document.getElementById("mascotas")?.scrollIntoView({ behavior: "smooth" });

  return (
    <>
      <section className="landing-hero">
        <div className="landing-hero__copy">
          <BlurText
            as="h1"
            className="landing-hero__title"
            text="Alguien te está esperando en un refugio."
            trigger="load"
            animateBy="words"
            direction="bottom"
            delay={90}
            distance={18}
          />
          <p className="landing-hero__lead">
            Conoce mascotas de refugios verificados, revisa su historia y su salud,
            y envía tu solicitud cuando encuentres a la indicada.
          </p>
          <div className="landing-search">
            <span className="landing-search__icon" aria-hidden="true">
              <Search size={18} />
            </span>
            <input
              aria-label="Buscar mascotas por nombre, especie, ciudad o personalidad"
              placeholder="Nombre, especie, ciudad o personalidad"
              value={petSearch}
              onChange={(event) => setPetSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") goToCatalog();
              }}
            />
            <button type="button" onClick={goToCatalog}>
              Buscar
            </button>
          </div>
          {speciesOptions.length > 1 && (
            <div className="landing-hero__species" role="group" aria-label="Elige qué mascota buscas">
              <span>¿A quién buscas?</span>
              {speciesOptions.map((species) => (
                <button
                  key={species}
                  type="button"
                  className="landing-hero__chip"
                  aria-pressed={speciesFilter === species}
                  onClick={() => {
                    setSpeciesFilter(speciesFilter === species ? "" : species);
                    goToCatalog();
                  }}
                >
                  {species}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="landing-hero__art">
          <div className="landing-hero__sun" aria-hidden="true" />
          {topPet ? (
            <>
              <div className="landing-hero__stack">
                <Stack
                  key={heroPets.map((pet) => pet.id).join("-")}
                  ariaLabel="Mascotas que buscan hogar. Arrastra la foto o usa las flechas para ver la siguiente."
                  cards={heroPets.map((pet) => (
                    <img key={pet.id} src={primaryPhotoUrl(pet)} alt="" draggable={false} />
                  ))}
                  layout="pile"
                  spread={0.55}
                  radius={22}
                  frame={7}
                  onChange={setTopIndex}
                />
              </div>
              <div className="landing-hero__caption" aria-live="polite">
                <p>
                  <strong>{topPet.name}</strong>
                  {topPet.city && (
                    <span>
                      <MapPin size={14} aria-hidden="true" /> {topPet.city}
                    </span>
                  )}
                </p>
                <button
                  type="button"
                  className="landing-hero__meet"
                  onClick={(event) => {
                    photoOpenerRef.current = event.currentTarget;
                    const primaryIndex = topPet.photos.findIndex((photo) => photo.is_primary);
                    setSelectedPhotoIndex(Math.max(0, primaryIndex));
                    setSelectedPet(topPet);
                  }}
                >
                  Conocer a {topPet.name}
                </button>
              </div>
            </>
          ) : (
            <div className="landing-hero__placeholder" aria-hidden="true">
              <PawPrint size={72} strokeWidth={1.4} />
            </div>
          )}
        </div>
      </section>
    </>
  );
}
