import { DataCard, EmptyState, SectionTitle, text } from "../shared";
import type { PortalDataRow } from "../shared";

export function VeterinariansSection({
  veterinarians,
  loading,
}: {
  veterinarians: PortalDataRow[];
  loading: boolean;
}) {
  return (
    <>
      <SectionTitle
        eyebrow="Directorio profesional"
        title="Perfiles veterinarios"
        description="Consulta los profesionales veterinarios registrados en Adopkia."
      />
      <div className="portal-grid">
        {veterinarians.map((veterinarian) => (
          <DataCard
            key={text(veterinarian.id)}
            title={text(veterinarian.user_name) || `Cuenta #${text(veterinarian.user)}`}
            subtitle={`Tarjeta profesional: ${text(veterinarian.professional_card)}`}
          >
            {Boolean(veterinarian.clinic) && <p>Clínica: {text(veterinarian.clinic)}</p>}
            {Boolean(veterinarian.specialty) && (
              <p>Especialidad: {text(veterinarian.specialty)}</p>
            )}
          </DataCard>
        ))}
      </div>
      {!loading && veterinarians.length === 0 && (
        <EmptyState>Aún no hay perfiles veterinarios registrados.</EmptyState>
      )}
    </>
  );
}
