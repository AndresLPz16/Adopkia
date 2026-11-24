import { useState } from "react";
import { Pencil, X } from "lucide-react";
import { confirmAction } from "../../ui/confirm";
import { ACTIONS, RESOURCES } from "../../rbac/types";
import { DataCard, EmptyState, Field, SectionTitle, text } from "../shared";
import type { PermissionCheck, PortalDataRow, PortalSender } from "../shared";

type Editing = { kind: "species" | "breed"; id: string; name: string } | null;

// Catálogo de especies y razas que los refugios eligen al publicar una mascota.
export function SpeciesCatalogSection({
  species,
  breeds,
  canDo,
  send,
  loading,
  busy,
}: {
  species: PortalDataRow[];
  breeds: PortalDataRow[];
  canDo: PermissionCheck;
  send: PortalSender;
  loading: boolean;
  busy: boolean;
}) {
  const [newSpecies, setNewSpecies] = useState("");
  const [newBreeds, setNewBreeds] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Editing>(null);
  const canCreate = canDo(RESOURCES.SPECIES, ACTIONS.CREATE);
  const canUpdate = canDo(RESOURCES.SPECIES, ACTIONS.UPDATE);
  const canDelete = canDo(RESOURCES.SPECIES, ACTIONS.DELETE);

  const saveRename = () => {
    if (!editing) return;
    const endpoint = editing.kind === "species"
      ? `/api/v1/species/${editing.id}/`
      : `/api/v1/breeds/${editing.id}/`;
    void send(
      endpoint,
      "PATCH",
      { name: editing.name },
      editing.kind === "species" ? "Especie actualizada." : "Raza actualizada.",
    ).then((saved) => {
      if (saved) setEditing(null);
    });
  };

  const renameForm = (label: string) =>
    editing && (
      <form
        className="portal-card-form"
        onSubmit={(event) => {
          event.preventDefault();
          saveRename();
        }}
      >
        <Field
          label={label}
          name="rename"
          value={editing.name}
          onChange={(_name, value) => setEditing({ ...editing, name: value })}
          required
        />
        <div className="portal-inline-actions">
          <button className="portal-link" disabled={busy}>Guardar</button>
          <button type="button" className="portal-link" onClick={() => setEditing(null)}>
            Cancelar
          </button>
        </div>
      </form>
    );

  return (
    <>
      <SectionTitle
        eyebrow="Gestión"
        title="Especies y razas"
        description="Define qué animales pueden publicar los refugios. Cada especie nueva empieza con la raza «Sin raza definida»."
      />
      {canCreate && (
        <form
          className="portal-form portal-form--compact"
          onSubmit={(event) => {
            event.preventDefault();
            void send("/api/v1/species/", "POST", { name: newSpecies }, "Especie agregada.").then(
              (saved) => {
                if (saved) setNewSpecies("");
              },
            );
          }}
        >
          <Field
            label="Nueva especie"
            name="name"
            value={newSpecies}
            onChange={(_name, value) => setNewSpecies(value)}
            required
          />
          <button className="portal-button" disabled={busy}>Agregar especie</button>
        </form>
      )}
      <div className="portal-grid">
        {species.map((item) => {
          const speciesId = text(item.id);
          const speciesName = text(item.name);
          const ownBreeds = breeds.filter((breed) => text(breed.species) === speciesId);
          const renamingSpecies = editing?.kind === "species" && editing.id === speciesId;
          return (
            <DataCard
              key={speciesId}
              title={speciesName}
              subtitle={`${ownBreeds.length} ${ownBreeds.length === 1 ? "raza" : "razas"}`}
              actions={(canUpdate || canDelete) ? (
                <div className="portal-inline-actions">
                  {canUpdate && !renamingSpecies && (
                    <button
                      type="button"
                      className="portal-link"
                      onClick={() => setEditing({ kind: "species", id: speciesId, name: speciesName })}
                    >
                      Cambiar nombre
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      className="portal-link portal-link--danger"
                      disabled={busy}
                      onClick={async () => {
                        if (await confirmAction({
                          title: `¿Eliminar la especie ${speciesName}?`,
                          message: "Se quitarán también sus razas. Solo se puede si ninguna mascota ni vacuna la usa.",
                        })) {
                          void send(`/api/v1/species/${speciesId}/`, "DELETE", undefined, "Especie eliminada.");
                        }
                      }}
                    >
                      Eliminar especie
                    </button>
                  )}
                </div>
              ) : undefined}
            >
              {renamingSpecies && renameForm("Nombre de la especie")}
              <ul className="portal-chip-list" aria-label={`Razas de ${speciesName}`}>
                {ownBreeds.map((breed) => {
                  const breedId = text(breed.id);
                  const breedName = text(breed.name);
                  if (editing?.kind === "breed" && editing.id === breedId) {
                    return <li key={breedId} className="portal-chip-list__form">{renameForm("Nombre de la raza")}</li>;
                  }
                  return (
                    <li key={breedId} className="portal-chip">
                      <span>{breedName}</span>
                      {canUpdate && (
                        <button
                          type="button"
                          aria-label={`Cambiar nombre de la raza ${breedName}`}
                          onClick={() => setEditing({ kind: "breed", id: breedId, name: breedName })}
                        >
                          <Pencil size={14} aria-hidden="true" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          aria-label={`Quitar la raza ${breedName}`}
                          disabled={busy}
                          onClick={async () => {
                            if (await confirmAction({
                              title: `¿Quitar la raza ${breedName}?`,
                              message: "Solo se puede quitar si ninguna mascota la usa.",
                            })) {
                              void send(`/api/v1/breeds/${breedId}/`, "DELETE", undefined, "Raza eliminada.");
                            }
                          }}
                        >
                          <X size={14} aria-hidden="true" />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
              {canCreate && (
                <form
                  className="portal-card-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void send(
                      "/api/v1/breeds/",
                      "POST",
                      { species: Number(speciesId), name: newBreeds[speciesId] ?? "" },
                      "Raza agregada.",
                    ).then((saved) => {
                      if (saved) setNewBreeds((current) => ({ ...current, [speciesId]: "" }));
                    });
                  }}
                >
                  <Field
                    label={`Nueva raza de ${speciesName}`}
                    name={`breed-${speciesId}`}
                    value={newBreeds[speciesId] ?? ""}
                    onChange={(_name, value) => setNewBreeds((current) => ({ ...current, [speciesId]: value }))}
                    required
                  />
                  <button className="portal-link" disabled={busy}>Agregar raza</button>
                </form>
              )}
            </DataCard>
          );
        })}
      </div>
      {!loading && species.length === 0 && (
        <EmptyState>Aún no hay especies en el catálogo.</EmptyState>
      )}
    </>
  );
}
