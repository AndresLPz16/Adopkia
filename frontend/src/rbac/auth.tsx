import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
const ACCESS_TOKEN_KEY = "adopkia_access";
const REFRESH_TOKEN_KEY = "adopkia_refresh";

function toAuthUser(profile: BackendUserProfile): AuthUser {
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    roles: [profile.role],
    active: profile.active,
    isPlatformSuperadmin: profile.is_platform_superadmin,
  };
}

function toPermissionMap(catalog: PermissionCatalog): PermissionMap {
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
  return permissionMap;
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
  const refreshPromise = useRef<Promise<string | null> | null>(null);

  const request = useCallback(
    async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const makeRequest = (token: string | null) => {
        if (!token) throw new Error("No hay una sesión autenticada.");
        const headers = new Headers(init.headers);
        headers.set("Authorization", `Bearer ${token}`);
        return fetch(input, { ...init, headers });
      };

      const token = getAccessToken();
      if (!token) throw new Error("No hay una sesión autenticada.");

      const response = await makeRequest(token);
      if (response.status !== 401 || String(input).includes("/auth/refresh/")) {
        return response;
      }

      if (!refreshPromise.current) {
        refreshPromise.current = (async () => {
          const refreshToken = window.localStorage.getItem(REFRESH_TOKEN_KEY);
          if (!refreshToken) return null;

          const refreshResponse = await fetch("/api/v1/auth/refresh/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh: refreshToken }),
          });
          if (!refreshResponse.ok) {
            window.localStorage.removeItem(ACCESS_TOKEN_KEY);
            window.localStorage.removeItem(REFRESH_TOKEN_KEY);
            return null;
          }
          const refreshed = (await refreshResponse.json()) as { access?: unknown };
          if (typeof refreshed.access !== "string") {
            window.localStorage.removeItem(ACCESS_TOKEN_KEY);
            window.localStorage.removeItem(REFRESH_TOKEN_KEY);
            throw new Error("La respuesta de renovación no contiene un token válido.");
          }
          window.localStorage.setItem(ACCESS_TOKEN_KEY, refreshed.access);
          return refreshed.access;
        })().finally(() => {
          refreshPromise.current = null;
        });
      }

      const refreshedToken = await refreshPromise.current;
      return refreshedToken ? makeRequest(refreshedToken) : response;
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
          (profile.is_platform_superadmin !== undefined &&
            typeof profile.is_platform_superadmin !== "boolean") ||
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
        const permissionMap = toPermissionMap(catalog);

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

  useEffect(() => {
    if (status !== "authenticated") return;
    let active = true;
    let syncing = false;

    const syncPermissions = async () => {
      if (syncing) return;
      syncing = true;
      const controller = new AbortController();
      try {
        const response = await request("/api/v1/auth/permissions/", {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(
            `No se pudieron actualizar los permisos (${response.status}).`,
          );
        }
        const catalog = (await response.json()) as PermissionCatalog;
        const permissionMap = toPermissionMap(catalog);
        if (active) {
          setPermissions(permissionMap);
          setError(null);
        }
      } catch (caught) {
        if (!active || controller.signal.aborted) return;
        setError(
          caught instanceof Error
            ? caught
            : new Error("No se pudieron actualizar los permisos."),
        );
        setStatus("error");
      } finally {
        syncing = false;
      }
    };

    const syncWhenVisible = () => {
      if (document.visibilityState === "visible") void syncPermissions();
    };
    window.addEventListener("focus", syncWhenVisible);
    document.addEventListener("visibilitychange", syncWhenVisible);
    return () => {
      active = false;
      window.removeEventListener("focus", syncWhenVisible);
      document.removeEventListener("visibilitychange", syncWhenVisible);
    };
  }, [request, status]);

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
