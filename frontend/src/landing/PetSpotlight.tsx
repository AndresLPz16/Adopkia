import { Heart, PawPrint } from "lucide-react";
import type { PublicPetPreview } from "../publicCatalog";
import type { PetCatalog } from "./usePetCatalog";

export function PetSpotlight({
  catalog,
  featuredPet,
}: {
  catalog: PetCatalog;
  featuredPet: PublicPetPreview;
}) {
  const {
    pets,
    petsLoading,
    petsError,
    setSelectedPet,
    setSelectedPhotoIndex,
    photoOpenerRef,
  } = catalog;

  return (
    <section
      className="landing-spotlight"
      aria-labelledby="landing-spotlight-title"
    >
      <div className="landing-spotlight__intro">
        <p className="landing-eyebrow"><Heart size={13} fill="currentColor" aria-hidden="true" /> Una historia que empieza contigo</p>
        <h2 id="landing-spotlight-title">Cada perfil tiene algo especial.</h2>
        <p>
          Conoce de cerca a una de las mascotas disponibles en refugios
          verificados. Su información proviene del perfil publicado por su refugio.
        </p>
        {!petsLoading && !petsError && (
          <p className="landing-spotlight__count" aria-live="polite">
            <strong>{pets.length}</strong>
            {pets.length === 1
              ? " perfil disponible ahora"
              : " perfiles disponibles ahora"}
          </p>
        )}
      </div>
      <div className="landing-spotlight__card">
        <div className="landing-spotlight__photo">
          {(() => {
            const photo =
              featuredPet.photos.find((item) => item.is_primary) ??
              featuredPet.photos[0];
            return photo?.url ? (
              <img src={photo.url} alt={`Foto de ${featuredPet.name}`} loading="lazy" />
            ) : (
              <span aria-hidden="true"><PawPrint size={64} strokeWidth={1.5} /></span>
            );
          })()}
        </div>
        <div className="landing-spotlight__content">
          <p className="portal-eyebrow">Perfil disponible</p>
          <h3>{featuredPet.name}</h3>
          <p className="landing-spotlight__metadata">
            {[featuredPet.species, featuredPet.city]
              .filter(Boolean)
              .join(" · ") || "Conoce su perfil en Adopkia"}
          </p>
          {(featuredPet.age != null || featuredPet.size) && (
            <p className="landing-spotlight__facts">
              {[
                featuredPet.age != null &&
                  `${featuredPet.age} ${featuredPet.age === 1 ? "año" : "años"}`,
                featuredPet.size,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          {(featuredPet.breed_name || featuredPet.shelter_name) && (
            <p className="landing-spotlight__source">
              {[
                featuredPet.breed_name && `Raza: ${featuredPet.breed_name}`,
                featuredPet.shelter_name && `Refugio: ${featuredPet.shelter_name}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          <p className="landing-spotlight__description">
            {featuredPet.temperament?.trim() ||
              "Consulta su perfil para conocer la información que ha compartido su refugio."}
          </p>
          {featuredPet.health?.trim() && (
            <p className="landing-spotlight__health">
              <strong>Salud:</strong> {featuredPet.health}
            </p>
          )}
          <button
            className="portal-button"
            type="button"
            aria-label={`Ver perfil de ${featuredPet.name}`}
            onClick={(event) => {
              photoOpenerRef.current = event.currentTarget;
              const primaryPhotoIndex = featuredPet.photos.findIndex(
                (item) => item.is_primary,
              );
              setSelectedPhotoIndex(Math.max(0, primaryPhotoIndex));
              setSelectedPet(featuredPet);
            }}
          >
            Conocer a {featuredPet.name}
          </button>
        </div>
      </div>
    </section>
  );
}
