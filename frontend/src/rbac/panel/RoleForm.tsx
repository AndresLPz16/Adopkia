import type { Dispatch, FormEvent, SetStateAction } from "react";
import type { RoleFormState } from "./resources";

/** Formulario para crear un rol o editar su nombre visible y descripción. */
export function RoleForm({
  roleForm,
  setRoleForm,
  mode,
  saving,
  onSubmit,
  onCancel,
}: {
  roleForm: RoleFormState;
  setRoleForm: Dispatch<SetStateAction<RoleFormState>>;
  mode: "create" | "edit";
  saving: boolean;
  onSubmit: (event: FormEvent) => void;
  onCancel: () => void;
}) {
  return (
    <form className="rbac-panel__role-form" onSubmit={onSubmit}>
      <label>
        Identificador
        <input
          value={roleForm.name}
          onChange={(event) => setRoleForm({ ...roleForm, name: event.target.value })}
          required
          minLength={3}
          maxLength={30}
          pattern="[a-z][a-z0-9_]*"
          disabled={mode === "edit"}
        />
      </label>
      <label>
        Nombre visible
        <input
          value={roleForm.label}
          onChange={(event) => setRoleForm({ ...roleForm, label: event.target.value })}
          required
          maxLength={60}
        />
      </label>
      <label>
        Descripción
        <input
          value={roleForm.description}
          onChange={(event) => setRoleForm({ ...roleForm, description: event.target.value })}
          maxLength={150}
        />
      </label>
      <button type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar rol"}</button>
      <button type="button" disabled={saving} onClick={onCancel}>Cancelar</button>
    </form>
  );
}
