import type { MutableRefObject } from "react";
import { ACTIONS, RESOURCES, ROLES } from "../../rbac/types";
import { DataCard, text } from "../shared";
import type { PermissionCheck, PortalDataRow, PortalSender } from "../shared";

export function RequestCard({
  item,
  pets,
  role,
  canDo,
  form,
  send,
  requestOpenerRef,
  setSelectedRequest,
  editingRequestId,
  startEditingRequest,
  stopEditingRequest,
}: {
  item: PortalDataRow;
  pets: PortalDataRow[];
  role: string;
  canDo: PermissionCheck;
  form: Record<string, string>;
  send: PortalSender;
  requestOpenerRef: MutableRefObject<HTMLButtonElement | null>;
  setSelectedRequest: (value: PortalDataRow | null) => void;
  editingRequestId: string;
  startEditingRequest: (item: PortalDataRow) => void;
  stopEditingRequest: () => void;
}) {
  const pet =
    (item.pet_details as PortalDataRow | undefined) ??
    pets.find((entry) => text(entry.id) === text(item.pet));
  const petName = text(pet?.name) || text(item.pet_name);
  const requestStatus = text(item.status_code || item.status)
    .trim()
    .toLocaleLowerCase();
  return (
    <DataCard
      key={text(item.id)}
      title={`${petName || "Mascota"} · ${text(item.applicant_name)}`}
      subtitle={`Solicitud #${text(item.id)} · ${text(item.requested_at).slice(0, 10)}`}
      status={text(item.status)}
      actions={
        <>
          <button
            className="portal-button portal-button--secondary"
            type="button"
            onClick={(event) => {
              requestOpenerRef.current = event.currentTarget;
              setSelectedRequest(item);
            }}
          >
            Ver solicitud completa
          </button>
          {role === ROLES.ADOPTER &&
            requestStatus === "pendiente" &&
            canDo(RESOURCES.ADOPTION_REQUESTS, ACTIONS.UPDATE) && (
              <div className="portal-inline-actions">
                <button
                  className="portal-button portal-button--secondary"
                  type="button"
                  onClick={() => startEditingRequest(item)}
                >
                  Editar solicitud
                </button>
                <button
                  className="portal-link portal-link--danger"
                  type="button"
                  onClick={async () => {
                    const wasCancelled = await send(
                      `/api/v1/adoption-requests/${text(item.id)}/cancel/`,
                      "POST",
                      {},
                      "Solicitud cancelada.",
                    );
                    if (
                      wasCancelled !== false &&
                      editingRequestId === text(item.id)
                    ) {
                      stopEditingRequest();
                    }
                  }}
                >
                  Cancelar solicitud
                </button>
              </div>
            )}
          {role === ROLES.SHELTER && requestStatus === "pendiente" && (
            <div className="portal-inline-actions">
              {canDo(RESOURCES.ADOPTION_REQUESTS, ACTIONS.APPROVE) && (
                <button
                  className="portal-button"
                  onClick={() =>
                    void send(
                      `/api/v1/adoption-requests/${text(item.id)}/approve/`,
                      "POST",
                      { message: form.decisionMessage ?? "" },
                      "Solicitud aprobada.",
                    )
                  }
                >
                  Aprobar
                </button>
              )}
              {canDo(RESOURCES.ADOPTION_REQUESTS, ACTIONS.REJECT) && (
                <button
                  className="portal-button portal-button--secondary"
                  onClick={() =>
                    void send(
                      `/api/v1/adoption-requests/${text(item.id)}/reject/`,
                      "POST",
                      { message: form.decisionMessage ?? "" },
                      "Solicitud rechazada.",
                    )
                  }
                >
                  Rechazar
                </button>
              )}
            </div>
          )}
        </>
      }
    />
  );
}
