import { useEffect, useState } from "react";
import { ACTIONS, RESOURCES, ROLES } from "../rbac/types";
import type { Action, Resource } from "../rbac/types";
import { DataCard, EmptyState, Field, SectionTitle, labelStatus, statusTone, text } from "./shared";
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
            {shelter.verification_status === "pendiente" && canDo(RESOURCES.SHELTERS, ACTIONS.VERIFY) && (
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
            {(isAdmin || members.some(
              (member) =>
                text(member.shelter) === text(shelter.id) &&
                text(member.user) === text(userId),
            )) && canDo(RESOURCES.SHELTERS, ACTIONS.DELETE) && (
              <button
                className="portal-link portal-link--danger"
                onClick={() => {
                  if (window.confirm(`¿Eliminar el refugio "${text(shelter.name)}"? Esta acción no se puede deshacer.`)) {
                    void send(
                      `/api/v1/shelters/${text(shelter.id)}/`,
                      "DELETE",
                      undefined,
                      "Refugio eliminado.",
                    );
                  }
                }}
              >
                Eliminar refugio
              </button>
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
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("");
  const [userStatusFilter, setUserStatusFilter] = useState("");
  const [userSort, setUserSort] = useState("name-asc");
  const [userPage, setUserPage] = useState(1);
  const [usersPerPage, setUsersPerPage] = useState(10);
  // El formulario de alta se abre con el botón "Nueva cuenta" para que la
  // lista de cuentas quede a la vista.
  const [createFormOpen, setCreateFormOpen] = useState(false);
  const mayCreate = canDo(RESOURCES.USERS, ACTIONS.CREATE);
  const mayUpdate = canDo(RESOURCES.USERS, ACTIONS.UPDATE);
  const mayDelete = canDo(RESOURCES.USERS, ACTIONS.DELETE);
  const editingAccount = users.find((account) => text(account.id) === editingUser);
  const editingPlatformSuperadmin = editingAccount?.is_platform_superadmin === true;
  const roleRows = [...availableRoleRows];
  for (const account of users) {
    const accountRole = text(account.role);
    if (accountRole && !roleRows.some((item) => text(item.name) === accountRole)) {
      roleRows.push({
        name: accountRole,
        label: roleNames[accountRole] ?? accountRole,
      });
    }
  }
  if (
    editingAccount &&
    !roleRows.some((item) => text(item.name) === text(editingAccount.role))
  ) {
    roleRows.push({
      name: text(editingAccount.role),
      label: roleNames[text(editingAccount.role)] ?? text(editingAccount.role),
    });
  }
  const availableRoles = roleRows.map((item) => ({
    value: text(item.name),
    label: text(item.label) || roleNames[text(item.name)] || text(item.name),
  }));
  const searchTerm = userSearch.trim().toLocaleLowerCase();
  const filteredUsers = users.filter((account) => {
    const matchesSearch = [
      account.name,
      account.username,
      account.email,
      roleNames[text(account.role)],
      text(account.role),
    ]
      .map(text)
      .join(" ")
      .toLocaleLowerCase()
      .includes(searchTerm);
    const matchesRole = !userRoleFilter || text(account.role) === userRoleFilter;
    const isActive = account.active !== false;
    const matchesStatus =
    !userStatusFilter ||
    (userStatusFilter === "active" ? isActive : !isActive);
    return matchesSearch && matchesRole && matchesStatus;
  }).sort((left, right) => {
    const leftName = text(left.name || left.username).toLocaleLowerCase();
    const rightName = text(right.name || right.username).toLocaleLowerCase();
    if (userSort === "name-desc") return rightName.localeCompare(leftName, "es");
    if (userSort === "role-asc") {
      const leftRole = roleNames[text(left.role)] ?? text(left.role);
      const rightRole = roleNames[text(right.role)] ?? text(right.role);
      return leftRole.localeCompare(rightRole, "es");
    }
    if (userSort === "status") {
      return Number(left.active === false) - Number(right.active === false);
    }
    return leftName.localeCompare(rightName, "es");
  });
  const pageCount = Math.ceil(filteredUsers.length / usersPerPage);
  const currentPage = Math.min(userPage, Math.max(pageCount, 1));
  const pageStart = (currentPage - 1) * usersPerPage;
  const paginatedUsers = filteredUsers.slice(pageStart, pageStart + usersPerPage);
  useEffect(() => {
    setUserPage((page) => Math.min(page, Math.max(pageCount, 1)));
  }, [pageCount]);
  const updateUserSearch = (value: string) => {
    setUserSearch(value);
    setUserPage(1);
  };
  const updateUserRoleFilter = (value: string) => {
    setUserRoleFilter(value);
    setUserPage(1);
  };
  const updateUserStatusFilter = (value: string) => {
    setUserStatusFilter(value);
    setUserPage(1);
  };
  const updateUserSort = (value: string) => {
    setUserSort(value);
    setUserPage(1);
  };

  return (
    <>
      <SectionTitle
        eyebrow="Administración"
        title="Usuarios"
        description="Administra cuentas, roles y acceso al sistema. Las contraseñas nunca se muestran."
      />
      {isPlatformSuperadmin && (
        <>
          <div className="portal-stat-grid">
            <div className="portal-stat">
              <span>Usuarios registrados</span>
              <strong>{loading && users.length === 0 ? "…" : users.length}</strong>
            </div>
          </div>
        </>
      )}
      <div className="portal-user-filters">
        <label className="portal-search">
          <span>Buscar por nombre, usuario, correo o rol</span>
          <input
            type="search"
            value={userSearch}
            onChange={(event) => updateUserSearch(event.target.value)}
            placeholder="Ej. yoider00, refugio o adoptante"
          />
        </label>
        <label className="portal-user-filters__field">
          <span>Filtrar por rol</span>
          <select
            value={userRoleFilter}
            onChange={(event) => updateUserRoleFilter(event.target.value)}
          >
            <option value="">Todos los roles</option>
            {availableRoles.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </label>
        <label className="portal-user-filters__field">
          <span>Filtrar por estado</span>
          <select
            value={userStatusFilter}
            onChange={(event) => updateUserStatusFilter(event.target.value)}
          >
            <option value="">Todos los estados</option>
            <option value="active">Activas</option>
            <option value="inactive">Desactivadas</option>
          </select>
        </label>
        <label className="portal-user-filters__field">
          <span>Ordenar por</span>
          <select
            value={userSort}
            onChange={(event) => updateUserSort(event.target.value)}
          >
            <option value="name-asc">Nombre: A–Z</option>
            <option value="name-desc">Nombre: Z–A</option>
            <option value="role-asc">Rol: A–Z</option>
            <option value="status">Estado: activas primero</option>
          </select>
        </label>
      </div>
      <div className="portal-user-toolbar">
        <p className="portal-user-list__summary" aria-live="polite">
          {filteredUsers.length === 0
            ? "No hay usuarios para mostrar."
            : `Mostrando ${pageStart + 1}–${Math.min(pageStart + usersPerPage, filteredUsers.length)} de ${filteredUsers.length} usuarios`}
        </p>
        {mayCreate && !editingUser && !createFormOpen && (
          <button
            className="portal-button"
            type="button"
            onClick={() => setCreateFormOpen(true)}
          >
            Nueva cuenta
          </button>
        )}
      </div>
      {((mayCreate && createFormOpen) || (editingUser && mayUpdate)) && (
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
          const saved = await send(
            editingUser ? `/api/v1/auth/users/${editingUser}/` : "/api/v1/auth/users/",
            editingUser ? "PATCH" : "POST",
            payload,
            editingUser ? "Cuenta actualizada." : "Cuenta creada.",
          );
          if (saved !== false && !editingUser) setCreateFormOpen(false);
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
            {!editingUser && <button className="portal-button portal-button--secondary" type="button" onClick={() => { setCreateFormOpen(false); setForm({}); }}>Cancelar</button>}
          </div>
        </form>
      )}
      <div className="portal-user-list">
        {paginatedUsers.map((account) => {
          const canManageAccount =
            isPlatformSuperadmin ||
            (text(account.role) !== ROLES.ADMIN && account.is_platform_superadmin !== true);
          const status =
            account.active === false
              ? "desactivada"
              : availableRoles.find((item) => item.value === text(account.role))?.label ??
                roleNames[text(account.role)] ??
                text(account.role);
          return (
            // Fila compacta: una cuenta por línea en lugar de una tarjeta alta.
            <article className="portal-user-row" key={text(account.id)}>
              <div className="portal-user-row__identity">
                <h3>{text(account.name) || "Registro"}</h3>
                <p>{`${account.username ? `@${text(account.username)} · ` : ""}${text(account.email)} · Cuenta #${text(account.id)}`}</p>
              </div>
              <span className={`portal-badge portal-badge--${statusTone(status)}`}>
                {labelStatus(status)}
              </span>
              <div className="portal-user-row__actions">
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
              </div>
            </article>
          );
        })}
      </div>
      {filteredUsers.length > 0 && (
        <div className="portal-user-pagination" aria-label="Paginación de usuarios">
          <label className="portal-user-pagination__size">
            <span>Por página</span>
            <select
              value={usersPerPage}
              onChange={(event) => {
                setUsersPerPage(Number(event.target.value));
                setUserPage(1);
              }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </label>
          <div className="portal-user-pagination__controls">
            <button
              type="button"
              className="portal-button portal-button--secondary"
              disabled={currentPage === 1}
              onClick={() => setUserPage((page) => Math.max(page - 1, 1))}
            >
              Anterior
            </button>
            <span aria-live="polite">Página {currentPage} de {Math.max(pageCount, 1)}</span>
            <button
              type="button"
              className="portal-button portal-button--secondary"
              disabled={currentPage >= pageCount}
              onClick={() => setUserPage((page) => Math.min(page + 1, pageCount))}
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
      {!loading && users.length === 0 && <EmptyState>No hay cuentas registradas.</EmptyState>}
      {!loading && users.length > 0 && filteredUsers.length === 0 && (
        <EmptyState>No se encontraron cuentas que coincidan con la búsqueda.</EmptyState>
      )}
    </>
  );
}
