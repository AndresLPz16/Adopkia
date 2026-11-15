import type { PermissionRole } from "../types";
import { ROLES } from "../types";
import { systemResourceKeys } from "./resources";
import type { CatalogAction, CatalogResource } from "./resources";

/** Tabla de recursos por acciones con una casilla por permiso del rol elegido. */
export function PermissionMatrix({
  resources,
  matrixActions,
  currentRole,
  getResourceLabel,
  saving,
  canUpdatePermissions,
  canDeleteRoles,
  canEditCurrentRole,
  isPlatformSuperadmin,
  onEditResource,
  onDeleteResource,
  onToggle,
}: {
  resources: readonly CatalogResource[];
  matrixActions: readonly CatalogAction[];
  currentRole: PermissionRole | null;
  getResourceLabel: (resource: CatalogResource) => string;
  saving: boolean;
  canUpdatePermissions: boolean;
  canDeleteRoles: boolean;
  canEditCurrentRole: boolean;
  isPlatformSuperadmin: boolean;
  onEditResource: (resource: CatalogResource) => void;
  onDeleteResource: (resource: CatalogResource) => void;
  onToggle: (resource: string, action: string) => void;
}) {
  return (
    <div className="rbac-panel__table-wrap">
      <table className="rbac-panel__table">
        <thead>
          <tr>
            <th scope="col">Recurso</th>
            {matrixActions.map((action) => (
              <th scope="col" key={action.key}>{action.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {resources.map((resource) => (
            <tr key={resource.key}>
              <th scope="row">
                <div className="rbac-panel__resource-cell">
                  <span>{getResourceLabel(resource)}</span>
                  {!systemResourceKeys.has(resource.key) && (
                    <span className="rbac-panel__resource-controls">
                      {canUpdatePermissions && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => onEditResource(resource)}
                        >
                          Editar
                        </button>
                      )}
                      {canDeleteRoles && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => onDeleteResource(resource)}
                        >
                          Eliminar
                        </button>
                      )}
                    </span>
                  )}
                </div>
              </th>
              {matrixActions.map((action) => {
                if (!resource.actions.some((item) => item.key === action.key)) {
                  return <td key={action.key} aria-label="No disponible" />;
                }
                const hasManage = currentRole?.permissions.some(
                  (permission) =>
                    permission.resource === resource.key &&
                    permission.action === "manage",
                );
                const checked =
                  currentRole?.permissions.some(
                    (permission) =>
                      permission.resource === resource.key &&
                      permission.action === action.key,
                  ) || Boolean(hasManage);
                const isAdminRecoveryPermission =
                  currentRole?.name === ROLES.ADMIN &&
                  ((resource.key === "users" && action.key === "manage") ||
                    (resource.key === "shelters" && action.key === "verify") ||
                    (resource.key === "rolePermissions" && action.key === "manage"));
                return (
                  <td key={action.key}>
                    <input
                      type="checkbox"
                      aria-label={`${getResourceLabel(resource)}: ${action.label}`}
                      checked={Boolean(checked)}
                      disabled={
                        saving ||
                        !canUpdatePermissions ||
                        !canEditCurrentRole ||
                        (Boolean(isAdminRecoveryPermission) &&
                          !isPlatformSuperadmin)
                      }
                      onChange={() =>
                        onToggle(resource.key, action.key)
                      }
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
