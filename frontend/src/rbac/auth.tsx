import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import type {
  AuthStatus,
  AuthUser,
  BackendUserProfile,
  PermissionCatalog,
} from "./types";
import type { PermissionMap, RolePermissions } from "./permissions";
import type { Action } from "./types";
import { ACTIONS } from "./types";

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  error: Error | null;
  permissions: PermissionMap | null;
  request: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  refresh: () => Promise<void>;
}

interface AuthProviderProps {
  children: ReactNode;
  getAccessToken: () => string | null;
  profileUrl?: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toAuthUser(profile: BackendUserProfile): AuthUser {
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    roles: [profile.role],
    active: profile.active,
  };
}

export function AuthProvider({
  children,
  getAccessToken,
  profileUrl = "/api/v1/auth/me/",
}: AuthProviderProps) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [permissions, setPermissions] = useState<PermissionMap | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const request = useCallback(
    async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const token = getAccessToken();
      if (!token) throw new Error("No hay una sesión autenticada.");
      const headers = new Headers(init.headers);
      headers.set("Authorization", `Bearer ${token}`);
      return fetch(input, { ...init, headers });
    },
    [getAccessToken],
  );

  const refresh = useCallback(async () => {
    setReloadKey((key) => key + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadUser() {
      setStatus("loading");
      setUser(null);
      setError(null);
      setPermissions(null);

      try {
        const token = getAccessToken();
        if (!token) {
          setStatus("unauthenticated");
          return;
        }

        const response = await request(profileUrl, {
          signal: controller.signal,
        });

        if (response.status === 401 || response.status === 403) {
          setStatus("unauthenticated");
          return;
        }
        if (!response.ok) {
          throw new Error(`No se pudo cargar el perfil (${response.status}).`);
        }

        const profile = (await response.json()) as BackendUserProfile;
        if (
          !profile ||
          (typeof profile.id !== "number" &&
            typeof profile.id !== "string") ||
          typeof profile.name !== "string" ||
          typeof profile.email !== "string" ||
          typeof profile.role !== "string" ||
          (profile.active !== undefined && typeof profile.active !== "boolean")
        ) {
          throw new Error("La respuesta del perfil tiene un formato inválido.");
        }

        if (profile.active === false) {
          setStatus("unauthenticated");
          return;
        }

        const permissionResponse = await request(
          "/api/v1/auth/permissions/",
          { signal: controller.signal },
        );
        if (permissionResponse.status === 401) {
          setStatus("unauthenticated");
          return;
        }
        if (!permissionResponse.ok) {
          throw new Error(
            `No se pudieron cargar los permisos (${permissionResponse.status}).`,
          );
        }
        const catalog =
          (await permissionResponse.json()) as PermissionCatalog;
        if (!catalog || !Array.isArray(catalog.roles)) {
          throw new Error("La respuesta de permisos tiene un formato inválido.");
        }
        const permissionMap: Record<string, RolePermissions> = {};
        const isAction = (value: string): value is Action =>
          Object.values(ACTIONS).some((action) => action === value);
        for (const role of catalog.roles) {
          if (
            !role ||
            typeof role.name !== "string" ||
            !Array.isArray(role.permissions)
          ) {
            throw new Error("La respuesta de permisos tiene un formato inválido.");
          }
          const rolePermissions: Record<string, Action[]> = {};
          for (const permission of role.permissions) {
            if (
              typeof permission.resource !== "string" ||
              typeof permission.action !== "string" ||
              !isAction(permission.action)
            ) {
              throw new Error("La respuesta de permisos tiene un formato inválido.");
            }
            const actions = rolePermissions[permission.resource] ?? [];
            actions.push(permission.action);
            rolePermissions[permission.resource] = actions;
          }
          permissionMap[role.name] = rolePermissions;
        }

        setUser(toAuthUser(profile));
        setPermissions(permissionMap);
        setStatus("authenticated");
      } catch (caught) {
        if (controller.signal.aborted) return;
        const loadError =
          caught instanceof Error
            ? caught
            : new Error("No se pudo cargar el usuario autenticado.");
        setError(loadError);
        setStatus("error");
      }
    }

    void loadUser();
    return () => controller.abort();
  }, [getAccessToken, profileUrl, reloadKey, request]);

  const value = useMemo(
    () => ({ status, user, error, permissions, request, refresh }),
    [status, user, error, permissions, request, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe usarse dentro de AuthProvider.");
  }
  return context;
}
