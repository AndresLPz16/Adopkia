import { ArrowLeft, ArrowRight, Heart, MapPin, PawPrint, Search } from "lucide-react";
import type { AuthFlow } from "./useAuthFlow";
import type { PetCatalog } from "./usePetCatalog";

export function PetCarousel({
  catalog,
  showAuthentication,
}: {
  catalog: PetCatalog;
  showAuthentication: AuthFlow["showAuthentication"];
}) {
  const {
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
    carouselPage,
    setCarouselPage,
    carouselRef,
    scrollCarousel,
    setSelectedPet,
    setSelectedPhotoIndex,
    likedPetIds,
    togglePetLike,
    photoOpenerRef,
  } = catalog;

  return (
    <section className="landing-pets" id="mascotas">
      <div className="landing-pets__heading">
        <div>
          <p className="landing-eyebrow"><Heart size={13} fill="currentColor" aria-hidden="true" /> Encuentra a tu compañero</p>
          <h2>Conoce a quienes buscan hogar</h2>
          <p>Cada perfil es una oportunidad para empezar una historia juntos.</p>
        </div>
        {!petsLoading && !petsError && <span className="landing-pets__count">{visiblePets.length} {visiblePets.length === 1 ? "mascota" : "mascotas"} disponibles</span>}
        {petPages.length > 1 && (
          <div className="landing-carousel__controls" aria-label="Controles del carrusel de mascotas">
            <button
              type="button"
              aria-label="Mostrar mascotas anteriores"
              onClick={() => scrollCarousel(-1)}
              disabled={carouselPage === 0}
            >
              <ArrowLeft size={18} aria-hidden="true" />
            </button>
            <span aria-live="polite">{carouselPage + 1} / {petPages.length}</span>
            <button
              type="button"
              aria-label="Mostrar más mascotas"
              onClick={() => scrollCarousel(1)}
              disabled={carouselPage === petPages.length - 1}
            >
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
      {petsError && <p className="portal-alert portal-alert--error">{petsError}</p>}
      <div className="landing-filters">
        <label className="landing-filter landing-filter--search">
          <span aria-hidden="true"><Search size={16} /></span>
          <input
            aria-label="Filtrar mascotas"
            placeholder="Nombre, ciudad o personalidad"
            value={petSearch}
            onChange={(event) => setPetSearch(event.target.value)}
          />
        </label>
        <label className="landing-filter">
          <span className="landing-filter__label">Especie</span>
          <select aria-label="Filtrar por especie" value={speciesFilter} onChange={(event) => setSpeciesFilter(event.target.value)}>
            <option value="">Todas</option>
            {speciesOptions.map((species) => <option key={species} value={species}>{species}</option>)}
          </select>
        </label>
        <label className="landing-filter">
          <span className="landing-filter__label">Ciudad</span>
          <select aria-label="Filtrar por ciudad" value={cityFilter} onChange={(event) => setCityFilter(event.target.value)}>
            <option value="">Todas</option>
            {cityOptions.map((city) => <option key={city} value={city}>{city}</option>)}
          </select>
        </label>
        <label className="landing-filter">
          <span className="landing-filter__label">Tamaño</span>
          <select aria-label="Filtrar por tamaño" value={sizeFilter} onChange={(event) => setSizeFilter(event.target.value)}>
            <option value="">Todos</option>
            {sizeOptions.map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
        <label className="landing-filter">
          <span className="landing-filter__label">Ordenar</span>
          <select aria-label="Ordenar mascotas" value={petSort} onChange={(event) => setPetSort(event.target.value)}>
            <option value="recent">Más recientes</option>
            <option value="name">Nombre (A–Z)</option>
            <option value="oldest">Más antiguas</option>
          </select>
        </label>
        {(petSearch || speciesFilter || cityFilter || sizeFilter || petSort !== "recent") && (
          <button className="landing-filters__clear" onClick={() => {
            setPetSearch("");
            setSpeciesFilter("");
            setCityFilter("");
            setSizeFilter("");
            setPetSort("recent");
          }}>
            Limpiar filtros
          </button>
        )}
      </div>
      <div
        className="landing-carousel__viewport"
        ref={carouselRef}
        aria-label="Mascotas disponibles"
        onScroll={(event) => {
          const pageWidth = event.currentTarget.clientWidth;
          if (pageWidth > 0) {
            setCarouselPage(Math.round(event.currentTarget.scrollLeft / pageWidth));
          }
        }}
      >
        <div className="landing-carousel__track">
        {petPages.map((page, pageIndex) => (
          <div className="landing-carousel__page" key={pageIndex}>
            {page.map((pet) => {
              const photo =
                pet.photos?.find((item) => item.is_primary) ?? pet.photos?.[0];
              return (
                <article className="portal-card landing-pet" key={pet.id}>
                  <div className="landing-pet__media">
                    <button
                      className="landing-pet__photo-open"
                      type="button"
                      aria-label={`Ver detalles de ${pet.name}`}
                      onClick={(event) => {
                        photoOpenerRef.current = event.currentTarget;
                        const primaryPhotoIndex = pet.photos.findIndex(
                          (item) => item.is_primary,
                        );
                        setSelectedPhotoIndex(Math.max(0, primaryPhotoIndex));
                        setSelectedPet(pet);
                      }}
                    >
                      {photo?.url ? (
                        <img src={photo.url} alt="" loading="lazy" />
                      ) : (
                        <span className="landing-pet__placeholder" aria-hidden="true"><PawPrint size={56} strokeWidth={1.5} /></span>
                      )}
                    </button>
                    <span className="landing-pet__badge"><Heart size={11} fill="currentColor" aria-hidden="true" /> Busca familia</span>
                  </div>
                  <div className="landing-pet__content">
                    <div className="landing-pet__title">
                      <div><h3>{pet.name}</h3><span>{pet.species}</span></div>
                      <button
                        className={`landing-pet__heart ${likedPetIds.has(pet.id) ? "landing-pet__heart--liked" : ""}`}
                        type="button"
                        aria-label={likedPetIds.has(pet.id) ? `Quitar de favoritos a ${pet.name}` : `Dar like a ${pet.name}`}
                        aria-pressed={likedPetIds.has(pet.id)}
                        onClick={() => togglePetLike(pet.id)}
                      >
                        <Heart size={18} fill={likedPetIds.has(pet.id) ? "currentColor" : "none"} aria-hidden="true" />
                      </button>
                    </div>
                    <p className="landing-pet__details">
                      <MapPin size={13} aria-hidden="true" /> {pet.city || "Ubicación por confirmar"}
                      {pet.age != null && <><span className="landing-pet__dot">·</span>{pet.age} {pet.age === 1 ? "año" : "años"}</>}
                    </p>
                    {(pet.size || pet.health?.trim()) && (
                      <div className="landing-pet__facts">
                        {pet.size && <span>{pet.size}</span>}
                        {pet.health?.trim() && (
                          <span className="landing-pet__health">
                            <strong>Salud:</strong> {pet.health}
                          </span>
                        )}
                      </div>
                    )}
                    {(pet.breed_name || pet.shelter_name) && (
                      <p className="landing-pet__source">
                        {[
                          pet.breed_name && `Raza: ${pet.breed_name}`,
                          pet.shelter_name && `Refugio: ${pet.shelter_name}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                    {pet.temperament && <p className="landing-pet__temperament">{pet.temperament}</p>}
                    <button className="landing-pet__action" onClick={() => showAuthentication("login")}>
                      Quiero adoptar <ArrowRight size={16} aria-hidden="true" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ))}
        </div>
        {!petsLoading && visiblePets.length === 0 && !petsError && (
          <div className="landing-pets__empty">
            <span aria-hidden="true"><Heart size={28} /></span>
            <strong>{pets.length ? "No encontramos coincidencias" : "Pronto habrá nuevos perfiles"}</strong>
            <p>{pets.length ? "Prueba con otros filtros para encontrar a tu compañero." : "Estamos preparando nuevas historias para que encuentres a tu mejor amigo."}</p>
            {(petSearch || speciesFilter || cityFilter || sizeFilter || petSort !== "recent") && <button className="portal-link" onClick={() => {
              setPetSearch("");
              setSpeciesFilter("");
              setCityFilter("");
              setSizeFilter("");
              setPetSort("recent");
            }}>Ver todas las mascotas</button>}
          </div>
        )}
        {petsLoading && (
          <div className="landing-pets__empty" role="status">
            <span aria-hidden="true"><Heart size={28} /></span><strong>Buscando mascotas disponibles…</strong>
          </div>
        )}
      </div>
    </section>
  );
}
