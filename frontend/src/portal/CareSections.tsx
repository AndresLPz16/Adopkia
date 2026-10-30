import { ACTIONS, RESOURCES, ROLES } from "../rbac/types";
import type { Action, Resource } from "../rbac/types";
import {
  DataCard,
  EmptyState,
  Field,
  SectionTitle,
  hasStatus,
  labelStatus,
  text,
} from "./shared";
import type { PortalDataRow, PortalSender, PortalSubmit } from "./shared";

type PermissionCheck = (resource: Resource, action: Action) => boolean;

export function AdoptionsSection({
  role,
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
  return (
    <>
      <SectionTitle eyebrow="Acompañamiento" title="Adopciones y cuidados" description="Consulta adopciones activas, recordatorios y seguimientos de bienestar." />
      <h2 className="portal-subheading">Adopciones</h2>
      <div className="portal-grid">
        {adoptions.map((item) => (
          <DataCard key={text(item.id)} title={text(item.pet_name)} subtitle={`${text(item.applicant)} · desde ${text(item.adoption_date)}`} status={text(item.status)}>
            {role === ROLES.SHELTER && hasStatus(item.status, "activa") && canDo(RESOURCES.FOLLOW_UPS, ACTIONS.CREATE) && (
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
            {hasStatus(item.status, "activa") && role !== ROLES.VETERINARIAN && canDo(RESOURCES.REMINDERS, ACTIONS.CREATE) && (
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
        {followUps.map((item) => <DataCard key={text(item.id)} title={`Adopción #${text(item.adoption)}`} subtitle={text(item.date)} status={text(item.wellbeing)}>{Boolean(item.observations) && <p>{text(item.observations)}</p>}</DataCard>)}
      </div>
      <h2 className="portal-subheading">Recordatorios</h2>
      <div className="portal-grid">
        {reminders.map((item) => <DataCard key={text(item.id)} title={text(item.vaccine_name) || labelStatus(item.reminder_type)} subtitle={`Mascota #${text(item.pet)} · ${text(item.scheduled_date)}`} status={text(item.status)} />)}
      </div>
      {!loading && adoptions.length === 0 && followUps.length === 0 && reminders.length === 0 && <EmptyState>Cuando haya una adopción, verás aquí su seguimiento y cuidados.</EmptyState>}
    </>
  );
}

export function MessagesSection({
  role,
  canDo,
  userId,
  pets,
  conversations,
  messages,
  selectedConversation,
  setSelectedConversation,
  form,
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
  userId: string | number;
  pets: PortalDataRow[];
  conversations: PortalDataRow[];
  messages: PortalDataRow[];
  selectedConversation: string;
  setSelectedConversation: (value: string) => void;
  form: Record<string, string>;
  setValue: (name: string, value: string) => void;
  submit: PortalSubmit;
  send: PortalSender;
  setError: (value: string) => void;
  loading: boolean;
  onRefresh: () => void;
  busy: boolean;
}) {
  const activeConversation =
    conversations.find((item) => text(item.id) === selectedConversation) ?? conversations[0];
  return (
    <>
      <SectionTitle
        eyebrow="Comunicación directa"
        title="Mensajes"
        description="Mantén las conversaciones sobre adopciones organizadas en un solo lugar."
        action={
          <button
            type="button"
            className="portal-button portal-button--secondary"
            onClick={onRefresh}
            disabled={loading}
          >
            {loading ? "Actualizando…" : "Actualizar mensajes"}
          </button>
        }
      />
      {role === ROLES.ADOPTER && canDo(RESOURCES.CONVERSATIONS, ACTIONS.CREATE) && (
        <form className="portal-form portal-form--compact" onSubmit={submit(async () => {
          const pet = pets.find((item) => text(item.id) === form.pet);
          if (!pet) {
            setError("Selecciona una mascota válida.");
            return;
          }
          await send("/api/v1/conversations/", "POST", { shelter: Number(pet.shelter), pet: Number(pet.id) }, "Conversación iniciada.");
        })}>
          <h2>Contactar por una mascota</h2>
          <Field label="Mascota" name="pet" value={form.pet ?? ""} onChange={setValue} required options={pets.map((pet) => ({ value: text(pet.id), label: text(pet.name) }))} />
          <button className="portal-button" disabled={busy}>Iniciar conversación</button>
        </form>
      )}
      <div className="portal-messages-layout">
        <div className="portal-conversation-list">
          {conversations.map((conversation) => (
            <button key={text(conversation.id)} className={`portal-conversation ${text(activeConversation?.id) === text(conversation.id) ? "is-active" : ""}`} onClick={() => setSelectedConversation(text(conversation.id))}>
              <strong>{role === ROLES.ADOPTER ? text(conversation.shelter_name) : text(conversation.adopter_name)}</strong>
              <span>{text(conversation.pet_name) || "Consulta general"}</span>
            </button>
          ))}
          {!loading && conversations.length === 0 && <EmptyState>Aún no hay conversaciones.</EmptyState>}
        </div>
        <div className="portal-chat">
          {activeConversation ? (
            <>
              <div className="portal-chat__messages">
                {messages.map((message) => <div key={text(message.id)} className={`portal-message ${text(message.sender) === text(userId) ? "portal-message--mine" : ""}`}><strong>{text(message.sender_name)}</strong><p>{text(message.content)}</p><small>{text(message.sent_at)}</small>{text(message.sender) !== text(userId) && message.is_read !== true && <button className="portal-link" onClick={() => void send(`/api/v1/messages/${text(message.id)}/mark-read/`, "POST", {}, "Mensaje marcado como leído.")}>Marcar como leído</button>}</div>)}
                {!loading && messages.length === 0 && <EmptyState>Envía el primer mensaje de esta conversación.</EmptyState>}
              </div>
              {canDo(RESOURCES.MESSAGES, ACTIONS.CREATE) && <form className="portal-chat__form" onSubmit={submit(async () => {
                await send("/api/v1/messages/", "POST", { conversation: Number(activeConversation.id), content: form.content }, "Mensaje enviado.");
              })}>
                <Field label="Escribe un mensaje" name="content" value={form.content ?? ""} onChange={setValue} required />
                <button className="portal-button" disabled={busy}>Enviar</button>
              </form>}
            </>
          ) : <EmptyState>Selecciona una conversación para leer y responder.</EmptyState>}
        </div>
      </div>
    </>
  );
}

export function RecordsSection({
  role,
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
      {(myProfile || role !== ROLES.VETERINARIAN) && canDo(RESOURCES.MEDICAL_RECORDS, ACTIONS.CREATE) && (
        <form className="portal-form" onSubmit={submit(async () => {
          await send("/api/v1/medical-records/", "POST", {
            pet: Number(form.pet),
            date: form.date,
            record_type: form.record_type,
            description: form.description || "",
            ...(form.vaccine ? { vaccine: Number(form.vaccine) } : {}),
          }, "Atención registrada en el historial.");
        })}>
          <h2>Registrar atención</h2>
          <Field label="Mascota" name="pet" value={form.pet ?? ""} onChange={setValue} required options={pets.map((pet) => ({ value: text(pet.id), label: `${text(pet.name)} · ${text(pet.species)}` }))} />
          <Field label="Tipo de atención" name="record_type" value={form.record_type ?? ""} onChange={setValue} required options={[{ value: "consulta", label: "Consulta" }, { value: "vacunacion", label: "Vacunación" }, { value: "desparasitacion", label: "Desparasitación" }, { value: "cirugia", label: "Cirugía" }, { value: "control", label: "Control" }, { value: "otro", label: "Otro" }]} />
          <Field label="Fecha" name="date" type="date" value={form.date ?? new Date().toISOString().slice(0, 10)} onChange={setValue} required />
          {form.record_type === "vacunacion" && <Field label="Vacuna (opcional)" name="vaccine" value={form.vaccine ?? ""} onChange={setValue} options={vaccines.map((item) => ({ value: text(item.id), label: text(item.name) }))} />}
          <Field label="Descripción y recomendaciones" name="description" value={form.description ?? ""} onChange={setValue} multiline />
          <button className="portal-button" disabled={busy || (role === ROLES.VETERINARIAN && !myProfile)}>Guardar atención</button>
        </form>
      )}
      <h2 className="portal-subheading">Historial reciente</h2>
      <div className="portal-grid">
        {records.map((item) => <DataCard key={text(item.id)} title={labelStatus(item.record_type)} subtitle={`Mascota #${text(item.pet)} · ${text(item.date)}`}>{Boolean(item.description) && <p>{text(item.description)}</p>}{Boolean(item.veterinarian_name) && <small>Atendió: {text(item.veterinarian_name)}</small>}</DataCard>)}
      </div>
      {!loading && records.length === 0 && <EmptyState>No hay registros médicos disponibles.</EmptyState>}
    </>
  );
}
