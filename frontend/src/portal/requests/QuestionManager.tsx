import { useState } from "react";
import { ACTIONS, RESOURCES } from "../../rbac/types";
import { DataCard, Field, text } from "../shared";
import type {
  PermissionCheck,
  PortalDataRow,
  PortalSender,
  PortalSubmit,
} from "../shared";

// Alta, edición y archivado de las preguntas del formulario de adopción.
export function QuestionManager({
  canDo,
  submit,
  send,
  questions,
  activeQuestions,
  busy,
}: {
  canDo: PermissionCheck;
  submit: PortalSubmit;
  send: PortalSender;
  questions: PortalDataRow[];
  activeQuestions: PortalDataRow[];
  busy: boolean;
}) {
  const [editingQuestionId, setEditingQuestionId] = useState("");
  const [questionForm, setQuestionForm] = useState({
    prompt: "",
    answer_type: "texto",
    required: "true",
    order: "1",
    active: "true",
  });

  return (
    <section className="portal-section" aria-label="Administrar preguntas de adopción">
      <h2 className="portal-subheading">Preguntas del formulario</h2>
      {(canDo(RESOURCES.FORM_QUESTIONS, ACTIONS.CREATE) ||
        (Boolean(editingQuestionId) &&
          canDo(RESOURCES.FORM_QUESTIONS, ACTIONS.UPDATE))) && (
        <form
          className="portal-form portal-form--compact"
          onSubmit={submit(async () => {
            const saved = await send(
              editingQuestionId
                ? `/api/v1/form-questions/${editingQuestionId}/`
                : "/api/v1/form-questions/",
              editingQuestionId ? "PATCH" : "POST",
              {
                ...questionForm,
                required: questionForm.required === "true",
                active: questionForm.active === "true",
                order: Number(questionForm.order),
              },
              editingQuestionId
                ? "Pregunta actualizada."
                : "Pregunta agregada al formulario.",
            );
            if (saved !== false) {
              setEditingQuestionId("");
              setQuestionForm({
                prompt: "",
                answer_type: "texto",
                required: "true",
                order: String(activeQuestions.length + 1),
                active: "true",
              });
            }
          })}
        >
          <h3>{editingQuestionId ? "Editar pregunta" : "Agregar pregunta"}</h3>
          <Field
            label="Pregunta"
            name="prompt"
            value={questionForm.prompt}
            onChange={(name, value) =>
              setQuestionForm((current) => ({ ...current, [name]: value }))
            }
            required
          />
          <Field
            label="Tipo de respuesta"
            name="answer_type"
            value={questionForm.answer_type}
            onChange={(name, value) =>
              setQuestionForm((current) => ({ ...current, [name]: value }))
            }
            options={[
              { value: "texto", label: "Texto" },
              { value: "si_no", label: "Sí / No" },
              { value: "numero", label: "Número" },
              { value: "opcion", label: "Opción" },
            ]}
          />
          <Field
            label="Obligatoria"
            name="required"
            value={questionForm.required}
            onChange={(name, value) =>
              setQuestionForm((current) => ({ ...current, [name]: value }))
            }
            options={[
              { value: "true", label: "Sí" },
              { value: "false", label: "No" },
            ]}
          />
          <Field
            label="Orden"
            name="order"
            type="number"
            value={questionForm.order}
            onChange={(name, value) =>
              setQuestionForm((current) => ({ ...current, [name]: value }))
            }
            required
          />
          {editingQuestionId && (
            <Field
              label="Estado"
              name="active"
              value={questionForm.active}
              onChange={(name, value) =>
                setQuestionForm((current) => ({ ...current, [name]: value }))
              }
              options={[
                { value: "true", label: "Activa" },
                { value: "false", label: "Archivada" },
              ]}
            />
          )}
          <div className="portal-inline-actions">
            <button className="portal-button" disabled={busy}>
              {editingQuestionId ? "Guardar cambios" : "Agregar pregunta"}
            </button>
            {editingQuestionId && (
              <button
                className="portal-button portal-button--secondary"
                type="button"
                onClick={() => {
                  setEditingQuestionId("");
                  setQuestionForm({
                    prompt: "",
                    answer_type: "texto",
                    required: "true",
                    order: String(activeQuestions.length + 1),
                    active: "true",
                  });
                }}
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      )}
      <div className="portal-grid">
        {questions.map((question) => (
          <DataCard
            key={text(question.id)}
            title={text(question.prompt)}
            subtitle={`Orden ${text(question.order)} · ${text(question.answer_type)}`}
            status={
              question.active === false
                ? "Archivada"
                : question.required === true
                  ? "Obligatoria"
                  : "Opcional"
            }
            actions={
              <div className="portal-inline-actions">
                {canDo(RESOURCES.FORM_QUESTIONS, ACTIONS.UPDATE) && (
                  <button
                    className="portal-link"
                    onClick={() => {
                      setEditingQuestionId(text(question.id));
                      setQuestionForm({
                        prompt: text(question.prompt),
                        answer_type: text(question.answer_type),
                        required: String(question.required === true),
                        order: text(question.order),
                        active: String(question.active !== false),
                      });
                    }}
                  >
                    Editar
                  </button>
                )}
                {question.active !== false &&
                  canDo(RESOURCES.FORM_QUESTIONS, ACTIONS.DELETE) && (
                    <button
                      className="portal-link portal-link--danger"
                      onClick={() => {
                        void send(
                          `/api/v1/form-questions/${text(question.id)}/`,
                          "DELETE",
                          undefined,
                          "Pregunta archivada; se conservaron las respuestas existentes.",
                        );
                      }}
                    >
                      Archivar
                    </button>
                  )}
              </div>
            }
          />
        ))}
      </div>
    </section>
  );
}
