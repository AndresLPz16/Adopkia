import { useRef } from "react";
import { Avatar } from "../ui/Avatar";
import { confirmAction } from "../ui/confirm";
import { DataCard, EmptyState, Field, SectionTitle, labelStatus, text } from "./shared";
import type { PortalDataRow, PortalPhotoSaver, PortalSender, PortalSubmit } from "./shared";

// Mismos límites que valida el servidor; comprobarlos aquí evita subir un
// archivo que se va a rechazar.
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

export function NotificationsSection({
  notifications,
  loading,
  send,
  isPlatformSuperadmin = false,
}: {
  notifications: PortalDataRow[];
  loading: boolean;
  send: PortalSender;
  isPlatformSuperadmin?: boolean;
}) {
  return (
    <>
      <SectionTitle
        eyebrow="Actividad reciente"
        title="Notificaciones"
        description={
          isPlatformSuperadmin
            ? "Consulta el contenido de las notificaciones dirigidas a tu cuenta de superadministrador."
            : "Mantente al día con mensajes, solicitudes y recordatorios."
        }
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
        <EmptyState>
          {isPlatformSuperadmin
            ? "No hay notificaciones dirigidas a esta cuenta."
            : "No tienes notificaciones nuevas."}
        </EmptyState>
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
  savePhoto,
  setError,
  busy,
}: {
  profile?: PortalDataRow;
  role: string;
  roleName: string;
  form: Record<string, string>;
  setValue: (name: string, value: string) => void;
  submit: PortalSubmit;
  send: PortalSender;
  savePhoto: PortalPhotoSaver;
  setError: (value: string) => void;
  busy: boolean;
}) {
  const photoInput = useRef<HTMLInputElement | null>(null);
  const photoUrl = text(profile?.photo_url);

  const choosePhoto = async (file: File | undefined) => {
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type)) {
      setError("Usa una imagen JPG, PNG o WEBP.");
      return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
      setError("La imagen no puede superar 5 MB.");
      return;
    }
    await savePhoto(file);
  };

  return (
    <>
      <SectionTitle
        eyebrow="Cuenta"
        title="Mi perfil"
        description="Mantén actualizados tus datos de contacto."
      />
      <section className="profile-photo" aria-labelledby="profile-photo-title">
        <Avatar name={text(profile?.name)} photoUrl={photoUrl} size="lg" />
        <div className="profile-photo__body">
          <h2 id="profile-photo-title">Foto de perfil</h2>
          <p>Se muestra junto a tu nombre en el portal. JPG, PNG o WEBP, hasta 5 MB.</p>
          <div className="profile-photo__actions">
            <input
              ref={photoInput}
              className="sr-only"
              type="file"
              accept={PHOTO_TYPES.join(",")}
              aria-label="Archivo de la foto de perfil"
              tabIndex={-1}
              onChange={(event) => {
                const file = event.target.files?.[0];
                // Se vacía para poder elegir el mismo archivo otra vez.
                event.target.value = "";
                void choosePhoto(file);
              }}
            />
            <button
              type="button"
              className="portal-button portal-button--secondary"
              disabled={busy}
              onClick={() => photoInput.current?.click()}
            >
              {photoUrl ? "Cambiar foto" : "Subir foto"}
            </button>
            {photoUrl && (
              <button
                type="button"
                className="portal-link portal-link--danger"
                disabled={busy}
                onClick={async () => {
                  if (await confirmAction({
                    title: "¿Quitar tu foto de perfil?",
                    message: "Volverán a mostrarse tus iniciales.",
                    confirmLabel: "Quitar foto",
                  })) {
                    await savePhoto(null);
                  }
                }}
              >
                Quitar foto
              </button>
            )}
          </div>
        </div>
      </section>
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
