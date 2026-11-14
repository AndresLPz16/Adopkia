import { useEffect, useMemo, useRef, useState } from "react";
import { AlarmClock, Bell, BellOff, Check, ClipboardList, Mail, PawPrint } from "lucide-react";
import { ACTIONS, RESOURCES } from "../rbac/types";
import { roleNames } from "./navigation";
import { labelStatus, text } from "./shared";
import type { PermissionCheck, PortalDataRow, PortalSender } from "./shared";

export function PortalHeader({
  role,
  user,
  notifications,
  canDo,
  send,
  onMarkAllRead,
  navTo,
  onLogout,
}: {
  role: string;
  user: { name: string };
  notifications: PortalDataRow[];
  canDo: PermissionCheck;
  send: PortalSender;
  onMarkAllRead: (ids: string[]) => Promise<void>;
  navTo: (key: string) => void;
  onLogout: () => void;
}) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  const unreadNotifications = useMemo(
    () => notifications.filter((item) => item.is_read !== true),
    [notifications],
  );
  const unreadNotificationsCount = unreadNotifications.length;

  useEffect(() => {
    if (!notificationsOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNotificationsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [notificationsOpen]);

  const markAllNotificationsAsRead = () =>
    onMarkAllRead(unreadNotifications.map((item) => text(item.id)));

  return (
    <header className="app-header">
      <button className="app-header__brand" type="button" onClick={() => navTo("dashboard")}>
        <img className="app-header__logo" src="/logo-adopkia-mark.png" alt="" />
        <span>Adopkia <small>{roleNames[role] ?? "Mi espacio"}</small></span>
      </button>
      <div className="app-header__actions">
        {canDo(RESOURCES.NOTIFICATIONS, ACTIONS.READ) && (
          <div className="app-header__notifications" ref={bellRef}>
            <button
              className={`app-header__bell ${unreadNotificationsCount > 0 ? "has-unread" : ""}`}
              type="button"
              aria-label={
                unreadNotificationsCount > 0
                  ? `Notificaciones: ${unreadNotificationsCount} sin leer`
                  : "Notificaciones"
              }
              aria-expanded={notificationsOpen}
              onClick={() => setNotificationsOpen((prev) => !prev)}
            >
              <span className="app-header__bell-icon" aria-hidden="true">
                <Bell size={20} />
              </span>
              {unreadNotificationsCount > 0 && (
                <span className="app-header__bell-badge" aria-hidden="true">
                  {unreadNotificationsCount > 99 ? "99+" : unreadNotificationsCount}
                </span>
              )}
            </button>

            {notificationsOpen && (
              <div
                className="app-header__notifications-popover"
                role="dialog"
                aria-label="Panel de notificaciones"
              >
                <div className="app-header__notifications-header">
                  <div>
                    <strong>Notificaciones</strong>
                    {unreadNotificationsCount > 0 && (
                      <span className="app-header__notifications-count">
                        {unreadNotificationsCount} nueva{unreadNotificationsCount === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                  {unreadNotificationsCount > 0 && (
                    <button
                      type="button"
                      className="app-header__notifications-mark-all"
                      onClick={() => void markAllNotificationsAsRead()}
                    >
                      Marcar todas leídas
                    </button>
                  )}
                </div>

                <div className="app-header__notifications-list">
                  {notifications.length === 0 ? (
                    <div className="app-header__notifications-empty">
                      <span aria-hidden="true">
                        <BellOff size={26} />
                      </span>
                      <p>No tienes notificaciones pendientes.</p>
                    </div>
                  ) : (
                    notifications.slice(0, 6).map((item) => (
                      <div
                        key={text(item.id)}
                        className={`app-header__notification-item ${item.is_read ? "is-read" : "is-unread"}`}
                      >
                        <span className="app-header__notification-icon" aria-hidden="true">
                          {item.notification_type === "mensaje" ? (
                            <Mail size={18} />
                          ) : item.notification_type === "solicitud" ? (
                            <ClipboardList size={18} />
                          ) : item.notification_type === "recordatorio" ? (
                            <AlarmClock size={18} />
                          ) : (
                            <PawPrint size={18} />
                          )}
                        </span>
                        <div className="app-header__notification-body">
                          <p className="app-header__notification-message">{text(item.message)}</p>
                          <div className="app-header__notification-meta">
                            <small>{labelStatus(item.notification_type)}</small>
                            {Boolean(item.sent_at) && <small>{text(item.sent_at)}</small>}
                          </div>
                        </div>
                        {!item.is_read && (
                          <button
                            type="button"
                            className="app-header__notification-action"
                            title="Marcar como leída"
                            aria-label={`Marcar como leída: ${text(item.message)}`}
                            onClick={() =>
                              void send(
                                `/api/v1/notifications/${text(item.id)}/`,
                                "PATCH",
                                { is_read: true },
                                "Notificación leída.",
                              )
                            }
                          >
                            <Check size={16} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>

                <div className="app-header__notifications-footer">
                  <button
                    type="button"
                    className="portal-button portal-button--secondary"
                    onClick={() => {
                      setNotificationsOpen(false);
                      navTo("notifications");
                    }}
                  >
                    Ver todas las notificaciones
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="app-header__account">
          <div><strong>{user.name}</strong><span>{roleNames[role] ?? role}</span></div>
          <button type="button" onClick={onLogout}>Cerrar sesión</button>
        </div>
      </div>
    </header>
  );
}
