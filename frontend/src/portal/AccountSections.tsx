import { DataCard, EmptyState, Field, SectionTitle, labelStatus, text } from "./shared";
import type { PortalDataRow, PortalSender, PortalSubmit } from "./shared";

export function NotificationsSection({
  notifications,
  loading,
  send,
}: {
  notifications: PortalDataRow[];
  loading: boolean;
  send: PortalSender;
}) {
  return (
    <>
      <SectionTitle
        eyebrow="Actividad reciente"
        title="Notificaciones"
        description="Mantente al día con mensajes, solicitudes y recordatorios."
      />
      <div className="portal-grid">
        {notifications.map((item) => (
          <DataCard
            key={text(item.id)}
            title={text(item.message)}
            subtitle={`${labelStatus(item.notification_type)} · ${text(item.sent_at)}`}
            status={item.is_read ? "leido" : "pendiente"}
            actions={
              !item.is_read ? (
                <button
                  className="portal-link"
                  onClick={() =>
                    void send(
                      `/api/v1/notifications/${text(item.id)}/`,
                      "PATCH",
                      { is_read: true },
                      "Notificación marcada como leída.",
                    )
                  }
                >
                  Marcar como leída
                </button>
              ) : undefined
            }
          />
        ))}
      </div>
      {!loading && notifications.length === 0 && (
        <EmptyState>No tienes notificaciones nuevas.</EmptyState>
      )}
    </>
  );
}

export function ProfileSection({
  profile,
  role,
  roleName,
  form,
  setValue,
  submit,
  send,
  busy,
}: {
  profile?: PortalDataRow;
  role: string;
  roleName: string;
  form: Record<string, string>;
  setValue: (name: string, value: string) => void;
  submit: PortalSubmit;
  send: PortalSender;
  busy: boolean;
}) {
  return (
    <>
      <SectionTitle
        eyebrow="Cuenta"
        title="Mi perfil"
        description="Mantén actualizados tus datos de contacto."
      />
      <form
        className="portal-form"
        onSubmit={submit(async () => {
          await send(
            "/api/v1/auth/me/",
            "PATCH",
            { name: form.name, phone: form.phone || null },
            "Perfil actualizado.",
          );
        })}
      >
        <h2>Información personal</h2>
        <Field
          label="Nombre"
          name="name"
          value={form.name ?? text(profile?.name)}
          onChange={setValue}
          required
        />
        <Field label="Correo electrónico" name="email" value={text(profile?.email)} onChange={() => undefined} readOnly />
        <Field
          label="Teléfono"
          name="phone"
          value={form.phone ?? text(profile?.phone)}
          onChange={setValue}
        />
        <Field label="Rol" name="role" value={roleName || role} onChange={() => undefined} readOnly />
        <button className="portal-button" disabled={busy}>
          Guardar perfil
        </button>
      </form>
    </>
  );
}
