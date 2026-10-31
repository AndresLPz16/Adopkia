import { useEffect, useRef, useState } from "react";
import { ACTIONS, RESOURCES, ROLES } from "../rbac/types";
import type { Action, Resource } from "../rbac/types";
import {
  DataCard,
  EmptyState,
  Field,
  isAvailablePet,
  SectionTitle,
  rows,
  text,
} from "./shared";
import type {
  PortalDataRow,
  PortalPetSaver,
  PortalSender,
  PortalSubmit,
} from "./shared";

type PermissionCheck = (resource: Resource, action: Action) => boolean;

function formatRequestDateTime(value: unknown): string {
  const rawValue = text(value);
  if (!rawValue) return "No disponible";

  const date = new Date(rawValue);
  if (Number.isNaN(date.getTime())) return rawValue;

  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

export function PetsSection({
  role,
  canDo,
  visiblePets,
  managedShelters,
  breeds,
  form,
  setValue,
  submit,
  savePet,
  send,
  setForm,
  editingPet,
  setEditingPet,
  busy,
  loading,
  petSearch,
  setPetSearch,
  onRequestAdoption,
}: {
  role: string;
  canDo: PermissionCheck;
  visiblePets: PortalDataRow[];
  managedShelters: PortalDataRow[];
  breeds: PortalDataRow[];
  form: Record<string, string>;
  setValue: (name: string, value: string) => void;
  submit: PortalSubmit;
  savePet: PortalPetSaver;
  send: PortalSender;
  setForm: (value: Record<string, string>) => void;
  editingPet: string;
  setEditingPet: (value: string) => void;
  busy: boolean;
  loading: boolean;
  petSearch: string;
  setPetSearch: (value: string) => void;
  onRequestAdoption: (petId: string) => void;
}) {
  const [photoUrls, setPhotoUrls] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoInputKey, setPhotoInputKey] = useState(0);
  const [photoLimitError, setPhotoLimitError] = useState("");
  const [selectedPet, setSelectedPet] = useState<PortalDataRow | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [petPage, setPetPage] = useState(1);
  const photoOpenerRef = useRef<HTMLButtonElement | null>(null);
  const petDialogCloseRef = useRef<HTMLButtonElement | null>(null);
  const petsPerPage = 15;
  const existingPhotoCount = editingPet
    ? rows(visiblePets.find((pet) => text(pet.id) === editingPet)?.photos).length
    : 0;
  const photoUrlList = photoUrls
    .split(/\r?\n/)
    .map((url) => url.trim())
    .filter(Boolean);

  const validatePhotoCount = (urls: string[], files: File[]) => {
    const newPhotoCount = urls.length + files.length;
    const exceedsLimit =
      newPhotoCount > 0 && existingPhotoCount + newPhotoCount > 10;
    setPhotoLimitError(
      exceedsLimit
        ? "No se pueden subir más de 10 fotos por mascota."
        : "",
    );
    return !exceedsLimit;
  };

  const clearPhotos = () => {
    setPhotoUrls("");
    setPhotoFiles([]);
    setPhotoLimitError("");
    setPhotoInputKey((key) => key + 1);
  };

  const closePetDetails = () => {
    setSelectedPet(null);
    photoOpenerRef.current?.focus();
  };

  const openPetForEditing = async (pet: PortalDataRow) => {
    const status = text(pet.status_code || pet.status)
      .trim()
      .toLocaleLowerCase();
    if (status === "devuelta" || status === "returned") {
      await send(
        `/api/v1/pets/${text(pet.id)}/relist/`,
        "POST",
        {},
        "Mascota disponible nuevamente.",
      );
    }

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
  };

  useEffect(() => {
    if (!selectedPet) return;
    petDialogCloseRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePetDetails();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedPet]);

  const petCards = visiblePets.map((pet) => {
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
                onClick={() => void openPetForEditing(pet)}
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
              {(text(pet.status_code || pet.status)
                .trim()
                .toLocaleLowerCase() === "devuelta" ||
                text(pet.status_code || pet.status)
                  .trim()
                  .toLocaleLowerCase() === "returned") &&
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
  });

  const petPageCount = Math.ceil(petCards.length / petsPerPage);
  const visiblePetCards = petCards.slice(
    (petPage - 1) * petsPerPage,
    petPage * petsPerPage,
  );

  useEffect(() => {
    setPetPage(1);
  }, [petSearch, visiblePets.length]);

  useEffect(() => {
    if (petPageCount > 0 && petPage > petPageCount) {
      setPetPage(petPageCount);
    }
  }, [petPage, petPageCount]);

  return (
    <>
      <SectionTitle
        eyebrow={role === ROLES.ADOPTER ? "Encuentra compañía" : "Gestión del refugio"}
        title={role === ROLES.ADOPTER ? "Mascotas" : "Mascotas a tu cuidado"}
        description={
          role === ROLES.ADOPTER
            ? "Explora perfiles y comienza una solicitud de adopción."
            : "Publica y administra los perfiles de tus mascotas."
        }
      />
      {role === ROLES.ADOPTER && (
        <label className="portal-search">
          <span>Buscar por nombre, especie, ciudad o temperamento</span>
          <input
            type="search"
            value={petSearch}
            onChange={(event) => setPetSearch(event.target.value)}
            placeholder="Ej. Luna, perro, Medellín…"
          />
        </label>
      )}
      {role !== ROLES.ADOPTER && canDo(RESOURCES.PETS, ACTIONS.CREATE) && (
        <form
          className="portal-form"
          onSubmit={submit(async () => {
            if (!validatePhotoCount(photoUrlList, photoFiles)) return;
            const payload = {
              shelter: Number(form.shelter),
              breed: Number(form.breed),
              name: form.name,
              approximate_birth_date: form.approximate_birth_date || null,
              size: form.size,
              health: form.health || null,
              temperament: form.temperament || null,
            };
            const endpoint = editingPet
              ? `/api/v1/pets/${editingPet}/`
              : "/api/v1/pets/";
            const saved = await savePet(
              endpoint,
              editingPet ? "PUT" : "POST",
              payload,
              photoUrlList,
              photoFiles,
            );
            if (saved) clearPhotos();
          })}
        >
          <h2>{editingPet ? "Editar mascota" : "Publicar mascota"}</h2>
          <Field label="Nombre" name="name" value={form.name ?? ""} onChange={setValue} required />
          <Field label="Refugio" name="shelter" value={form.shelter ?? ""} onChange={setValue} required options={managedShelters.map((item) => ({ value: text(item.id), label: text(item.name) }))} />
          <Field label="Raza" name="breed" value={form.breed ?? ""} onChange={setValue} required options={breeds.map((item) => ({ value: text(item.id), label: `${text(item.name)}${item.species_name ? ` · ${text(item.species_name)}` : ""}` }))} />
          <Field label="Tamaño" name="size" value={form.size ?? ""} onChange={setValue} required options={[{ value: "pequeno", label: "Pequeño" }, { value: "mediano", label: "Mediano" }, { value: "grande", label: "Grande" }]} />
          <Field label="Fecha aproximada de nacimiento" name="approximate_birth_date" type="date" value={form.approximate_birth_date ?? ""} onChange={setValue} />
          <Field label="Salud" name="health" value={form.health ?? ""} onChange={setValue} multiline />
          <Field label="Temperamento" name="temperament" value={form.temperament ?? ""} onChange={setValue} />
          <label className="portal-field">
            <span>Enlaces de fotos (uno por línea)</span>
            <textarea
              value={photoUrls}
              onChange={(event) => {
                const nextUrls = event.target.value;
                setPhotoUrls(nextUrls);
                validatePhotoCount(
                  nextUrls.split(/\r?\n/).map((url) => url.trim()).filter(Boolean),
                  photoFiles,
                );
              }}
              placeholder="https://ejemplo.com/foto.jpg"
            />
          </label>
          <label className="portal-field">
            <span>O selecciona fotos desde tu dispositivo</span>
            <input
              key={photoInputKey}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              onChange={(event) => {
                const nextFiles = Array.from(event.target.files ?? []);
                setPhotoFiles(nextFiles);
                validatePhotoCount(photoUrlList, nextFiles);
              }}
            />
          </label>
          {photoLimitError && <p className="portal-alert portal-alert--error" role="alert">{photoLimitError}</p>}
          {photoFiles.length > 0 && (
            <p className="portal-form-hint">
              Fotos seleccionadas: {photoFiles.map((file) => file.name).join(", ")}
            </p>
          )}
          <div className="portal-form__actions">
            <button className="portal-button" disabled={busy}>{busy ? "Guardando…" : editingPet ? "Guardar cambios" : "Publicar mascota"}</button>
            {editingPet && <button className="portal-button portal-button--secondary" type="button" onClick={() => { setEditingPet(""); setForm({}); clearPhotos(); }}>Cancelar edición</button>}
          </div>
        </form>
      )}
      {role === ROLES.ADOPTER ? (
        <section className="portal-pet-carousel" aria-label="Catálogo de mascotas disponibles">
          {petPageCount > 0 && (
            <nav className="portal-pet-pagination" aria-label="Páginas de mascotas">
              <button
                className="portal-button portal-button--secondary"
                type="button"
                aria-label="Página anterior"
                disabled={petPage === 1}
                onClick={() => setPetPage((page) => page - 1)}
              >
                Anterior
              </button>
              {Array.from({ length: petPageCount }, (_, index) => {
                const page = index + 1;
                return (
                  <button
                    className={`portal-button portal-pet-pagination__number${page === petPage ? " is-active" : ""}`}
                    type="button"
                    key={page}
                    aria-label={`Página ${page}`}
                    aria-current={page === petPage ? "page" : undefined}
                    onClick={() => setPetPage(page)}
                  >
                    {page}
                  </button>
                );
              })}
              <button
                className="portal-button portal-button--secondary"
                type="button"
                aria-label="Página siguiente"
                disabled={petPage === petPageCount}
                onClick={() => setPetPage((page) => page + 1)}
              >
                Siguiente
              </button>
            </nav>
          )}
          <div
            className="portal-pet-carousel__viewport"
            role="region"
            aria-label="Listado de mascotas"
            tabIndex={0}
          >
            <div className="portal-pet-carousel__track">{visiblePetCards}</div>
          </div>
        </section>
      ) : (
        <div className="portal-grid">{petCards}</div>
      )}
      {!loading && visiblePets.length === 0 && <EmptyState>{petSearch ? "No encontramos mascotas con esos criterios." : "No hay mascotas disponibles para mostrar."}</EmptyState>}
      {selectedPet && (
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
      )}
    </>
  );
}

export function RequestsSection({
  role,
  isPlatformSuperadmin,
  canDo,
  questions,
  pets,
  requests,
  requestedPetId = "",
  onRequestSubmitted,
  form,
  answers,
  setAnswers,
  setValue,
  submit,
  send,
  setError,
  loading,
  busy,
}: {
  role: string;
  isPlatformSuperadmin: boolean;
  canDo: PermissionCheck;
  questions: PortalDataRow[];
  pets: PortalDataRow[];
  requests: PortalDataRow[];
  requestedPetId?: string;
  onRequestSubmitted?: () => void;
  form: Record<string, string>;
  answers: Record<string, string>;
  setAnswers: (value: (current: Record<string, string>) => Record<string, string>) => void;
  setValue: (name: string, value: string) => void;
  submit: PortalSubmit;
  send: PortalSender;
  setError: (value: string) => void;
  loading: boolean;
  busy: boolean;
}) {
  const [selectedRequest, setSelectedRequest] = useState<PortalDataRow | null>(
    null,
  );
  const [editingRequestId, setEditingRequestId] = useState("");
  const requestOpenerRef = useRef<HTMLButtonElement | null>(null);
  const requestDialogCloseRef = useRef<HTMLButtonElement | null>(null);
  const editingRequest = requests.find(
    (item) => text(item.id) === editingRequestId,
  );
  const editingPetId = editingRequest ? text(editingRequest.pet) : "";

  const startEditingRequest = (item: PortalDataRow) => {
    setEditingRequestId(text(item.id));
    setValue("pet", text(item.pet));
    setAnswers(() =>
      Object.fromEntries(
        rows(item.answers).map((answer) => [
          text(answer.question),
          text(answer.value),
        ]),
      ),
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const stopEditingRequest = () => {
    setEditingRequestId("");
    setValue("pet", requestedPetId);
    setAnswers(() => ({}));
  };

  useEffect(() => {
    if (!selectedRequest) return;
    requestDialogCloseRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedRequest(null);
        requestOpenerRef.current?.focus();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedRequest]);

  return (
    <>
      <SectionTitle
        eyebrow="Adopción responsable"
        title={
          role === ROLES.ADOPTER
            ? "Mis solicitudes"
            : isPlatformSuperadmin
              ? "Solicitudes de adopción"
              : "Solicitudes recibidas"
        }
        description={
          role === ROLES.ADOPTER
            ? "Consulta el avance y responde el formulario de adopción."
            : isPlatformSuperadmin
              ? "Abre cada solicitud para consultar sus respuestas y detalles."
              : "Revisa cada solicitud y acompaña a las familias interesadas."
        }
      />
      {role === ROLES.ADOPTER && canDo(RESOURCES.ADOPTION_REQUESTS, ACTIONS.CREATE) && (
        <form className="portal-form" onSubmit={submit(async () => {
          const petId = form.pet || requestedPetId;
          const requiredQuestions = questions.filter((question) => question.required === true);
          const missing = requiredQuestions.some((question) => !answers[text(question.id)]?.trim());
          if (missing) {
            setError("Completa todas las preguntas obligatorias antes de enviar.");
            return;
          }
          if (!petId) {
            setError("Selecciona la mascota que quieres adoptar.");
            return;
          }
          setValue("pet", petId);
          const wasSaved = await send(
            editingRequestId
              ? `/api/v1/adoption-requests/${editingRequestId}/`
              : "/api/v1/adoption-requests/",
            editingRequestId ? "PATCH" : "POST",
            {
            pet: Number(petId),
            answers: questions.map((question) => ({
              question: Number(question.id),
              value: answers[text(question.id)] ?? "",
            })),
            },
            editingRequestId
              ? "Tu solicitud fue actualizada."
              : "Tu solicitud fue enviada al refugio.",
          );
          if (wasSaved === false) return;
          setEditingRequestId("");
          onRequestSubmitted?.();
        })}>
          <h2>{editingRequestId ? "Editar solicitud" : "Iniciar una solicitud"}</h2>
          <Field label="Mascota" name="pet" value={form.pet || requestedPetId} onChange={setValue} required options={pets.filter((pet) => isAvailablePet(pet) || text(pet.id) === editingPetId).map((pet) => ({ value: text(pet.id), label: `${text(pet.name)} · ${text(pet.species)}` }))} />
          {questions.map((question) => (
            <Field key={text(question.id)} label={`${text(question.prompt)}${question.required ? " *" : ""}`} name={text(question.id)} value={answers[text(question.id)] ?? ""} onChange={(name, value) => setAnswers((current) => ({ ...current, [name]: value }))} required={question.required === true} multiline={question.answer_type === "texto"} type={question.answer_type === "numero" ? "number" : "text"} />
          ))}
          <div className="portal-inline-actions">
            <button className="portal-button" disabled={busy || questions.length === 0}>{busy ? "Guardando…" : editingRequestId ? "Guardar cambios" : "Enviar solicitud"}</button>
            {editingRequestId && (
              <button className="portal-button portal-button--secondary" type="button" onClick={stopEditingRequest} disabled={busy}>
                Dejar de editar
              </button>
            )}
          </div>
        </form>
      )}
      {(role === ROLES.SHELTER || role === ROLES.ADMIN) &&
        (canDo(RESOURCES.ADOPTION_REQUESTS, ACTIONS.APPROVE) ||
          canDo(RESOURCES.ADOPTION_REQUESTS, ACTIONS.REJECT)) && (
          <form
            className="portal-form portal-form--compact"
            onSubmit={(event) => event.preventDefault()}
          >
            <h2>Mensaje para la decisión</h2>
            <Field
              label="Nota para la familia (opcional)"
              name="decisionMessage"
              value={form.decisionMessage ?? ""}
              onChange={setValue}
            />
            <p className="portal-form-hint">
              Se incluirá al aprobar o rechazar una solicitud.
            </p>
          </form>
        )}
      <div className="portal-grid">
        {requests.map((item) => {
          const pet =
            (item.pet_details as PortalDataRow | undefined) ??
            pets.find((entry) => text(entry.id) === text(item.pet));
          const petName = text(pet?.name) || text(item.pet_name);
          const requestStatus = text(item.status_code || item.status)
            .trim()
            .toLocaleLowerCase();
          return (
            <DataCard
              key={text(item.id)}
              title={`${petName || "Mascota"} · ${text(item.applicant_name)}`}
              subtitle={`Solicitud #${text(item.id)} · ${text(item.requested_at).slice(0, 10)}`}
              status={text(item.status)}
              actions={
                <>
                  <button
                    className="portal-button portal-button--secondary"
                    type="button"
                    onClick={(event) => {
                      requestOpenerRef.current = event.currentTarget;
                      setSelectedRequest(item);
                    }}
                  >
                    Ver solicitud completa
                  </button>
                  {role === ROLES.ADOPTER &&
                    requestStatus === "pendiente" &&
                    canDo(RESOURCES.ADOPTION_REQUESTS, ACTIONS.UPDATE) && (
                      <div className="portal-inline-actions">
                        <button
                          className="portal-button portal-button--secondary"
                          type="button"
                          onClick={() => startEditingRequest(item)}
                        >
                          Editar solicitud
                        </button>
                        <button
                          className="portal-link portal-link--danger"
                          type="button"
                          onClick={async () => {
                            const wasCancelled = await send(
                              `/api/v1/adoption-requests/${text(item.id)}/cancel/`,
                              "POST",
                              {},
                              "Solicitud cancelada.",
                            );
                            if (
                              wasCancelled !== false &&
                              editingRequestId === text(item.id)
                            ) {
                              stopEditingRequest();
                            }
                          }}
                        >
                          Cancelar solicitud
                        </button>
                      </div>
                    )}
                  {(role === ROLES.SHELTER || role === ROLES.ADMIN) &&
                    requestStatus === "pendiente" && (
                      <div className="portal-inline-actions">
                        {canDo(RESOURCES.ADOPTION_REQUESTS, ACTIONS.APPROVE) && (
                          <button
                            className="portal-button"
                            type="button"
                            onClick={() =>
                              void send(
                                `/api/v1/adoption-requests/${text(item.id)}/approve/`,
                                "POST",
                                { message: form.decisionMessage ?? "" },
                                "Solicitud aprobada.",
                              )
                            }
                          >
                            Aprobar
                          </button>
                        )}
                        {canDo(RESOURCES.ADOPTION_REQUESTS, ACTIONS.REJECT) && (
                          <button
                            className="portal-button portal-button--secondary"
                            type="button"
                            onClick={() =>
                              void send(
                                `/api/v1/adoption-requests/${text(item.id)}/reject/`,
                                "POST",
                                { message: form.decisionMessage ?? "" },
                                "Solicitud rechazada.",
                              )
                            }
                          >
                            Rechazar
                          </button>
                        )}
                      </div>
                    )}
                </>
              }
            />
          );
        })}
      </div>
      {!loading && requests.length === 0 && <EmptyState>Aún no hay solicitudes para mostrar.</EmptyState>}
      {selectedRequest && (
        <div
          className="landing-pet-dialog__backdrop"
          data-testid="request-dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedRequest(null);
              requestOpenerRef.current?.focus();
            }
          }}
        >
          <section
            className="landing-pet-dialog portal-request-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="request-dialog-title"
            tabIndex={-1}
          >
            <button
              ref={requestDialogCloseRef}
              className="landing-pet-dialog__close"
              type="button"
              aria-label="Cerrar detalles de la solicitud"
              onClick={() => {
                setSelectedRequest(null);
                requestOpenerRef.current?.focus();
              }}
            >
              ×
            </button>
            <div className="landing-pet-dialog__content">
              <p className="portal-eyebrow">Solicitud de adopción</p>
              <h2 id="request-dialog-title">
                {text(
                  (selectedRequest.pet_details as PortalDataRow | undefined)?.name,
                ) || text(selectedRequest.pet_name) || "Mascota"}{" "}
                · {text(selectedRequest.applicant_name)}
              </h2>
              {(() => {
                const pet =
                  (selectedRequest.pet_details as PortalDataRow | undefined) ??
                  pets.find(
                    (entry) =>
                      text(entry.id) === text(selectedRequest.pet),
                  );
                const photos = rows(pet?.photos);
                const primaryPhoto =
                  photos.find((photo) => photo.is_primary) ?? photos[0];
                if (!pet) return null;
                return (
                  <div className="portal-request-pet">
                    {typeof primaryPhoto?.url === "string" && (
                      <img
                        src={primaryPhoto.url}
                        alt={`Foto de ${text(pet.name)}`}
                      />
                    )}
                    <div>
                      <strong>{text(pet.name) || text(selectedRequest.pet_name)}</strong>
                      <span>
                        {[pet.species, pet.breed_name, pet.city]
                          .map(text)
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      {Boolean(pet.health) && (
                        <span>
                          <strong>Salud:</strong> {text(pet.health)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}
              <dl className="landing-pet-dialog__details portal-request-dialog__metadata">
                <div>
                  <dt>Número de solicitud</dt>
                  <dd>#{text(selectedRequest.id)}</dd>
                </div>
                <div>
                  <dt>Estado</dt>
                  <dd>{text(selectedRequest.status)}</dd>
                </div>
                {Boolean(selectedRequest.shelter_notes) && (
                  <div className="portal-request-dialog__note">
                    <dt>Nota del refugio</dt>
                    <dd>{text(selectedRequest.shelter_notes)}</dd>
                  </div>
                )}
              </dl>
              <div className="portal-request-dialog__dates">
                <div className="portal-request-dialog__date">
                  <span>Fecha de solicitud</span>
                  <time dateTime={text(selectedRequest.requested_at)}>
                    {formatRequestDateTime(selectedRequest.requested_at)}
                  </time>
                </div>
                {Boolean(selectedRequest.responded_at) && (
                  <div className="portal-request-dialog__date">
                    <span>Fecha de respuesta</span>
                    <time dateTime={text(selectedRequest.responded_at)}>
                      {formatRequestDateTime(selectedRequest.responded_at)}
                    </time>
                  </div>
                )}
              </div>
              <h3 className="portal-request-dialog__answers-title">
                Respuestas del formulario
              </h3>
              {Array.isArray(selectedRequest.answers) &&
              selectedRequest.answers.length > 0 ? (
                <div className="portal-request-dialog__answers">
                  {(selectedRequest.answers as PortalDataRow[]).map((answer) => {
                    const question = questions.find(
                      (entry) => text(entry.id) === text(answer.question),
                    );
                    return (
                      <article
                        className="portal-request-dialog__answer"
                        key={text(answer.question)}
                      >
                        <h4>
                          {text(answer.question_prompt) ||
                            text(question?.prompt) ||
                            `Pregunta ${text(answer.question)}`}
                        </h4>
                        <p>{text(answer.value) || "Sin respuesta"}</p>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="portal-form-hint">
                  Esta solicitud no contiene respuestas del formulario.
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
