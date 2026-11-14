import { useState } from "react";
import { confirmAction } from "../../ui/confirm";
import { ACTIONS, RESOURCES } from "../../rbac/types";
import { DataCard, EmptyState, Field, SectionTitle, text } from "../shared";
import type { PermissionCheck, PortalDataRow, PortalSender } from "../shared";

export function VaccineCatalogSection({
  vaccines,
  species,
  canDo,
  send,
  loading,
  busy,
}: {
  vaccines: PortalDataRow[];
  species: PortalDataRow[];
  canDo: PermissionCheck;
  send: PortalSender;
  loading: boolean;
  busy: boolean;
}) {
  const [editingId, setEditingId] = useState("");
  const [draft, setDraft] = useState({
    species: "",
    name: "",
    description: "",
    booster_interval_days: "",
  });
  const canCreate = canDo(RESOURCES.VACCINES, ACTIONS.CREATE);
  const canUpdate = canDo(RESOURCES.VACCINES, ACTIONS.UPDATE);

  const startEditing = (vaccine?: PortalDataRow) => {
    setEditingId(vaccine ? text(vaccine.id) : "new");
    setDraft({
      species: text(vaccine?.species),
      name: text(vaccine?.name),
      description: text(vaccine?.description),
      booster_interval_days: text(vaccine?.booster_interval_days),
    });
  };

  return (
    <>
      <SectionTitle
        eyebrow="Atención veterinaria"
        title="Catálogo de vacunas"
        description="Administra las vacunas disponibles para registrar en las mascotas."
      />
      {canCreate && !editingId && (
        <button type="button" className="portal-link" onClick={() => startEditing()}>
          Agregar vacuna
        </button>
      )}
      {editingId && (
        <form
          className="portal-form"
          onSubmit={(event) => {
            event.preventDefault();
            const payload = {
              species: Number(draft.species),
              name: draft.name,
              description: draft.description || null,
              booster_interval_days: draft.booster_interval_days
                ? Number(draft.booster_interval_days)
                : null,
            };
            const endpoint = editingId === "new"
              ? "/api/v1/vaccines/"
              : `/api/v1/vaccines/${editingId}/`;
            void send(
              endpoint,
              editingId === "new" ? "POST" : "PATCH",
              payload,
              editingId === "new" ? "Vacuna agregada." : "Vacuna actualizada.",
            ).then((saved) => {
              if (saved) setEditingId("");
            });
          }}
        >
          <h2>{editingId === "new" ? "Agregar vacuna" : "Editar vacuna"}</h2>
          <Field
            label="Especie"
            name="species"
            value={draft.species}
            onChange={(name, value) => setDraft((current) => ({ ...current, [name]: value }))}
            required
            options={species.map((item) => ({ value: text(item.id), label: text(item.name) }))}
          />
          <Field
            label="Nombre"
            name="name"
            value={draft.name}
            onChange={(name, value) => setDraft((current) => ({ ...current, [name]: value }))}
            required
          />
          <Field
            label="Descripción"
            name="description"
            value={draft.description}
            onChange={(name, value) => setDraft((current) => ({ ...current, [name]: value }))}
            multiline
          />
          <Field
            label="Intervalo de refuerzo (días)"
            name="booster_interval_days"
            type="number"
            value={draft.booster_interval_days}
            onChange={(name, value) => setDraft((current) => ({ ...current, [name]: value }))}
          />
          <button type="submit" disabled={busy}>
            {busy ? "Guardando…" : "Guardar vacuna"}
          </button>
          <button type="button" disabled={busy} onClick={() => setEditingId("")}>
            Cancelar
          </button>
        </form>
      )}
      <div className="portal-grid">
        {vaccines.map((vaccine) => (
          <DataCard
            key={text(vaccine.id)}
            title={text(vaccine.name)}
            subtitle={text(vaccine.species_name)}
            actions={(canUpdate || canDo(RESOURCES.VACCINES, ACTIONS.DELETE)) ? (
              <div className="portal-inline-actions">
                {canUpdate && (
                  <button
                    type="button"
                    className="portal-link"
                    onClick={() => startEditing(vaccine)}
                  >
                    Editar vacuna
                  </button>
                )}
                {canDo(RESOURCES.VACCINES, ACTIONS.DELETE) && (
                  <button
                    type="button"
                    className="portal-link"
                    disabled={busy}
                    onClick={async () => {
                      if (await confirmAction({
                        title: `¿Eliminar la vacuna ${text(vaccine.name)}?`,
                        message: "Se quitará del historial de la mascota. Esta acción no se puede deshacer.",
                      })) {
                        void send(
                          `/api/v1/vaccines/${text(vaccine.id)}/`,
                          "DELETE",
                          undefined,
                          "Vacuna eliminada.",
                        );
                      }
                    }}
                  >
                    Eliminar vacuna
                  </button>
                )}
              </div>
            ) : undefined}
          >
            {Boolean(vaccine.description) && <p>{text(vaccine.description)}</p>}
            {vaccine.booster_interval_days != null && (
              <p>Refuerzo cada {text(vaccine.booster_interval_days)} días</p>
            )}
          </DataCard>
        ))}
      </div>
      {!loading && vaccines.length === 0 && (
        <EmptyState>Aún no hay vacunas en el catálogo.</EmptyState>
      )}
    </>
  );
}
