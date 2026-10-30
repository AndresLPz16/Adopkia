import type { FormEvent, ReactNode } from "react";

export type PortalDataRow = Record<string, unknown>;
export type FieldOption = { value: string; label: string };
export type FieldProps = {
  label: string;
  name: string;
  value: string;
  onChange: (name: string, value: string) => void;
  type?: string;
  required?: boolean;
  options?: FieldOption[];
  multiline?: boolean;
  readOnly?: boolean;
};

export type PortalSender = (
  endpoint: string,
  method: string,
  body?: unknown,
  successMessage?: string,
) => Promise<boolean | void>;
export type PortalPetSaver = (
  endpoint: string,
  method: string,
  body: Record<string, unknown>,
  photoUrls: string[],
  photoFiles: File[],
) => Promise<boolean>;
export type PortalSubmit = (callback: () => Promise<void>) => (event: FormEvent) => void;

export function text(value: unknown): string {
  return value == null ? "" : String(value);
}

export function isAvailablePet(pet: PortalDataRow): boolean {
  const status = text(pet.status_code || pet.status).trim().toLocaleLowerCase();
  return status === "disponible" || status === "available";
}

export function rows(value: unknown): PortalDataRow[] {
  if (Array.isArray(value)) return value as PortalDataRow[];
  if (
    value &&
    typeof value === "object" &&
    "results" in value &&
    Array.isArray(value.results)
  ) {
    return value.results as PortalDataRow[];
  }
  return [];
}

export function labelStatus(value: unknown): string {
  const labels: Record<string, string> = {
    disponible: "Disponible",
    en_proceso: "En proceso",
    adoptada: "Adoptada",
    devuelta: "Devuelta",
    pendiente: "Pendiente",
    aprobada: "Aprobada",
    rechazada: "Rechazada",
    cancelada: "Cancelada",
    activa: "Activa",
    finalizada: "Finalizada",
    verificado: "Verificado",
    rechazado: "Rechazado",
    excelente: "Excelente",
    bueno: "Bueno",
    regular: "Regular",
    preocupante: "Requiere atención",
    vacunacion: "Vacunación",
    consulta: "Consulta",
    desparasitacion: "Desparasitación",
    cirugia: "Cirugía",
    control: "Control",
    otro: "Otro",
    leido: "Leída",
  };
  const key = text(value);
  return labels[key] ?? key.replaceAll("_", " ");
}

export function apiErrorMessage(data: unknown, status: number): string {
  if (
    data &&
    typeof data === "object" &&
    "detail" in data &&
    typeof data.detail === "string"
  ) {
    return data.detail;
  }
  if (typeof data === "string" && data) return data;

  if (data && typeof data === "object" && !Array.isArray(data)) {
    const labels: Record<string, string> = {
      email: "Correo electrónico",
      password: "Contraseña",
      name: "Nombre",
      phone: "Teléfono",
      role: "Rol",
      active: "Estado",
      non_field_errors: "",
    };
    const errors = Object.entries(data).flatMap(([field, value]) => {
      const fieldLabel =
        labels[field] ?? field.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
      const messages = Array.isArray(value) ? value : [value];
      return messages
        .filter((message): message is string => typeof message === "string")
        .map((message) => (fieldLabel ? `${fieldLabel}: ${message}` : message));
    });
    if (errors.length > 0) return errors.join(" · ");
  }

  return `La solicitud falló (HTTP ${status}).`;
}

export async function responseData(response: Response): Promise<unknown> {
  const body = await response.text();
  let data: unknown = null;
  if (body) {
    try {
      data = JSON.parse(body);
    } catch {
      data = body;
    }
  }
  if (!response.ok) {
    throw new Error(apiErrorMessage(data, response.status));
  }
  return data;
}

export function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  required = false,
  options,
  multiline = false,
  readOnly = false,
}: FieldProps) {
  return (
    <label className="portal-field">
      <span>{label}</span>
      {options ? (
        <select
          name={name}
          value={value}
          required={required}
          disabled={readOnly}
          onChange={(event) => onChange(name, event.target.value)}
        >
          <option value="">Selecciona una opción</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : multiline ? (
        <textarea
          name={name}
          value={value}
          required={required}
          rows={3}
          onChange={(event) => onChange(name, event.target.value)}
        />
      ) : (
        <input
          name={name}
          type={type}
          value={value}
          required={required}
          readOnly={readOnly}
          onChange={(event) => onChange(name, event.target.value)}
        />
      )}
    </label>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="portal-title">
      <div>
        <p className="portal-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="portal-empty">{children}</div>;
}

export function DataCard({
  title,
  subtitle,
  status,
  children,
  actions,
}: {
  title: string;
  subtitle?: string;
  status?: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <article className="portal-card">
      <div className="portal-card__heading">
        <div>
          <h3>{title || "Registro"}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {status && <span className="portal-badge">{labelStatus(status)}</span>}
      </div>
      {children && <div className="portal-card__body">{children}</div>}
      {actions && <div className="portal-card__actions">{actions}</div>}
    </article>
  );
}
