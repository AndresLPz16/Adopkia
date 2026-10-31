import { hasStatus, isAvailablePet, SectionTitle, text } from "./shared";
import type { PortalDataRow } from "./shared";
import { ROLES } from "../rbac/types";

type DashboardSectionProps = {
  userName: string;
  role: string;
  roleName: string;
  isAdmin: boolean;
  shelters: PortalDataRow[];
  pets: PortalDataRow[];
  managedPets: PortalDataRow[];
  records: PortalDataRow[];
  vaccines: PortalDataRow[];
  requests: PortalDataRow[];
  adoptions: PortalDataRow[];
  notifications: PortalDataRow[];
  stats?: PortalDataRow;
  visibleLinks: string[];
  sectionNames: Record<string, string>;
  navTo: (key: string) => void;
};

export function DashboardSection({
  userName,
  role,
  roleName,
  isAdmin,
  shelters,
  pets,
  managedPets,
  records,
  vaccines,
  requests,
  adoptions,
  notifications,
  stats,
  visibleLinks,
  sectionNames,
  navTo,
}: DashboardSectionProps) {
  const dashboardCopy: Record<string, { title: string; description: string; action: string; section: string }> = {
    [ROLES.ADOPTER]: {
      title: "Encuentra a tu nuevo compañero",
      description: "Explora mascotas, sigue tus solicitudes y mantente al tanto de cada paso de tu adopción.",
      action: "Explorar mascotas",
      section: "pets",
    },
    [ROLES.SHELTER]: {
      title: "Tu refugio, organizado",
      description: "Publica mascotas y acompaña cada solicitud desde un solo lugar.",
      action: "Gestionar mascotas",
      section: "pets",
    },
    [ROLES.VETERINARIAN]: {
      title: "Cuida cada historia",
      description: "Accede a expedientes y seguimientos para apoyar el bienestar de las mascotas.",
      action: "Abrir expedientes",
      section: "records",
    },
    [ROLES.ADMIN]: {
      title: "Adopkia bajo control",
      description: "Supervisa refugios, actividad de adopción y el funcionamiento de la plataforma.",
      action: "Revisar refugios",
      section: "shelters",
    },
  };
  const copy = dashboardCopy[role] ?? {
    title: `Tu espacio ${roleName}`,
    description: "Aquí tienes un resumen de lo que sucede en Adopkia.",
    action: "Ver actividad",
    section: "dashboard",
  };
  const availablePets = (role === ROLES.SHELTER ? managedPets : pets)
    .filter(isAvailablePet);
  const statsByRole: Record<string, { label: string; value: string | number }[]> = {
    [ROLES.ADMIN]: [
      { label: "Refugios registrados", value: shelters.length },
      { label: "Adopciones", value: text(stats?.total_adoptions) || 0 },
      { label: "Adopciones activas", value: text(stats?.active_adoptions) || 0 },
      { label: "Mascotas devueltas", value: text(stats?.returned_pets) || 0 },
    ],
    [ROLES.SHELTER]: [
      { label: "Mascotas a tu cuidado", value: managedPets.length },
      { label: "Disponibles para adopción", value: availablePets.length },
      { label: "Solicitudes pendientes", value: requests.filter((item) => hasStatus(item.status_code || item.status, "pendiente")).length },
      { label: "Adopciones activas", value: adoptions.filter((item) => hasStatus(item.status_code || item.status, "activa")).length },
    ],
    [ROLES.VETERINARIAN]: [
      { label: "Expedientes médicos", value: records.length },
      { label: "Mascotas en seguimiento", value: pets.length },
      { label: "Vacunas registradas", value: vaccines.length },
      { label: "Notificaciones", value: notifications.filter((item) => item.is_read !== true).length },
    ],
    [ROLES.ADOPTER]: [
      { label: "Mascotas disponibles", value: availablePets.length },
      { label: "Solicitudes pendientes", value: requests.filter((item) => hasStatus(item.status_code || item.status, "pendiente")).length },
      { label: "Adopciones activas", value: adoptions.filter((item) => hasStatus(item.status_code || item.status, "activa")).length },
      { label: "Notificaciones", value: notifications.filter((item) => item.is_read !== true).length },
    ],
  };
  const shortcutKeysByRole: Record<string, string[]> = {
    [ROLES.ADOPTER]: ["pets", "requests", "adoptions", "messages"],
    [ROLES.SHELTER]: ["pets", "requests", "adoptions", "messages", "shelters"],
    [ROLES.VETERINARIAN]: ["records", "adoptions", "notifications"],
    [ROLES.ADMIN]: ["shelters", "statistics", "users", "permissions"],
  };
  const shortcutLabels: Record<string, Record<string, string>> = {
    [ROLES.ADOPTER]: { pets: "Explorar mascotas", requests: "Mis solicitudes", adoptions: "Mis adopciones" },
    [ROLES.SHELTER]: { pets: "Mis mascotas", requests: "Solicitudes de adopción", shelters: "Mi refugio" },
    [ROLES.VETERINARIAN]: { records: "Expedientes médicos", adoptions: "Seguimientos" },
  };
  const shortcuts = (shortcutKeysByRole[role] ?? visibleLinks)
    .filter((key) => key !== "dashboard" && key !== "permissions" && visibleLinks.includes(key));

  return (
    <div className="portal-dashboard" data-role={role}>
      <div className="portal-dashboard__hero">
        <SectionTitle
          eyebrow={`Hola, ${userName}`}
          title={copy.title}
          description={copy.description}
        />
        {visibleLinks.includes(copy.section) && (
          <button className="portal-button" onClick={() => navTo(copy.section)}>
            {copy.action}
          </button>
        )}
      </div>
      <div className="portal-stat-grid">
        {(statsByRole[role] ?? []).map((stat) => (
          <div className="portal-stat" key={stat.label}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </div>
        ))}
      </div>
      <div className="portal-shortcuts">
        {shortcuts.map((key) => (
          <button key={key} className="portal-shortcut" onClick={() => navTo(key)}>
            <span aria-hidden="true">
              {(
                {
                  pets: "♡",
                  requests: "▤",
                  adoptions: "⌂",
                  messages: "✉",
                  records: "+",
                  shelters: "⌂",
                  notifications: "♧",
                  profile: "◉",
                  statistics: "▥",
                  users: "♙",
                } as Record<string, string>
              )[key] ?? "›"}
            </span>
            <strong>{shortcutLabels[role]?.[key] ?? sectionNames[key]}</strong>
            <small>{key === "messages" ? "Conversa con tu equipo" : "Ver y gestionar actividad"}</small>
          </button>
        ))}
        {visibleLinks.includes("permissions") && (
          <button className="portal-shortcut" onClick={() => navTo("permissions")}>
            <span aria-hidden="true">▦</span>
            <strong>Permisos por rol</strong>
            <small>Configurar accesos</small>
          </button>
        )}
      </div>
      {isAdmin && (
        <div className="portal-card">
          <div className="portal-card__heading">
            <div>
              <h3>Administración de Adopkia</h3>
              <p>Gestiona las verificaciones, consulta métricas y configura permisos.</p>
            </div>
          </div>
          <div className="portal-card__actions">
            <button className="portal-button" onClick={() => navTo("shelters")}>
              Revisar refugios
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function StatisticsSection({ stats }: { stats?: PortalDataRow }) {
  return (
    <>
      <SectionTitle
        eyebrow="Impacto"
        title="Estadísticas de adopción"
        description="Indicadores generales para supervisar el bienestar y los resultados de la plataforma."
      />
      <div className="portal-stat-grid">
        {[
          ["Adopciones", stats?.total_adoptions],
          ["Adopciones activas", stats?.active_adoptions],
          ["Mascotas adoptadas", stats?.adopted_pets],
          ["Devoluciones", stats?.returned_adoptions],
          ["Mascotas devueltas", stats?.returned_pets],
          ["Tasa de devolución", stats ? `${text(stats.return_rate)}%` : "—"],
        ].map(([label, value]) => (
          <div className="portal-stat" key={text(label)}>
            <span>{text(label)}</span>
            <strong>{value == null ? "—" : text(value)}</strong>
          </div>
        ))}
      </div>
    </>
  );
}
