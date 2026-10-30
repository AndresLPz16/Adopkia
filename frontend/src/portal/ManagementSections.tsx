import { ACTIONS, RESOURCES, ROLES } from "../rbac/types";
import type { Action, Resource } from "../rbac/types";
import {
  DataCard,
  EmptyState,
  Field,
  SectionTitle,
  hasStatus,
  text,
} from "./shared";
import type { PortalDataRow, PortalSender, PortalSubmit } from "./shared";

type PermissionCheck = (resource: Resource, action: Action) => boolean;

export function SheltersSection({
  role,
  userId,
  canDo,
  shelters,
  members,
  form,
  setForm,
  setValue,
  submit,
  send,
  editingShelter,
  setEditingShelter,
  loading,
  busy,
}: {
  role: string;
  userId: string | number;
  canDo: PermissionCheck;
  shelters: PortalDataRow[];
  members: PortalDataRow[];
  form: Record<string, string>;
  setForm: (value: Record<string, string>) => void;
  setValue: (name: string, value: string) => void;
  submit: PortalSubmit;
  send: PortalSender;
  editingShelter: string;
  setEditingShelter: (value: string) => void;
  loading: boolean;
  busy: boolean;
}) {
  const isAdmin = role === ROLES.ADMIN;
  return (
    <>
      <SectionTitle eyebrow={isAdmin ? "Supervisión" : "Tu organización"} title={isAdmin ? "Refugios" : "Refugios y equipo"} description={isAdmin ? "Revisa registros y gestiona la verificación de refugios." : "Administra la información de tu refugio y consulta a sus integrantes."} />
      {!isAdmin && canDo(RESOURCES.SHELTERS, ACTIONS.CREATE) && (
        <form className="portal-form" onSubmit={submit(async () => {
          const endpoint = editingShelter ? `/api/v1/shelters/${editingShelter}/` : "/api/v1/shelters/";
          await send(endpoint, editingShelter ? "PATCH" : "POST", {
            name: form.name,
            address: form.address,
            city: form.city,
            contact_phone: form.contact_phone || null,
            contact_email: form.contact_email || null,
          }, editingShelter ? "Información del refugio actualizada." : "El refugio quedó registrado y está pendiente de verificación.");
        })}>
          <h2>{editingShelter ? "Editar refugio" : "Registrar un refugio"}</h2>
          <Field label="Nombre" name="name" value={form.name ?? ""} onChange={setValue} required />
          <Field label="Dirección" name="address" value={form.address ?? ""} onChange={setValue} required />
          <Field label="Ciudad" name="city" value={form.city ?? ""} onChange={setValue} required />
          <Field label="Teléfono de contacto" name="contact_phone" value={form.contact_phone ?? ""} onChange={setValue} />
          <Field label="Correo de contacto" name="contact_email" type="email" value={form.contact_email ?? ""} onChange={setValue} />
          <div className="portal-form__actions">
            <button className="portal-button" disabled={busy}>{editingShelter ? "Guardar cambios" : "Registrar refugio"}</button>
            {editingShelter && <button className="portal-button portal-button--secondary" type="button" onClick={() => { setEditingShelter(""); setForm({}); }}>Cancelar edición</button>}
          </div>
        </form>
      )}
      <div className="portal-grid">
        {shelters.map((shelter) => (
          <DataCard key={text(shelter.id)} title={text(shelter.name)} subtitle={`${text(shelter.city)} · ${text(shelter.address)}`} status={text(shelter.verification_status)}>
            <p>{text(shelter.contact_email)} {shelter.contact_phone ? `· ${text(shelter.contact_phone)}` : ""}</p>
            {hasStatus(shelter.verification_status, "pendiente") && canDo(RESOURCES.SHELTERS, ACTIONS.VERIFY) && (
              <div className="portal-inline-actions">
                <button className="portal-button" onClick={() => void send(`/api/v1/shelters/${text(shelter.id)}/verify/`, "POST", { approved: true }, "Refugio verificado.")}>Verificar</button>
                <button className="portal-button portal-button--secondary" onClick={() => void send(`/api/v1/shelters/${text(shelter.id)}/verify/`, "POST", { approved: false }, "Solicitud de refugio rechazada.")}>Rechazar</button>
              </div>
            )}
            {!isAdmin && (
              <>
                {canDo(RESOURCES.SHELTERS, ACTIONS.UPDATE) && <div className="portal-inline-actions">
                  <button className="portal-link" onClick={() => {
                    setEditingShelter(text(shelter.id));
                    setForm({
                      name: text(shelter.name),
                      address: text(shelter.address),
                      city: text(shelter.city),
                      contact_phone: text(shelter.contact_phone),
                      contact_email: text(shelter.contact_email),
                    });
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}>Editar refugio</button>
                </div>}
                {canDo(RESOURCES.SHELTER_MEMBERS, ACTIONS.CREATE) && <form className="portal-card-form" onSubmit={submit(async () => {
                  await send(`/api/v1/shelters/${text(shelter.id)}/members/`, "POST", { user: Number(form.member_user), position: form.position || "colaborador" }, "Integrante agregado.");
                })}>
                  <Field label="ID de la cuenta de refugio a agregar" name="member_user" type="number" value={form.member_user ?? ""} onChange={setValue} required />
                  <Field label="Cargo" name="position" value={form.position ?? "colaborador"} onChange={setValue} options={[{ value: "responsable", label: "Responsable" }, { value: "colaborador", label: "Colaborador" }]} />
                  <button className="portal-link" disabled={busy}>Agregar integrante</button>
                </form>}
              </>
            )}
          </DataCard>
        ))}
      </div>
      {!isAdmin && members.length > 0 && (
        <>
          <h2 className="portal-subheading">Integrantes</h2>
          <div className="portal-grid">
            {members.map((member) => (
              <DataCard
                key={text(member.id)}
                title={`Cuenta #${text(member.user)}`}
                subtitle={`Refugio #${text(member.shelter)}`}
                status={text(member.position)}
                actions={
                  text(member.user) !== text(userId) && canDo(RESOURCES.SHELTER_MEMBERS, ACTIONS.DELETE)
                    ? <button className="portal-link portal-link--danger" onClick={() => {
                        if (window.confirm("¿Quitar esta cuenta del refugio?")) {
                          void send(`/api/v1/shelter-members/${text(member.id)}/`, "DELETE", undefined, "Integrante eliminado.");
                        }
                      }}>Quitar integrante</button>
                    : undefined
                }
              />
            ))}
          </div>
        </>
      )}
      {!loading && shelters.length === 0 && <EmptyState>No hay refugios que mostrar. Registra el primero para comenzar.</EmptyState>}
    </>
  );
}

export function UsersSection({
  isAdmin,
  userId,
  isPlatformSuperadmin,
  canDo,
  users,
  availableRoleRows,
  form,
  setForm,
  setValue,
  submit,
  send,
  editingUser,
  setEditingUser,
  roleNames,
  loading,
  busy,
  setError,
}: {
  isAdmin: boolean;
  userId: string | number;
  isPlatformSuperadmin: boolean;
  canDo: PermissionCheck;
  users: PortalDataRow[];
  availableRoleRows: PortalDataRow[];
  form: Record<string, string>;
  setForm: (value: Record<string, string>) => void;
  setValue: (name: string, value: string) => void;
  submit: PortalSubmit;
  send: PortalSender;
  editingUser: string;
  setEditingUser: (value: string) => void;
  roleNames: Record<string, string>;
  loading: boolean;
  busy: boolean;
  setError: (value: string) => void;
}) {
  const mayCreate = canDo(RESOURCES.USERS, ACTIONS.CREATE);
  const mayUpdate = canDo(RESOURCES.USERS, ACTIONS.UPDATE);
  const mayDelete = canDo(RESOURCES.USERS, ACTIONS.DELETE);
  const editingAccount = users.find((account) => text(account.id) === editingUser);
  const editingPlatformSuperadmin = editingAccount?.is_platform_superadmin === true;
  const assignableRoleRows = isAdmin
    ? availableRoleRows.filter(
        (item) => isPlatformSuperadmin || text(item.name) !== ROLES.ADMIN,
      )
    : availableRoleRows.filter((item) =>
        [ROLES.ADOPTER, ROLES.SHELTER].includes(
          text(item.name) as typeof ROLES.ADOPTER | typeof ROLES.SHELTER,
        ),
      );
  const availableRoles = assignableRoleRows.length
    ? assignableRoleRows.map((item) => ({
        value: text(item.name),
        label: text(item.label) || roleNames[text(item.name)] || text(item.name),
      }))
    : [
        { value: ROLES.ADOPTER, label: "Adoptante" },
        { value: ROLES.SHELTER, label: "Refugio" },
        ...(isAdmin
          ? [
              { value: ROLES.VETERINARIAN, label: "Veterinario" },
              ...(isPlatformSuperadmin
                ? [{ value: ROLES.ADMIN, label: "Administrador" }]
                : []),
            ]
          : []),
      ];

  return (
    <>
      <SectionTitle
        eyebrow="Administración"
        title="Usuarios"
        description="Administra cuentas, roles y acceso al sistema. Las contraseñas nunca se muestran."
      />
      {(mayCreate || (editingUser && mayUpdate)) && (
        <form className="portal-form" onSubmit={submit(async () => {
          const payload: Record<string, unknown> = {
            name: form.name,
            email: form.email,
            phone: form.phone || null,
            role: form.role,
            active: form.active !== "false",
          };
          if (form.password) payload.password = form.password;
          if (!editingUser && !form.password) {
            setError("Ingresa una contraseña para la nueva cuenta.");
            return;
          }
          await send(
            editingUser ? `/api/v1/auth/users/${editingUser}/` : "/api/v1/auth/users/",
            editingUser ? "PATCH" : "POST",
            payload,
            editingUser ? "Cuenta actualizada." : "Cuenta creada.",
          );
        })}>
          <h2>{editingUser ? "Editar cuenta" : "Crear cuenta"}</h2>
          <Field label="Nombre completo" name="name" value={form.name ?? ""} onChange={setValue} required />
          <Field label="Correo electrónico" name="email" type="email" value={form.email ?? ""} onChange={setValue} required />
          <Field label="Teléfono" name="phone" value={form.phone ?? ""} onChange={setValue} />
          <Field label="Rol" name="role" value={form.role ?? ROLES.ADOPTER} onChange={setValue} required options={availableRoles} readOnly={editingPlatformSuperadmin} />
          <Field label={editingUser ? "Nueva contraseña (opcional)" : "Contraseña"} name="password" type="password" value={form.password ?? ""} onChange={setValue} required={!editingUser} />
          {editingUser && <Field label="Estado" name="active" value={form.active ?? "true"} onChange={setValue} options={[{ value: "true", label: "Activa" }, { value: "false", label: "Desactivada" }]} readOnly={editingPlatformSuperadmin} />}
          <div className="portal-form__actions">
            <button className="portal-button" disabled={busy}>{busy ? "Guardando…" : editingUser ? "Guardar cambios" : "Crear cuenta"}</button>
            {editingUser && <button className="portal-button portal-button--secondary" type="button" onClick={() => { setEditingUser(""); setForm({}); }}>Cancelar edición</button>}
          </div>
        </form>
      )}
      <div className="portal-user-list">
        {users.map((account) => {
          const canManageAccount =
            isPlatformSuperadmin ||
            (text(account.role) !== ROLES.ADMIN && account.is_platform_superadmin !== true);
          return (
            <DataCard
              key={text(account.id)}
              title={text(account.name)}
              subtitle={`${text(account.email)} · Cuenta #${text(account.id)}`}
              status={account.active === false ? "desactivada" : availableRoles.find((item) => item.value === text(account.role))?.label ?? roleNames[text(account.role)] ?? text(account.role)}
              actions={
                <>
                  {mayUpdate && canManageAccount && (
                    <button className="portal-link" onClick={() => {
                      setEditingUser(text(account.id));
                      setForm({
                        name: text(account.name),
                        email: text(account.email),
                        phone: text(account.phone),
                        role: text(account.role),
                        active: account.active === false ? "false" : "true",
                      });
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}>Editar</button>
                  )}
                  {mayUpdate && canManageAccount && account.id !== userId && (
                    <button className="portal-link" onClick={() => void send(
                      `/api/v1/auth/users/${text(account.id)}/`,
                      "PATCH",
                      { active: account.active === false },
                      account.active === false ? "Cuenta reactivada." : "Cuenta desactivada.",
                    )}>{account.active === false ? "Reactivar" : "Desactivar"}</button>
                  )}
                  {mayDelete && canManageAccount && account.id !== userId && (
                    <button className="portal-link portal-link--danger" onClick={() => {
                      if (window.confirm(`¿Eliminar la cuenta de ${text(account.name)}?`)) {
                        void send(`/api/v1/auth/users/${text(account.id)}/`, "DELETE", undefined, "Cuenta eliminada.");
                      }
                    }}>Eliminar</button>
                  )}
                </>
              }
            />
          );
        })}
      </div>
      {!loading && users.length === 0 && <EmptyState>No hay cuentas registradas.</EmptyState>}
    </>
  );
}
