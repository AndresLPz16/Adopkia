import type { Dispatch, FormEvent, SetStateAction } from "react";
import type { CatalogAction, ResourceFormState } from "./resources";

/** Formulario para crear o editar un recurso propio y sus acciones. */
export function ResourceForm({
  resourceForm,
  setResourceForm,
  editingResourceKey,
  matrixActions,
  saving,
  onSubmit,
  onCancel,
}: {
  resourceForm: ResourceFormState;
  setResourceForm: Dispatch<SetStateAction<ResourceFormState>>;
  editingResourceKey: string | null;
  matrixActions: readonly CatalogAction[];
  saving: boolean;
  onSubmit: (event: FormEvent) => void;
  onCancel: () => void;
}) {
  return (
    <form className="rbac-panel__role-form" onSubmit={onSubmit}>
      <label>
        Clave del recurso
        <input
          value={resourceForm.key}
          onChange={(event) =>
            setResourceForm({ ...resourceForm, key: event.target.value })
          }
          required
          maxLength={40}
          pattern="[a-z][A-Za-z0-9]*"
          placeholder="ej. adoptionReports"
          disabled={editingResourceKey !== null}
        />
      </label>
      <label>
        Nombre visible
        <input
          value={resourceForm.label}
          onChange={(event) =>
            setResourceForm({ ...resourceForm, label: event.target.value })
          }
          required
          maxLength={60}
          placeholder="ej. Informes de adopción"
        />
      </label>
      <fieldset className="rbac-panel__resource-actions">
        <legend>Acciones disponibles</legend>
        {matrixActions.map((action) => (
          <label key={action.key}>
            <input
              type="checkbox"
              checked={resourceForm.actions.includes(action.key)}
              onChange={() =>
                setResourceForm((current) => ({
                  ...current,
                  actions: current.actions.includes(action.key)
                    ? current.actions.filter((item) => item !== action.key)
                    : [...current.actions, action.key],
                }))
              }
            />
            {action.label}
          </label>
        ))}
      </fieldset>
      <p className="rbac-panel__description">
        Al crear la vista/API, asígnale esta clave como recurso RBAC para que
        estos permisos se apliquen también en el backend.
      </p>
      <div className="rbac-panel__role-actions">
        <button type="submit" disabled={saving || resourceForm.actions.length === 0}>
          {saving
            ? "Guardando…"
            : editingResourceKey
              ? "Guardar recurso"
              : "Crear recurso"}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onCancel}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
