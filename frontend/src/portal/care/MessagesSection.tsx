import { ACTIONS, RESOURCES, ROLES } from "../../rbac/types";
import { EmptyState, Field, SectionTitle, text } from "../shared";
import type { PermissionCheck, PortalDataRow, PortalSender, PortalSubmit } from "../shared";

export function MessagesSection({
  role,
  isPlatformSuperadmin,
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
  busy,
}: {
  role: string;
  isPlatformSuperadmin: boolean;
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
  busy: boolean;
}) {
  const activeConversation =
    conversations.find((item) => text(item.id) === selectedConversation) ?? conversations[0];
  return (
    <>
      <SectionTitle eyebrow="Comunicación directa" title="Mensajes" description="Mantén las conversaciones sobre adopciones organizadas en un solo lugar." />
      {role === ROLES.ADOPTER && canDo(RESOURCES.MESSAGING, ACTIONS.CREATE) && (
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
              {canDo(RESOURCES.MESSAGING, ACTIONS.CREATE) && !isPlatformSuperadmin && <form className="portal-chat__form" onSubmit={submit(async () => {
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
