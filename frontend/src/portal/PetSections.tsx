import { useState } from "react";
import { ACTIONS, RESOURCES, ROLES } from "../rbac/types";
import type { Action, Resource } from "../rbac/types";
import { DataCard, EmptyState, Field, SectionTitle, hasStatus, rows, text } from "./shared";
import type {
  PortalDataRow,
  PortalPetSaver,
  PortalSender,
  PortalSubmit,
} from "./shared";

type PermissionCheck = (resource: Resource, action: Action) => boolean;

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
  onRefresh,
  petSearch,
  setPetSearch,
  navTo,
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
  onRefresh: () => void;
  petSearch: string;
  setPetSearch: (value: string) => void;
  navTo: (key: string) => void;
}) {
  const [photoUrls, setPhotoUrls] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoInputKey, setPhotoInputKey] = useState(0);

  const clearPhotos = () => {
    setPhotoUrls("");
    setPhotoFiles([]);
    setPhotoInputKey((key) => key + 1);
  };

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
        action={
          <button
            type="button"
            className="portal-button portal-button--secondary"
            onClick={onRefresh}
            disabled={loading}
          >
            {loading ? "Actualizando…" : "Actualizar datos"}
          </button>
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
              photoUrls.split(/\r?\n/).map((url) => url.trim()).filter(Boolean),
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
              onChange={(event) => setPhotoUrls(event.target.value)}
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
              onChange={(event) => setPhotoFiles(Array.from(event.target.files ?? []))}
            />
          </label>
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
      <div className="portal-grid">
        {visiblePets.map((pet) => {
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
                    <button className="portal-link" onClick={() => {
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
                    }}>Editar</button>
                    {canDo(RESOURCES.PETS, ACTIONS.DELETE) && <button className="portal-link portal-link--danger" onClick={() => {
                      if (window.confirm(`¿Eliminar el perfil de ${text(pet.name)}?`)) {
                        void send(`/api/v1/pets/${text(pet.id)}/`, "DELETE", undefined, "Mascota eliminada.");
                      }
                    }}>Eliminar</button>}
                    {hasStatus(pet.status, "devuelta") && canDo(RESOURCES.PETS, ACTIONS.UPDATE) && <button className="portal-link" onClick={() => void send(`/api/v1/pets/${text(pet.id)}/relist/`, "POST", {}, "Mascota republicada.")}>Volver a publicar</button>}
                  </>
                ) : role === ROLES.ADOPTER && canDo(RESOURCES.ADOPTION_REQUESTS, ACTIONS.CREATE) ? (
                  <button className="portal-button" onClick={() => navTo("requests")}>Solicitar adopción</button>
                ) : undefined
              }
            >
              {primaryPhoto && typeof primaryPhoto.url === "string" && (
                <img className="portal-pet-photo" src={primaryPhoto.url} alt={`Foto de ${text(pet.name)}`} />
              )}
              <p>{text(pet.temperament) || "Conoce más sobre esta mascota."}</p>
              {Boolean(pet.health) && <p><strong>Salud:</strong> {text(pet.health)}</p>}
            </DataCard>
          );
        })}
      </div>
      {!loading && visiblePets.length === 0 && <EmptyState>{petSearch ? "No encontramos mascotas con esos criterios." : "No hay mascotas disponibles para mostrar."}</EmptyState>}
    </>
  );
}

export function RequestsSection({
  role,
  canDo,
  questions,
  pets,
  requests,
  form,
  answers,
  setAnswers,
  setValue,
  submit,
  send,
  setError,
  loading,
  onRefresh,
  busy,
}: {
  role: string;
  canDo: PermissionCheck;
  questions: PortalDataRow[];
  pets: PortalDataRow[];
  requests: PortalDataRow[];
  form: Record<string, string>;
  answers: Record<string, string>;
  setAnswers: (value: (current: Record<string, string>) => Record<string, string>) => void;
  setValue: (name: string, value: string) => void;
  submit: PortalSubmit;
  send: PortalSender;
  setError: (value: string) => void;
  loading: boolean;
  onRefresh: () => void;
  busy: boolean;
}) {
  return (
    <>
      <SectionTitle
        eyebrow="Adopción responsable"
        title={role === ROLES.ADOPTER ? "Mis solicitudes" : "Solicitudes recibidas"}
        description={role === ROLES.ADOPTER ? "Consulta el avance y responde el formulario de adopción." : "Revisa cada solicitud y acompaña a las familias interesadas."}
        action={
          <button
            type="button"
            className="portal-button portal-button--secondary"
            onClick={onRefresh}
            disabled={loading}
          >
            {loading ? "Actualizando…" : "Actualizar datos"}
          </button>
        }
      />
      {role === ROLES.ADOPTER && canDo(RESOURCES.ADOPTION_REQUESTS, ACTIONS.CREATE) && (
        <form className="portal-form" onSubmit={submit(async () => {
          const requiredQuestions = questions.filter((question) => question.required === true);
          const missing = requiredQuestions.some((question) => !answers[text(question.id)]?.trim());
          if (missing) {
            setError("Completa todas las preguntas obligatorias antes de enviar.");
            return;
          }
          await send("/api/v1/adoption-requests/", "POST", {
            pet: Number(form.pet),
            answers: questions.map((question) => ({
              question: Number(question.id),
              value: answers[text(question.id)] ?? "",
            })),
          }, "Tu solicitud fue enviada al refugio.");
        })}>
          <h2>Iniciar una solicitud</h2>
          <Field label="Mascota" name="pet" value={form.pet ?? ""} onChange={setValue} required options={pets.filter((pet) => hasStatus(pet.status, "disponible")).map((pet) => ({ value: text(pet.id), label: `${text(pet.name)} · ${text(pet.species)}` }))} />
          {questions.map((question) => (
            <Field key={text(question.id)} label={`${text(question.prompt)}${question.required ? " *" : ""}`} name={text(question.id)} value={answers[text(question.id)] ?? ""} onChange={(name, value) => setAnswers((current) => ({ ...current, [name]: value }))} required={question.required === true} multiline={question.answer_type === "texto"} type={question.answer_type === "numero" ? "number" : "text"} />
          ))}
          <button className="portal-button" disabled={busy || questions.length === 0}>{busy ? "Enviando…" : "Enviar solicitud"}</button>
        </form>
      )}
      {role === ROLES.SHELTER && (
        <form className="portal-form portal-form--compact" onSubmit={(event) => event.preventDefault()}>
          <h2>Mensaje para la decisión</h2>
          <Field label="Nota para la familia (opcional)" name="decisionMessage" value={form.decisionMessage ?? ""} onChange={setValue} />
          <p className="portal-form-hint">Se incluirá al aprobar o rechazar una solicitud.</p>
        </form>
      )}
      <div className="portal-grid">
        {requests.map((item) => (
          <DataCard key={text(item.id)} title={`${text(item.pet_name)} · ${text(item.applicant_name)}`} subtitle={`Solicitud #${text(item.id)} · ${text(item.requested_at).slice(0, 10)}`} status={text(item.status)}>
            {text(item.shelter_notes) && <p><strong>Nota del refugio:</strong> {text(item.shelter_notes)}</p>}
            {role === ROLES.SHELTER && Array.isArray(item.answers) && (
              <div className="portal-answer-list">
                {(item.answers as PortalDataRow[]).map((answer) => <p key={text(answer.question)}><strong>{text(answer.question_prompt) || `Pregunta ${text(answer.question)}`}:</strong> {text(answer.value)}</p>)}
              </div>
            )}
            {role === ROLES.ADOPTER && hasStatus(item.status, "pendiente") && canDo(RESOURCES.ADOPTION_REQUESTS, ACTIONS.UPDATE) && (
              <button className="portal-link portal-link--danger" onClick={() => void send(`/api/v1/adoption-requests/${text(item.id)}/cancel/`, "POST", {}, "Solicitud cancelada.")}>Cancelar solicitud</button>
            )}
            {role === ROLES.SHELTER && hasStatus(item.status, "pendiente") && (
              <div className="portal-inline-actions">
                <button
                  className="portal-button"
                  disabled={busy || !canDo(RESOURCES.ADOPTION_REQUESTS, ACTIONS.APPROVE)}
                  title={
                    canDo(RESOURCES.ADOPTION_REQUESTS, ACTIONS.APPROVE)
                      ? undefined
                      : "Tu rol no tiene permiso para aprobar solicitudes."
                  }
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
                <button
                  className="portal-button portal-button--secondary"
                  disabled={busy || !canDo(RESOURCES.ADOPTION_REQUESTS, ACTIONS.REJECT)}
                  title={
                    canDo(RESOURCES.ADOPTION_REQUESTS, ACTIONS.REJECT)
                      ? undefined
                      : "Tu rol no tiene permiso para rechazar solicitudes."
                  }
                  onClick={() =>
                    void send(
                      `/api/v1/adoption-requests/${text(item.id)}/reject/`,
                      "POST",
                      { message: form.decisionMessage ?? "" },
                      "Solicitud rechazada.",
                    )
                  }
                >
                  Denegar
                </button>
              </div>
            )}
          </DataCard>
        ))}
      </div>
      {!loading && requests.length === 0 && <EmptyState>Aún no hay solicitudes para mostrar.</EmptyState>}
    </>
  );
}
