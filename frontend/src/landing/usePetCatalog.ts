import { useEffect, useRef, useState } from "react";
import { loadPublicPets } from "../publicCatalog";
import type { PublicPetPreview } from "../publicCatalog";

// Catálogo público: carga, filtros, carrusel, favoritos y mascota abierta.
export function usePetCatalog() {
  const [pets, setPets] = useState<PublicPetPreview[]>([]);
  const [petsLoading, setPetsLoading] = useState(true);
  const [petsError, setPetsError] = useState("");
  const [petSearch, setPetSearch] = useState("");
  const [speciesFilter, setSpeciesFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [sizeFilter, setSizeFilter] = useState("");
  const [petSort, setPetSort] = useState("recent");
  const [carouselPage, setCarouselPage] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  const [selectedPet, setSelectedPet] = useState<PublicPetPreview | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [likedPetIds, setLikedPetIds] = useState<Set<number>>(() => new Set());
  const photoOpenerRef = useRef<HTMLButtonElement | null>(null);
  const dialogCloseRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    void loadPublicPets(fetch, controller.signal)
      .then((catalog) => {
        if (active) {
          setPets(catalog);
          setPetsLoading(false);
        }
      })
      .catch((caught: unknown) => {
        if (active && !controller.signal.aborted) {
          setPetsError(
            caught instanceof Error
              ? caught.message
              : "No se pudieron cargar las mascotas.",
          );
          setPetsLoading(false);
        }
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const speciesOptions = [...new Set(pets.map((pet) => pet.species).filter(Boolean))].sort();
  const cityOptions = [...new Set(pets.map((pet) => pet.city).filter(Boolean))].sort();
  const sizeOptions = [...new Set(pets.map((pet) => pet.size).filter(Boolean))].sort();
  const visiblePets = pets
    .filter((pet) => {
      const search = petSearch.trim().toLocaleLowerCase();
      const matchesSearch = !search ||
        [pet.name, pet.species, pet.city, pet.temperament, pet.breed_name, pet.shelter_name]
          .join(" ")
          .toLocaleLowerCase()
          .includes(search);
      return (
        matchesSearch &&
        (!speciesFilter || pet.species === speciesFilter) &&
        (!cityFilter || pet.city === cityFilter) &&
        (!sizeFilter || pet.size === sizeFilter)
      );
    })
    .sort((left, right) => {
      if (petSort === "name") {
        return left.name.localeCompare(right.name, "es");
      }
      if (petSort === "oldest") {
        return (Date.parse(left.published_at) || 0) - (Date.parse(right.published_at) || 0);
      }
      if (petSort === "recent") {
        return (Date.parse(right.published_at) || 0) - (Date.parse(left.published_at) || 0);
      }
      return 0;
    });
  const petPages = Array.from(
    { length: Math.ceil(visiblePets.length / 6) },
    (_, page) => visiblePets.slice(page * 6, page * 6 + 6),
  );
  const featuredPet = pets[0];

  useEffect(() => {
    setCarouselPage(0);
    const carousel = carouselRef.current;
    if (carousel) {
      if (typeof carousel.scrollTo === "function") {
        carousel.scrollTo({ left: 0 });
      } else {
        carousel.scrollLeft = 0;
      }
    }
  }, [petSearch, speciesFilter, cityFilter, sizeFilter, petSort]);

  useEffect(() => {
    if (!selectedPet) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogCloseRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedPet(null);
    };
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
      photoOpenerRef.current?.focus();
    };
  }, [selectedPet]);

  const togglePetLike = (petId: number) => {
    setLikedPetIds((current) => {
      const next = new Set(current);
      if (next.has(petId)) next.delete(petId);
      else next.add(petId);
      return next;
    });
  };

  const selectedPetPhotos = selectedPet?.photos.slice(0, 10) ?? [];

  const changePetPhoto = (direction: -1 | 1) => {
    if (selectedPetPhotos.length < 2) return;
    setSelectedPhotoIndex((current) =>
      (current + direction + selectedPetPhotos.length) %
      selectedPetPhotos.length,
    );
  };

  const scrollCarousel = (direction: -1 | 1) => {
    const nextPage = Math.max(
      0,
      Math.min(petPages.length - 1, carouselPage + direction),
    );
    const carousel = carouselRef.current;
    if (carousel) {
      const left = nextPage * carousel.clientWidth;
      if (typeof carousel.scrollTo === "function") {
        carousel.scrollTo({ left, behavior: "smooth" });
      } else {
        carousel.scrollLeft = left;
      }
    }
    setCarouselPage(nextPage);
  };

  return {
    pets,
    petsLoading,
    petsError,
    petSearch,
    setPetSearch,
    speciesFilter,
    setSpeciesFilter,
    cityFilter,
    setCityFilter,
    sizeFilter,
    setSizeFilter,
    petSort,
    setPetSort,
    speciesOptions,
    cityOptions,
    sizeOptions,
    visiblePets,
    petPages,
    featuredPet,
    carouselPage,
    setCarouselPage,
    carouselRef,
    scrollCarousel,
    selectedPet,
    setSelectedPet,
    selectedPetPhotos,
    selectedPhotoIndex,
    setSelectedPhotoIndex,
    changePetPhoto,
    likedPetIds,
    togglePetLike,
    photoOpenerRef,
    dialogCloseRef,
  };
}

export type PetCatalog = ReturnType<typeof usePetCatalog>;
