import { isAvailablePet, SectionTitle, text } from "./shared";
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
      { label: "Solicitudes pendientes", value: requests.filter((item) => item.status === "pendiente").length },
      { label: "Adopciones activas", value: adoptions.filter((item) => item.status === "activa").length },
    ],
    [ROLES.VETERINARIAN]: [
      { label: "Expedientes médicos", value: records.length },
      { label: "Mascotas en seguimiento", value: pets.length },
      { label: "Vacunas registradas", value: vaccines.length },
      { label: "Notificaciones", value: notifications.filter((item) => item.is_read !== true).length },
    ],
    [ROLES.ADOPTER]: [
      { label: "Mascotas disponibles", value: availablePets.length },
      { label: "Solicitudes pendientes", value: requests.filter((item) => item.status === "pendiente").length },
      { label: "Adopciones activas", value: adoptions.filter((item) => item.status === "activa").length },
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
        <div className="portal-dashboard__hero-info">
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
        <div className="portal-dashboard__hero-3d" aria-hidden="true">
          <div className="portal-dashboard__hero-emblem">
            <span className="portal-dashboard__hero-icon">
              {role === ROLES.ADOPTER ? "🐾" : role === ROLES.SHELTER ? "🏡" : role === ROLES.VETERINARIAN ? "🩺" : "🛡️"}
            </span>
            <span className="portal-dashboard__hero-sparkle portal-dashboard__hero-sparkle--1">✨</span>
            <span className="portal-dashboard__hero-sparkle portal-dashboard__hero-sparkle--2">💫</span>
          </div>
        </div>
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

function statisticsValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function StatisticsChart({
  title,
  values,
}: {
  title: string;
  values: { label: string; value: number }[];
}) {
  const width = 600;
  const height = 250;
  const chartTop = 28;
  const chartBottom = 195;
  const chartHeight = chartBottom - chartTop;
  const maxValue = Math.max(...values.map((item) => item.value), 1);
  const barWidth = Math.min(72, 360 / values.length);
  const gap = (width - 72 - values.length * barWidth) / (values.length + 1);

  return (
    <article className="portal-stat-chart">
      <h2>{title}</h2>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${title}: ${values.map((item) => `${item.label} ${item.value}`).join(", ")}`}
      >
        {[0, 0.5, 1].map((fraction) => {
          const y = chartBottom - chartHeight * fraction;
          return (
            <g key={fraction}>
              <line x1="48" x2={width - 16} y1={y} y2={y} className="portal-stat-chart__gridline" />
              <text x="40" y={y + 4} textAnchor="end" className="portal-stat-chart__axis-label">
                {Math.round(maxValue * fraction)}
              </text>
            </g>
          );
        })}
        {values.map((item, index) => {
          const barHeight = (item.value / maxValue) * chartHeight;
          const x = 48 + gap * (index + 1) + barWidth * index;
          const y = chartBottom - barHeight;
          return (
            <g key={item.label}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barHeight, 1)}
                rx="6"
                className="portal-stat-chart__bar"
              />
              <text
                x={x + barWidth / 2}
                y={Math.max(y - 8, 18)}
                textAnchor="middle"
                className="portal-stat-chart__value"
              >
                {item.value}
              </text>
              <text
                x={x + barWidth / 2}
                y={chartBottom + 24}
                textAnchor="middle"
                className="portal-stat-chart__label"
              >
                {item.label}
              </text>
            </g>
          );
        })}
      </svg>
    </article>
  );
}

export function StatisticsSection({ stats }: { stats?: PortalDataRow }) {
  const metrics = [
    { label: "Adopciones", value: statisticsValue(stats?.total_adoptions) },
    { label: "Adopciones activas", value: statisticsValue(stats?.active_adoptions) },
    { label: "Mascotas adoptadas", value: statisticsValue(stats?.adopted_pets) },
    { label: "Devoluciones", value: statisticsValue(stats?.returned_adoptions) },
    { label: "Mascotas devueltas", value: statisticsValue(stats?.returned_pets) },
    { label: "Tasa de devolución", value: statisticsValue(stats?.return_rate) },
  ];
  const exportCsv = () => {
    const csvRows = [
      ["Estadística", "Valor"],
      ...metrics.map((metric) => [
        metric.label,
        metric.label === "Tasa de devolución" ? `${metric.value}%` : String(metric.value),
      ]),
    ];
    const csv = `\uFEFF${csvRows
      .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","))
      .join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "estadisticas-adopkia.csv";
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="portal-statistics">
      <SectionTitle
        eyebrow="Impacto"
        title="Estadísticas de adopción"
        description="Indicadores generales para supervisar el bienestar y los resultados de la plataforma."
        action={
          <div className="portal-statistics__actions">
            <button type="button" className="portal-button portal-button--secondary" onClick={exportCsv}>
              Exportar CSV
            </button>
            <button type="button" className="portal-button" onClick={() => window.print()}>
              Exportar informe / PDF
            </button>
          </div>
        }
      />
      <div className="portal-stat-grid">
        {metrics.map((metric) => (
          <div className="portal-stat" key={metric.label}>
            <span>{metric.label}</span>
            <strong>
              {metric.label === "Tasa de devolución"
                ? `${text(stats?.return_rate) || "0"}%`
                : metric.value}
            </strong>
          </div>
        ))}
      </div>
      <div className="portal-statistics__charts">
        <StatisticsChart
          title="Estado de las adopciones"
          values={[
            { label: "Activas", value: statisticsValue(stats?.active_adoptions) },
            { label: "Devueltas", value: statisticsValue(stats?.returned_adoptions) },
            {
              label: "Finalizadas",
              value: Math.max(
                statisticsValue(stats?.total_adoptions) -
                  statisticsValue(stats?.active_adoptions) -
                  statisticsValue(stats?.returned_adoptions),
                0,
              ),
            },
          ]}
        />
        <StatisticsChart
          title="Estado de las mascotas"
          values={[
            { label: "Adoptadas", value: statisticsValue(stats?.adopted_pets) },
            { label: "Devueltas", value: statisticsValue(stats?.returned_pets) },
          ]}
        />
      </div>
    </section>
  );
}
