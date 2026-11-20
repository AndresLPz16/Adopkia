import { useState } from "react";
import { confirmAction } from "../../ui/confirm";
import { ACTIONS, RESOURCES, ROLES } from "../../rbac/types";
import { DataCard, EmptyState, Field, SectionTitle, labelStatus, statusCode, text, todayLocal } from "../shared";
import type { PermissionCheck, PortalDataRow, PortalSender, PortalSubmit } from "../shared";

export function RecordsSection({
  role,
  isPlatformSuperadmin,
  canDo,
  userId,
  pets,
  records,
  vaccines,
  veterinarians,
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
  userId: string | number;
  pets: PortalDataRow[];
  records: PortalDataRow[];
  vaccines: PortalDataRow[];
  veterinarians: PortalDataRow[];
  form: Record<string, string>;
  setValue: (name: string, value: string) => void;
  submit: PortalSubmit;
  send: PortalSender;
  loading: boolean;
  busy: boolean;
}) {
  const myProfile = veterinarians.find((item) => text(item.user) === text(userId));
  const [editingRecordId, setEditingRecordId] = useState("");
  const [recordDraft, setRecordDraft] = useState({
    pet: "",
    date: "",
    record_type: "",
    vaccine: "",
    description: "",
  });
  return (
    <>
      <SectionTitle eyebrow="Salud animal" title="Atención veterinaria" description="Completa tu perfil profesional y registra atenciones clínicas para las mascotas." />
      {!myProfile && role === ROLES.VETERINARIAN && canDo(RESOURCES.VETERINARIANS, ACTIONS.CREATE) && (
        <form className="portal-form" onSubmit={submit(async () => {
          await send("/api/v1/veterinarians/", "POST", { professional_card: form.professional_card, clinic: form.clinic || null, specialty: form.specialty || null }, "Perfil veterinario registrado.");
        })}>
          <h2>Perfil profesional</h2>
          <Field label="Número de tarjeta profesional" name="professional_card" value={form.professional_card ?? ""} onChange={setValue} required />
          <Field label="Clínica" name="clinic" value={form.clinic ?? ""} onChange={setValue} />
          <Field label="Especialidad" name="specialty" value={form.specialty ?? ""} onChange={setValue} />
          <button className="portal-button" disabled={busy}>Guardar perfil</button>
        </form>
      )}
      {myProfile && role === ROLES.VETERINARIAN && canDo(RESOURCES.VETERINARIANS, ACTIONS.UPDATE) && (
        <form className="portal-form" onSubmit={submit(async () => {
          await send(`/api/v1/veterinarians/${text(myProfile.id)}/`, "PATCH", {
            professional_card: form.professional_card ?? text(myProfile.professional_card),
            clinic: form.clinic ?? text(myProfile.clinic),
            specialty: form.specialty ?? text(myProfile.specialty),
          }, "Perfil veterinario actualizado.");
        })}>
          <h2>Tu perfil profesional</h2>
          <Field label="Número de tarjeta profesional" name="professional_card" value={form.professional_card ?? text(myProfile.professional_card)} onChange={setValue} required />
          <Field label="Clínica" name="clinic" value={form.clinic ?? text(myProfile.clinic)} onChange={setValue} />
          <Field label="Especialidad" name="specialty" value={form.specialty ?? text(myProfile.specialty)} onChange={setValue} />
          <button className="portal-button" disabled={busy}>Actualizar perfil</button>
        </form>
      )}
      {(myProfile || role !== ROLES.VETERINARIAN) &&
        !isPlatformSuperadmin &&
        canDo(RESOURCES.MEDICAL_RECORDS, ACTIONS.CREATE) && (
        <form className="portal-form" onSubmit={submit(async () => {
          await send("/api/v1/medical-records/", "POST", {
            pet: Number(form.pet),
            date: form.date || todayLocal(),
            record_type: form.record_type,
            description: form.description || "",
            ...(form.vaccine ? { vaccine: Number(form.vaccine) } : {}),
          }, "Atención registrada en el historial.");
        })}>
          <h2>Registrar atención</h2>
          <Field label="Mascota" name="pet" value={form.pet ?? ""} onChange={setValue} required options={pets.map((pet) => ({ value: text(pet.id), label: `${text(pet.name)} · ${text(pet.species)}` }))} />
          <Field label="Tipo de atención" name="record_type" value={form.record_type ?? ""} onChange={setValue} required options={[{ value: "consulta", label: "Consulta" }, { value: "vacunacion", label: "Vacunación" }, { value: "desparasitacion", label: "Desparasitación" }, { value: "cirugia", label: "Cirugía" }, { value: "control", label: "Control" }, { value: "otro", label: "Otro" }]} />
          <Field label="Fecha" name="date" type="date" value={form.date || todayLocal()} onChange={setValue} required />
          {form.record_type === "vacunacion" && <Field label="Vacuna (opcional)" name="vaccine" value={form.vaccine ?? ""} onChange={setValue} options={vaccines.map((item) => ({ value: text(item.id), label: text(item.name) }))} />}
          <Field label="Descripción y recomendaciones" name="description" value={form.description ?? ""} onChange={setValue} multiline />
          <button className="portal-button" disabled={busy || (role === ROLES.VETERINARIAN && !myProfile)}>Guardar atención</button>
        </form>
      )}
      <h2 className="portal-subheading">Historial reciente</h2>
      <div className="portal-grid">
        {records.map((item) => (
          <DataCard
            key={text(item.id)}
            title={labelStatus(item.record_type)}
            subtitle={`${text(item.pet_name) || `Mascota #${text(item.pet)}`} · ${text(item.date)}`}
            actions={
              !isPlatformSuperadmin &&
              (canDo(RESOURCES.MEDICAL_RECORDS, ACTIONS.UPDATE) ||
                canDo(RESOURCES.MEDICAL_RECORDS, ACTIONS.DELETE)) ? (
                <div className="portal-inline-actions">
                  {canDo(RESOURCES.MEDICAL_RECORDS, ACTIONS.UPDATE) && (
                    <button
                      className="portal-link"
                      onClick={() => {
                        setEditingRecordId(text(item.id));
                        setRecordDraft({
                          pet: text(item.pet),
                          date: text(item.date),
                          record_type: statusCode(item, "record_type"),
                          vaccine: text(item.vaccine),
                          description: text(item.description),
                        });
                      }}
                    >
                      Editar atención
                    </button>
                  )}
                  {canDo(RESOURCES.MEDICAL_RECORDS, ACTIONS.DELETE) && (
                    <button
                      className="portal-link portal-link--danger"
                      onClick={async () => {
                        if (await confirmAction({
                          title: "¿Eliminar este registro del historial médico?",
                          message: "Esta acción no se puede deshacer.",
                        })) {
                          void send(
                            `/api/v1/medical-records/${text(item.id)}/`,
                            "DELETE",
                            undefined,
                            "Registro médico eliminado.",
                          );
                        }
                      }}
                    >
                      Eliminar atención
                    </button>
                  )}
                </div>
              ) : undefined
            }
          >
            {editingRecordId === text(item.id) ? (
              <form
                className="portal-card-form"
                onSubmit={submit(async () => {
                  const saved = await send(
                    `/api/v1/medical-records/${text(item.id)}/`,
                    "PATCH",
                    {
                      pet: Number(recordDraft.pet),
                      date: recordDraft.date,
                      record_type: recordDraft.record_type,
                      vaccine: recordDraft.vaccine
                        ? Number(recordDraft.vaccine)
                        : null,
                      description: recordDraft.description,
                    },
                    "Atención actualizada.",
                  );
                  if (saved !== false) setEditingRecordId("");
                })}
              >
                <Field
                  label="Mascota"
                  name="pet"
                  value={recordDraft.pet}
                  onChange={(name, value) =>
                    setRecordDraft((current) => ({ ...current, [name]: value }))
                  }
                  required
                  options={pets.map((pet) => ({
                    value: text(pet.id),
                    label: `${text(pet.name)} · ${text(pet.species)}`,
                  }))}
                />
                <Field
                  label="Tipo de atención"
                  name="record_type"
                  value={recordDraft.record_type}
                  onChange={(name, value) =>
                    setRecordDraft((current) => ({
                      ...current,
                      record_type: value,
                      vaccine: value === "vacunacion" ? current.vaccine : "",
                    }))
                  }
                  required
                  options={[
                    { value: "consulta", label: "Consulta" },
                    { value: "vacunacion", label: "Vacunación" },
                    { value: "desparasitacion", label: "Desparasitación" },
                    { value: "cirugia", label: "Cirugía" },
                    { value: "control", label: "Control" },
                    { value: "otro", label: "Otro" },
                  ]}
                />
                <Field
                  label="Fecha"
                  name="date"
                  type="date"
                  value={recordDraft.date}
                  onChange={(name, value) =>
                    setRecordDraft((current) => ({ ...current, [name]: value }))
                  }
                  required
                />
                {recordDraft.record_type === "vacunacion" && (
                  <Field
                    label="Vacuna (opcional)"
                    name="vaccine"
                    value={recordDraft.vaccine}
                    onChange={(name, value) =>
                      setRecordDraft((current) => ({ ...current, [name]: value }))
                    }
                    options={vaccines.map((vaccine) => ({
                      value: text(vaccine.id),
                      label: text(vaccine.name),
                    }))}
                  />
                )}
                <Field
                  label="Descripción y recomendaciones"
                  name="description"
                  value={recordDraft.description}
                  onChange={(name, value) =>
                    setRecordDraft((current) => ({ ...current, [name]: value }))
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
                    onClick={() => setEditingRecordId("")}
                    disabled={busy}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <>
                {Boolean(item.description) && <p>{text(item.description)}</p>}
                {Boolean(item.veterinarian_name) && (
                  <small>Atendió: {text(item.veterinarian_name)}</small>
                )}
              </>
            )}
          </DataCard>
        ))}
      </div>
      {!loading && records.length === 0 && <EmptyState>No hay registros médicos disponibles.</EmptyState>}
    </>
  );
}
