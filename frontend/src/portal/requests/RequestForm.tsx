import { Field, isAvailablePet, text } from "../shared";
import type { PortalDataRow, PortalSender, PortalSubmit } from "../shared";

export function RequestForm({
  form,
  setValue,
  answers,
  setAnswers,
  submit,
  send,
  setError,
  pets,
  activeQuestions,
  requestedPetId,
  onRequestSubmitted,
  editingRequestId,
  setEditingRequestId,
  editingPetId,
  stopEditingRequest,
  busy,
}: {
  form: Record<string, string>;
  setValue: (name: string, value: string) => void;
  answers: Record<string, string>;
  setAnswers: (value: (current: Record<string, string>) => Record<string, string>) => void;
  submit: PortalSubmit;
  send: PortalSender;
  setError: (value: string) => void;
  pets: PortalDataRow[];
  activeQuestions: PortalDataRow[];
  requestedPetId: string;
  onRequestSubmitted?: () => void;
  editingRequestId: string;
  setEditingRequestId: (value: string) => void;
  editingPetId: string;
  stopEditingRequest: () => void;
  busy: boolean;
}) {
  return (
    <form className="portal-form" onSubmit={submit(async () => {
      const petId = form.pet || requestedPetId;
      const requiredQuestions = activeQuestions.filter((question) => question.required === true);
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
        answers: activeQuestions.map((question) => ({
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
      {activeQuestions.map((question) => (
        <Field key={text(question.id)} label={`${text(question.prompt)}${question.required ? " *" : ""}`} name={text(question.id)} value={answers[text(question.id)] ?? ""} onChange={(name, value) => setAnswers((current) => ({ ...current, [name]: value }))} required={question.required === true} multiline={question.answer_type === "texto"} type={question.answer_type === "numero" ? "number" : "text"} />
      ))}
      <div className="portal-inline-actions">
        <button className="portal-button" disabled={busy || activeQuestions.length === 0}>{busy ? "Guardando…" : editingRequestId ? "Guardar cambios" : "Enviar solicitud"}</button>
        {editingRequestId && (
          <button className="portal-button portal-button--secondary" type="button" onClick={stopEditingRequest} disabled={busy}>
            Dejar de editar
          </button>
        )}
      </div>
    </form>
  );
}
