import type { MutableRefObject } from "react";
import { ACTIONS, RESOURCES, ROLES } from "../../rbac/types";
import { rows, text } from "../shared";
import type { PermissionCheck, PortalDataRow } from "../shared";

export function PetDetailsDialog({
  selectedPet,
  closePetDetails,
  petDialogCloseRef,
  selectedPhotoIndex,
  setSelectedPhotoIndex,
  role,
  canDo,
  onRequestAdoption,
}: {
  selectedPet: PortalDataRow;
  closePetDetails: () => void;
  petDialogCloseRef: MutableRefObject<HTMLButtonElement | null>;
  selectedPhotoIndex: number;
  setSelectedPhotoIndex: (value: number) => void;
  role: string;
  canDo: PermissionCheck;
  onRequestAdoption: (petId: string) => void;
}) {
  return (
    <div
      className="landing-pet-dialog__backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closePetDetails();
      }}
    >
      <section
        className="landing-pet-dialog portal-pet-details-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="portal-pet-details-title"
        aria-describedby="portal-pet-details-description"
        tabIndex={-1}
      >
        <button
          ref={petDialogCloseRef}
          className="landing-pet-dialog__close"
          type="button"
          aria-label="Cerrar detalles de la mascota"
          onClick={closePetDetails}
        >
          ×
        </button>
        {(() => {
          const photos = rows(selectedPet.photos);
          return (
            <div
              className="landing-pet-dialog__gallery"
              aria-label={`Fotos de ${text(selectedPet.name)}`}
            >
              {photos.length > 0 ? (
                <div
                  className="portal-pet-details-dialog__gallery-track"
                  style={{
                    transform: `translateY(-${selectedPhotoIndex * 100}%)`,
                  }}
                >
                  {photos.map((photo, index) => (
                    <div
                      className="portal-pet-details-dialog__gallery-slide"
                      key={text(photo.id) || text(photo.url)}
                    >
                      <img
                        className="landing-pet-dialog__photo"
                        src={text(photo.url)}
                        alt={`Foto ${index + 1} de ${text(selectedPet.name)}`}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="portal-pet-photo-placeholder" aria-hidden="true">
                  🐾
                </div>
              )}
              {photos.length > 1 && (
                <>
                  <button
                    className="landing-pet-dialog__gallery-arrow landing-pet-dialog__gallery-arrow--previous portal-pet-details-dialog__gallery-arrow--previous"
                    type="button"
                    aria-label="Foto anterior"
                    onClick={() =>
                      setSelectedPhotoIndex(
                        (selectedPhotoIndex - 1 + photos.length) % photos.length,
                      )
                    }
                  >
                    ↑
                  </button>
                  <button
                    className="landing-pet-dialog__gallery-arrow landing-pet-dialog__gallery-arrow--next portal-pet-details-dialog__gallery-arrow--next"
                    type="button"
                    aria-label="Foto siguiente"
                    onClick={() =>
                      setSelectedPhotoIndex((selectedPhotoIndex + 1) % photos.length)
                    }
                  >
                    ↓
                  </button>
                  <span className="landing-pet-dialog__gallery-count" aria-live="polite">
                    {selectedPhotoIndex + 1} / {photos.length}
                  </span>
                </>
              )}
            </div>
          );
        })()}
        <div className="landing-pet-dialog__content">
          <p className="portal-eyebrow">Disponible para adopción</p>
          <h2 id="portal-pet-details-title">{text(selectedPet.name)}</h2>
          <p
            className="landing-pet-dialog__summary"
            id="portal-pet-details-description"
          >
            {text(selectedPet.temperament) ||
              "Conoce a esta mascota que busca una familia."}
          </p>
          <dl className="landing-pet-dialog__details">
            <div>
              <dt>Especie</dt>
              <dd>{text(selectedPet.species) || "No especificada"}</dd>
            </div>
            <div>
              <dt>Raza</dt>
              <dd>{text(selectedPet.breed_name) || "No especificada"}</dd>
            </div>
            <div>
              <dt>Refugio</dt>
              <dd>{text(selectedPet.shelter_name) || "No especificado"}</dd>
            </div>
            <div>
              <dt>Ciudad</dt>
              <dd>{text(selectedPet.city) || "Por confirmar"}</dd>
            </div>
            <div>
              <dt>Edad aproximada</dt>
              <dd>
                {selectedPet.age == null
                  ? "No especificada"
                  : `${text(selectedPet.age)} ${
                      selectedPet.age === 1 ? "año" : "años"
                    }`}
              </dd>
            </div>
            <div>
              <dt>Tamaño</dt>
              <dd>{text(selectedPet.size) || "No especificado"}</dd>
            </div>
            <div className="landing-pet-dialog__health">
              <dt>Salud y condiciones médicas</dt>
              <dd>
                {text(selectedPet.health).trim() ||
                  "El refugio no ha añadido información médica. Consulta directamente con el refugio."}
              </dd>
            </div>
            {Boolean(selectedPet.approximate_birth_date) && (
              <div>
                <dt>Fecha aproximada de nacimiento</dt>
                <dd>
                  {new Date(
                    `${text(selectedPet.approximate_birth_date)}T12:00:00`,
                  ).toLocaleDateString("es-CO")}
                </dd>
              </div>
            )}
            {Boolean(selectedPet.published_at) && (
              <div>
                <dt>Perfil publicado</dt>
                <dd>
                  {new Date(text(selectedPet.published_at)).toLocaleDateString(
                    "es-CO",
                  )}
                </dd>
              </div>
            )}
          </dl>
          {role === ROLES.ADOPTER &&
            canDo(RESOURCES.ADOPTION_REQUESTS, ACTIONS.CREATE) && (
              <button
                className="portal-button"
                type="button"
                onClick={() => {
                  const petId = text(selectedPet.id);
                  closePetDetails();
                  onRequestAdoption(petId);
                }}
              >
                Solicitar adopción
              </button>
            )}
        </div>
      </section>
    </div>
  );
}
