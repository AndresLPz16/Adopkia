import { SectionTitle, hasStatus, text } from "./shared";
import type { PortalDataRow } from "./shared";

type DashboardSectionProps = {
  userName: string;
  roleName: string;
  isAdmin: boolean;
  shelters: PortalDataRow[];
  pets: PortalDataRow[];
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
  roleName,
  isAdmin,
  shelters,
  pets,
  requests,
  adoptions,
  notifications,
  stats,
  visibleLinks,
  sectionNames,
  navTo,
}: DashboardSectionProps) {
  return (
    <>
      <SectionTitle
        eyebrow={`Hola, ${userName}`}
        title={`Tu espacio ${roleName}`}
        description="Aquí tienes un resumen de lo que sucede en Adopkia."
      />
      <div className="portal-stat-grid">
        {(isAdmin
          ? [
              { label: "Refugios registrados", value: shelters.length },
              { label: "Adopciones", value: text(stats?.total_adoptions) || 0 },
              { label: "Adopciones activas", value: text(stats?.active_adoptions) || 0 },
              { label: "Mascotas devueltas", value: text(stats?.returned_pets) || 0 },
            ]
          : [
              { label: "Mascotas disponibles", value: pets.filter((item) => hasStatus(item.status, "disponible")).length },
              { label: "Solicitudes pendientes", value: requests.filter((item) => hasStatus(item.status, "pendiente")).length },
              { label: "Adopciones activas", value: adoptions.filter((item) => hasStatus(item.status, "activa")).length },
              { label: "Notificaciones", value: notifications.filter((item) => item.is_read !== true).length },
            ]
        ).map((stat) => (
          <div className="portal-stat" key={stat.label}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </div>
        ))}
      </div>
      <div className="portal-shortcuts">
        {visibleLinks
          .filter((key) => key !== "dashboard" && key !== "permissions")
          .map((key) => (
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
              <strong>{sectionNames[key]}</strong>
              <small>Ir a la sección</small>
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
    </>
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
