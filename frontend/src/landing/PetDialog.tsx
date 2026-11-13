import type { PublicPetPreview } from "../publicCatalog";
import type { AuthFlow } from "./useAuthFlow";
import type { PetCatalog } from "./usePetCatalog";

export function PetDialog({
  catalog,
  selectedPet,
  showAuthentication,
}: {
  catalog: PetCatalog;
  selectedPet: PublicPetPreview;
  showAuthentication: AuthFlow["showAuthentication"];
}) {
  const {
    setSelectedPet,
    selectedPetPhotos,
    selectedPhotoIndex,
    changePetPhoto,
    likedPetIds,
    togglePetLike,
    dialogCloseRef,
  } = catalog;

  return (
    <div
      className="landing-pet-dialog__backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setSelectedPet(null);
      }}
    >
      <section
        className="landing-pet-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="landing-pet-dialog-title"
        aria-describedby="landing-pet-dialog-description"
        tabIndex={-1}
      >
        <button
          ref={dialogCloseRef}
          className="landing-pet-dialog__close"
          type="button"
          aria-label="Cerrar detalles de la mascota"
          onClick={() => setSelectedPet(null)}
        >
          ×
        </button>
        <div className="landing-pet-dialog__gallery" aria-label={`Fotos de ${selectedPet.name}`}>
          {selectedPetPhotos.length > 0 ? (
            <div
              className="landing-pet-dialog__gallery-track"
              style={{ transform: `translateX(-${selectedPhotoIndex * 100}%)` }}
            >
              {selectedPetPhotos.map((photo, index) => (
                <div className="landing-pet-dialog__gallery-slide" key={photo.id ?? photo.url}>
                  <img
                    className="landing-pet-dialog__photo"
                    src={photo.url}
                    alt={`Foto ${index + 1} de ${selectedPet.name}`}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="landing-pet-dialog__photo landing-pet__placeholder" aria-hidden="true">🐾</div>
          )}
          {selectedPetPhotos.length > 1 && (
            <>
              <button
                className="landing-pet-dialog__gallery-arrow landing-pet-dialog__gallery-arrow--previous"
                type="button"
                aria-label="Foto anterior"
                onClick={() => changePetPhoto(-1)}
              >
                ←
              </button>
              <button
                className="landing-pet-dialog__gallery-arrow landing-pet-dialog__gallery-arrow--next"
                type="button"
                aria-label="Foto siguiente"
                onClick={() => changePetPhoto(1)}
              >
                →
              </button>
              <span className="landing-pet-dialog__gallery-count" aria-live="polite">
                {selectedPhotoIndex + 1} / {selectedPetPhotos.length}
              </span>
            </>
          )}
        </div>
        <div className="landing-pet-dialog__content">
          <p className="portal-eyebrow">Busca una familia</p>
          <h2 id="landing-pet-dialog-title">{selectedPet.name}</h2>
          <p className="landing-pet-dialog__summary" id="landing-pet-dialog-description">
            {selectedPet.temperament || "Conoce a esta mascota que está buscando un hogar."}
          </p>
          <dl className="landing-pet-dialog__details">
            <div><dt>Especie</dt><dd>{selectedPet.species}</dd></div>
            <div><dt>Raza</dt><dd>{selectedPet.breed_name || "No especificada"}</dd></div>
            <div><dt>Refugio</dt><dd>{selectedPet.shelter_name || "No especificado"}</dd></div>
            <div><dt>Ciudad</dt><dd>{selectedPet.city || "Ubicación por confirmar"}</dd></div>
            {selectedPet.age != null && (
              <div><dt>Edad aproximada</dt><dd>{selectedPet.age} {selectedPet.age === 1 ? "año" : "años"}</dd></div>
            )}
            {selectedPet.size && <div><dt>Tamaño</dt><dd>{selectedPet.size}</dd></div>}
            {selectedPet.approximate_birth_date && (
              <div><dt>Fecha aproximada de nacimiento</dt><dd>{new Date(`${selectedPet.approximate_birth_date}T12:00:00`).toLocaleDateString("es-CO")}</dd></div>
            )}
            {selectedPet.published_at && (
              <div><dt>Perfil publicado</dt><dd>{new Date(selectedPet.published_at).toLocaleDateString("es-CO")}</dd></div>
            )}
            <div className="landing-pet-dialog__health">
              <dt>Salud y condiciones médicas</dt>
              <dd>
                {selectedPet.health?.trim()
                  ? selectedPet.health
                  : "El refugio no ha añadido información médica. Consulta directamente con el refugio."}
              </dd>
            </div>
          </dl>
          <button
            className={`landing-pet-dialog__like ${likedPetIds.has(selectedPet.id) ? "landing-pet-dialog__like--liked" : ""}`}
            type="button"
            aria-label={likedPetIds.has(selectedPet.id) ? `Quitar de favoritos a ${selectedPet.name}` : `Dar like a ${selectedPet.name}`}
            aria-pressed={likedPetIds.has(selectedPet.id)}
            onClick={() => togglePetLike(selectedPet.id)}
          >
            {likedPetIds.has(selectedPet.id) ? "♥ Te gusta esta mascota" : "♡ Me gusta"}
          </button>
          <button
            className="portal-button"
            type="button"
            onClick={() => {
              setSelectedPet(null);
              showAuthentication("login");
            }}
          >
            Quiero adoptar
          </button>
        </div>
      </section>
    </div>
  );
}
