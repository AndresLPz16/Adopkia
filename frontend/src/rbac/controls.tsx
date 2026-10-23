import { Navigate, Outlet } from "react-router-dom";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useAuth } from "./auth";
import { can } from "./permissions";
import type { Action, Resource } from "./types";

interface PermissionGateProps {
  resource: Resource;
  action: Action;
  children: ReactNode;
  fallback?: ReactNode;
  loadingFallback?: ReactNode;
  errorFallback?: ReactNode;
}

export function PermissionGate({
  resource,
  action,
  children,
  fallback = null,
  loadingFallback = null,
  errorFallback = <p role="alert">No se pudo verificar tu sesión.</p>,
}: PermissionGateProps) {
  const { status, user, permissions } = useAuth();
  if (status === "loading") return <>{loadingFallback}</>;
  if (status === "error") return <>{errorFallback}</>;
  if (
    status !== "authenticated" ||
    !can(user, resource, action, permissions ?? {})
  ) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
}

type PermissionButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "disabled"
> & {
  resource: Resource;
  permissionAction: Action;
  showDisabled?: boolean;
};

export function PermissionButton({
  resource,
  permissionAction,
  showDisabled = true,
  children,
  ...buttonProps
}: PermissionButtonProps) {
  const { status, user, permissions } = useAuth();
  const permitted =
    status === "authenticated" &&
    can(user, resource, permissionAction, permissions ?? {});

  if (status === "loading" || (!permitted && !showDisabled)) return null;

  return (
    <button {...buttonProps} disabled={!permitted}>
      {children}
    </button>
  );
}

type ProtectedRouteProps = (
  | { resource: Resource; action: Action }
  | { resource?: never; action?: never }
) & {
  loginPath?: string;
  loadingFallback?: ReactNode;
  deniedFallback?: ReactNode;
};

export function ProtectedRoute({
  resource,
  action,
  loginPath = "/login",
  loadingFallback = <p role="status">Cargando sesión…</p>,
  deniedFallback = <p role="alert">No tienes permiso para ver esta página.</p>,
}: ProtectedRouteProps) {
  const { status, user, permissions } = useAuth();

  if (status === "loading") return <>{loadingFallback}</>;
  if (status === "unauthenticated") {
    return <Navigate to={loginPath} replace />;
  }
  if (status === "error") {
    return <p role="alert">No se pudo verificar tu sesión. Inténtalo de nuevo.</p>;
  }
  if (
    resource &&
    action &&
    !can(user, resource, action, permissions ?? {})
  ) {
    return <>{deniedFallback}</>;
  }

  return <Outlet />;
}
