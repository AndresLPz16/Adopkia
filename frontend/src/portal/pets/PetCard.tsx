import type { MutableRefObject } from "react";
import { ACTIONS, RESOURCES, ROLES } from "../../rbac/types";
import { DataCard, rows, text } from "../shared";
import type { PermissionCheck, PortalDataRow, PortalSender } from "../shared";

export function PetCard({
  pet,
  role,
  canDo,
  send,
  setEditingPet,
  setForm,
  clearPhotos,
  onRequestAdoption,
  photoOpenerRef,
  setSelectedPhotoIndex,
  setSelectedPet,
}: {
  pet: PortalDataRow;
  role: string;
  canDo: PermissionCheck;
  send: PortalSender;
  setEditingPet: (value: string) => void;
  setForm: (value: Record<string, string>) => void;
  clearPhotos: () => void;
  onRequestAdoption: (petId: string) => void;
  photoOpenerRef: MutableRefObject<HTMLButtonElement | null>;
  setSelectedPhotoIndex: (value: number) => void;
  setSelectedPet: (value: PortalDataRow | null) => void;
}) {
  const photos = rows(pet.photos);
  const primaryPhoto = photos.find((photo) => photo.is_primary) ?? photos[0];
  return (
    <DataCard
      key={text(pet.id)}
      title={text(pet.name)}
      subtitle={`${text(pet.species)}${pet.city ? ` · ${text(pet.city)}` : ""}${pet.age != null ? ` · ${text(pet.age)} años` : ""}`}
      status={text(pet.status)}
      actions={
        role !== ROLES.ADOPTER && canDo(RESOURCES.PETS, ACTIONS.UPDATE) ? (
          <>
            <button
              className="portal-link"
              onClick={() => {
                setEditingPet(text(pet.id));
                clearPhotos();
                setForm({
                  name: text(pet.name),
                  shelter: text(pet.shelter),
                  breed: text(pet.breed),
                  size: text(pet.size),
                  approximate_birth_date: text(pet.approximate_birth_date),
                  health: text(pet.health),
                  temperament: text(pet.temperament),
                });
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              Editar
            </button>
            {canDo(RESOURCES.PETS, ACTIONS.DELETE) && (
              <button
                className="portal-link portal-link--danger"
                onClick={() => {
                  if (window.confirm(`¿Eliminar el perfil de ${text(pet.name)}?`)) {
                    void send(
                      `/api/v1/pets/${text(pet.id)}/`,
                      "DELETE",
                      undefined,
                      "Mascota eliminada.",
                    );
                  }
                }}
              >
                Eliminar
              </button>
            )}
            {pet.status === "devuelta" &&
              canDo(RESOURCES.PETS, ACTIONS.UPDATE) && (
                <button
                  className="portal-link"
                  onClick={() =>
                    void send(
                      `/api/v1/pets/${text(pet.id)}/relist/`,
                      "POST",
                      {},
                      "Mascota republicada.",
                    )
                  }
                >
                  Volver a publicar
                </button>
              )}
          </>
        ) : role === ROLES.ADOPTER &&
          canDo(RESOURCES.ADOPTION_REQUESTS, ACTIONS.CREATE) ? (
          <button
            className="portal-button"
            onClick={() => onRequestAdoption(text(pet.id))}
          >
            Solicitar adopción
          </button>
        ) : undefined
      }
    >
      <button
        className="portal-pet-photo-open"
        type="button"
        aria-label={`Ver detalles de ${text(pet.name)}`}
        onClick={(event) => {
          photoOpenerRef.current = event.currentTarget;
          const primaryIndex = photos.findIndex((photo) => photo.is_primary);
          setSelectedPhotoIndex(Math.max(0, primaryIndex));
          setSelectedPet(pet);
        }}
      >
        {typeof primaryPhoto?.url === "string" ? (
          <img
            className="portal-pet-photo"
            src={primaryPhoto.url}
            alt=""
            loading="lazy"
          />
        ) : (
          <span className="portal-pet-photo-placeholder" aria-hidden="true">
            🐾
          </span>
        )}
        <span>Ver información completa</span>
      </button>
      <p>{text(pet.temperament) || "Conoce más sobre esta mascota."}</p>
      {Boolean(pet.health) && (
        <p>
          <strong>Salud:</strong> {text(pet.health)}
        </p>
      )}
    </DataCard>
  );
}
