import { useState } from "react";
import { ACTIONS, RESOURCES, ROLES } from "../../rbac/types";
import { DataCard, EmptyState, Field, SectionTitle, labelStatus, statusCode, text } from "../shared";
import type { PermissionCheck, PortalDataRow, PortalSender, PortalSubmit } from "../shared";

export function AdoptionsSection({
  role,
  isPlatformSuperadmin,
  canDo,
  adoptions,
  followUps,
  reminders,
  vaccines,
  form,
  setValue,
  submit,
  send,
  loading,
  busy,
}: {
  role: string;
  isPlatformSuperadmin: boolean;
  canDo: PermissionCheck;
  adoptions: PortalDataRow[];
  followUps: PortalDataRow[];
  reminders: PortalDataRow[];
  vaccines: PortalDataRow[];
  form: Record<string, string>;
  setValue: (name: string, value: string) => void;
  submit: PortalSubmit;
  send: PortalSender;
  loading: boolean;
  busy: boolean;
}) {
  const [editingReminderId, setEditingReminderId] = useState("");
  const [reminderDraft, setReminderDraft] = useState({
    scheduled_date: "",
    notes: "",
    status: "",
  });
  return (
    <>
      <SectionTitle eyebrow="Acompañamiento" title="Adopciones y cuidados" description="Consulta adopciones activas, recordatorios y seguimientos de bienestar." />
      <h2 className="portal-subheading">Adopciones</h2>
      <div className="portal-grid">
        {adoptions.map((item) => (
          <DataCard key={text(item.id)} title={text(item.pet_name)} subtitle={`${text(item.applicant)} · desde ${text(item.adoption_date)}`} status={text(item.status)}>
            {isPlatformSuperadmin && Boolean(item.return_date) && (
              <p>
                <strong>Fecha de devolución:</strong> {text(item.return_date)}
              </p>
            )}
            {isPlatformSuperadmin && Boolean(item.return_reason) && (
              <p>
                <strong>Motivo de devolución:</strong> {text(item.return_reason)}
              </p>
            )}
            {role === ROLES.SHELTER && statusCode(item) === "activa" && canDo(RESOURCES.FOLLOW_UPS, ACTIONS.CREATE) && (
              <form className="portal-card-form" onSubmit={submit(async () => {
                await send("/api/v1/follow-ups/", "POST", {
                  adoption: Number(item.id),
                  date: form.date || new Date().toISOString().slice(0, 10),
                  wellbeing: form.wellbeing || "bueno",
                  observations: form.observations || "",
                }, "Seguimiento registrado.");
              })}>
                <Field label="Bienestar" name="wellbeing" value={form.wellbeing ?? ""} onChange={setValue} options={[{ value: "excelente", label: "Excelente" }, { value: "bueno", label: "Bueno" }, { value: "regular", label: "Regular" }, { value: "preocupante", label: "Requiere atención" }]} />
                <Field label="Observaciones" name="observations" value={form.observations ?? ""} onChange={setValue} multiline />
                <button className="portal-link">Añadir seguimiento</button>
              </form>
            )}
            {statusCode(item) === "activa" &&
              role !== ROLES.VETERINARIAN &&
              !isPlatformSuperadmin &&
              canDo(RESOURCES.REMINDERS, ACTIONS.CREATE) && (
              <form className="portal-card-form" onSubmit={submit(async () => {
                await send("/api/v1/reminders/", "POST", {
                  adoption: Number(item.id),
                  reminder_type: form.reminder_type || "control_veterinario",
                  scheduled_date: form.scheduled_date,
                  ...(form.vaccine ? { vaccine: Number(form.vaccine) } : {}),
                }, "Recordatorio programado.");
              })}>
                <Field label="Tipo de recordatorio" name="reminder_type" value={form.reminder_type ?? ""} onChange={setValue} required options={[{ value: "vacuna", label: "Vacuna" }, { value: "control_veterinario", label: "Control veterinario" }, { value: "checkin", label: "Seguimiento" }]} />
                <Field label="Fecha" name="scheduled_date" type="date" value={form.scheduled_date ?? ""} onChange={setValue} required />
                {form.reminder_type === "vacuna" && <Field label="Vacuna (opcional)" name="vaccine" value={form.vaccine ?? ""} onChange={setValue} options={vaccines.map((vaccine) => ({ value: text(vaccine.id), label: text(vaccine.name) }))} />}
                <button className="portal-link" disabled={busy}>Programar recordatorio</button>
              </form>
            )}
          </DataCard>
        ))}
      </div>
      <h2 className="portal-subheading">Seguimientos</h2>
      <div className="portal-grid">
        {followUps.map((item) => {
          const adoption = adoptions.find(
            (entry) => text(entry.id) === text(item.adoption),
          );
          return (
            <DataCard
              key={text(item.id)}
              title={
                isPlatformSuperadmin && adoption
                  ? `Seguimiento de ${text(adoption.pet_name)}`
                  : `Adopción #${text(item.adoption)}`
              }
              subtitle={
                isPlatformSuperadmin && adoption
                  ? `${text(adoption.applicant)} · ${text(item.date)}`
                  : text(item.date)
              }
              status={text(item.wellbeing)}
            >
              {Boolean(item.observations) && <p>{text(item.observations)}</p>}
            </DataCard>
          );
        })}
      </div>
      <h2 className="portal-subheading">Recordatorios</h2>
      <div className="portal-grid">
        {reminders.map((item) => {
          const adoption = adoptions.find(
            (entry) => text(entry.id) === text(item.adoption),
          );
          return (
            <DataCard
              key={text(item.id)}
              title={text(item.vaccine_name) || labelStatus(item.reminder_type)}
              subtitle={
                isPlatformSuperadmin && adoption
                  ? `${text(adoption.pet_name)} · ${text(adoption.applicant)} · ${text(item.scheduled_date)}`
                  : `Mascota #${text(item.pet)} · ${text(item.scheduled_date)}`
              }
              status={text(item.status)}
              actions={
                canDo(RESOURCES.REMINDERS, ACTIONS.UPDATE) ? (
                  <div className="portal-inline-actions">
                    {statusCode(item) !== "cumplido" && (
                      <button
                        className="portal-link"
                        disabled={busy}
                        onClick={() =>
                          void send(
                            `/api/v1/reminders/${text(item.id)}/`,
                            "PATCH",
                            { status: "cumplido" },
                            "Recordatorio marcado como realizado.",
                          )
                        }
                      >
                        Marcar realizado
                      </button>
                    )}
                    <button
                      className="portal-link"
                      onClick={() => {
                        setEditingReminderId(text(item.id));
                        setReminderDraft({
                          scheduled_date: text(item.scheduled_date),
                          notes: text(item.notes),
                          status: text(item.status),
                        });
                      }}
                    >
                      {editingReminderId === text(item.id) ? "Editando" : "Editar"}
                    </button>
                  </div>
                ) : undefined
              }
            >
              {editingReminderId === text(item.id) ? (
                <form
                  className="portal-card-form"
                  onSubmit={submit(async () => {
                    const saved = await send(
                      `/api/v1/reminders/${text(item.id)}/`,
                      "PATCH",
                      reminderDraft,
                      "Recordatorio actualizado.",
                    );
                    if (saved !== false) setEditingReminderId("");
                  })}
                >
                  <Field
                    label="Fecha programada"
                    name="scheduled_date"
                    type="date"
                    value={reminderDraft.scheduled_date}
                    onChange={(name, value) =>
                      setReminderDraft((current) => ({ ...current, [name]: value }))
                    }
                    required
                  />
                  <Field
                    label="Estado"
                    name="status"
                    value={reminderDraft.status}
                    onChange={(name, value) =>
                      setReminderDraft((current) => ({ ...current, [name]: value }))
                    }
                    options={[
                      { value: "pendiente", label: "Pendiente" },
                      { value: "notificado", label: "Notificado" },
                      { value: "cumplido", label: "Realizado" },
                      { value: "vencido", label: "Vencido" },
                      { value: "cancelado", label: "Cancelado" },
                    ]}
                  />
                  <Field
                    label="Notas"
                    name="notes"
                    value={reminderDraft.notes}
                    onChange={(name, value) =>
                      setReminderDraft((current) => ({ ...current, [name]: value }))
                    }
                    multiline
                  />
                  <div className="portal-inline-actions">
                    <button className="portal-button" disabled={busy}>
                      Guardar cambios
                    </button>
                    <button
                      className="portal-button portal-button--secondary"
                      type="button"
                      onClick={() => setEditingReminderId("")}
                      disabled={busy}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : (
                Boolean(item.notes) && <p>{text(item.notes)}</p>
              )}
            </DataCard>
          );
        })}
      </div>
      {!loading && adoptions.length === 0 && followUps.length === 0 && reminders.length === 0 && <EmptyState>Cuando haya una adopción, verás aquí su seguimiento y cuidados.</EmptyState>}
    </>
  );
}
