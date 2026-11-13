import { useEffect, useRef, useState } from "react";
import { ACTIONS, RESOURCES, ROLES } from "../../rbac/types";
import { EmptyState, Field, SectionTitle, rows, text } from "../shared";
import type {
  PermissionCheck,
  PortalDataRow,
  PortalSender,
  PortalSubmit,
} from "../shared";
import { QuestionManager } from "./QuestionManager";
import { RequestCard } from "./RequestCard";
import { RequestDialog } from "./RequestDialog";
import { RequestForm } from "./RequestForm";


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
  const activeQuestions = questions.filter((question) => question.active !== false);
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
      {(canDo(RESOURCES.FORM_QUESTIONS, ACTIONS.CREATE) ||
        canDo(RESOURCES.FORM_QUESTIONS, ACTIONS.UPDATE) ||
        canDo(RESOURCES.FORM_QUESTIONS, ACTIONS.DELETE)) && (
        <QuestionManager
          canDo={canDo}
          submit={submit}
          send={send}
          questions={questions}
          activeQuestions={activeQuestions}
          busy={busy}
        />
      )}
      {role === ROLES.ADOPTER && canDo(RESOURCES.ADOPTION_REQUESTS, ACTIONS.CREATE) && (
        <RequestForm
          form={form}
          setValue={setValue}
          answers={answers}
          setAnswers={setAnswers}
          submit={submit}
          send={send}
          setError={setError}
          pets={pets}
          activeQuestions={activeQuestions}
          requestedPetId={requestedPetId}
          onRequestSubmitted={onRequestSubmitted}
          editingRequestId={editingRequestId}
          setEditingRequestId={setEditingRequestId}
          editingPetId={editingPetId}
          stopEditingRequest={stopEditingRequest}
          busy={busy}
        />
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
          <RequestCard
            key={text(item.id)}
            item={item}
            pets={pets}
            role={role}
            canDo={canDo}
            form={form}
            send={send}
            requestOpenerRef={requestOpenerRef}
            setSelectedRequest={setSelectedRequest}
            editingRequestId={editingRequestId}
            startEditingRequest={startEditingRequest}
            stopEditingRequest={stopEditingRequest}
          />
        ))}
      </div>
      {!loading && requests.length === 0 && <EmptyState>Aún no hay solicitudes para mostrar.</EmptyState>}
      {selectedRequest && (
        <RequestDialog
          selectedRequest={selectedRequest}
          setSelectedRequest={setSelectedRequest}
          requestOpenerRef={requestOpenerRef}
          requestDialogCloseRef={requestDialogCloseRef}
          pets={pets}
          questions={questions}
        />
      )}
    </>
  );
}
