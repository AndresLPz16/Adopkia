import type { MutableRefObject } from "react";
import { rows, text } from "../shared";
import type { PortalDataRow } from "../shared";


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

export function RequestDialog({
  selectedRequest,
  setSelectedRequest,
  requestOpenerRef,
  requestDialogCloseRef,
  pets,
  questions,
}: {
  selectedRequest: PortalDataRow;
  setSelectedRequest: (value: PortalDataRow | null) => void;
  requestOpenerRef: MutableRefObject<HTMLButtonElement | null>;
  requestDialogCloseRef: MutableRefObject<HTMLButtonElement | null>;
  pets: PortalDataRow[];
  questions: PortalDataRow[];
}) {
  return (
    <div
      className="landing-pet-dialog__backdrop"
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
  );
}
