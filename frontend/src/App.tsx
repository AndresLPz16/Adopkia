import { useCallback, useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import type { FormEvent } from "react";
import { AuthProvider, ProtectedRoute, RolePermissionsPanel } from "./rbac";
import { useAuth } from "./rbac/auth";
import { ACTIONS, RESOURCES } from "./rbac/types";
import { can } from "./rbac/permissions";

const ACCESS_TOKEN_KEY = "adopkia_access";

interface LoginResponse {
  access: string;
}

function LoginForm({ onLogin }: { onLogin: (token: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/auth/login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = (await response.json()) as
        | LoginResponse
        | { detail?: string };
      if (!response.ok || !("access" in result)) {
        throw new Error(
          "detail" in result && result.detail
            ? result.detail
            : "No se pudo iniciar sesión.",
        );
      }
      window.localStorage.setItem(ACCESS_TOKEN_KEY, result.access);
      onLogin(result.access);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo iniciar sesión. Inténtalo de nuevo.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login">
      <div className="login__card">
        <span className="login__brand">ADOPKIA</span>
        <p className="login__eyebrow">Administración segura</p>
        <h1>Iniciar sesión</h1>
        <p className="login__copy">
          Usa una cuenta con rol administrador para gestionar la matriz de
          permisos.
        </p>
        <form onSubmit={(event) => void submit(event)}>
          <label>
            Correo electrónico
            <input
              autoComplete="username"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            Contraseña
            <input
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {error && <p className="login__error" role="alert">{error}</p>}
          <button type="submit" disabled={submitting}>
            {submitting ? "Validando…" : "Entrar al panel"}
          </button>
        </form>
      </div>
    </main>
  );
}

function AdminRoutes({ onLogout }: { onLogout: () => void }) {
  const { user, status, permissions } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (status === "unauthenticated") onLogout();
  }, [status, onLogout]);

  if (status === "loading") {
    return <p className="app-loading" role="status">Verificando sesión…</p>;
  }
  if (status === "error") {
    return (
      <main className="login">
        <p role="alert">No se pudo verificar la sesión. Inicia sesión de nuevo.</p>
        <button type="button" onClick={onLogout}>Volver al inicio de sesión</button>
      </main>
    );
  }
  if (status !== "authenticated") {
    return null;
  }

  const canManagePermissions = can(
    user,
    RESOURCES.USERS,
    ACTIONS.MANAGE,
    permissions ?? {},
  );

  return (
    <div className="app-shell">
      <header className="app-header">
        <button
          className="app-header__brand"
          type="button"
          onClick={() => navigate("/admin/permissions")}
        >
          <span className="app-header__mark">A</span>
          <span>Adopkia <small>Administración</small></span>
        </button>
        <div className="app-header__account">
          <div>
            <strong>{user?.name}</strong>
            <span>{user?.roles[0]}</span>
          </div>
          <button type="button" onClick={onLogout}>Cerrar sesión</button>
        </div>
      </header>
      <div className="app-layout">
        <aside className="app-sidebar">
          <p>GESTIÓN</p>
          <button
            className="app-sidebar__link app-sidebar__link--active"
            type="button"
            disabled={!canManagePermissions}
            onClick={() => navigate("/admin/permissions")}
          >
            <span aria-hidden="true">▦</span>
            Permisos por rol
          </button>
          <div className="app-sidebar__note">
            <strong>Acceso por roles</strong>
            <span>Configura las acciones visibles para cada perfil.</span>
          </div>
        </aside>
        <section className="app-content">
          <Routes>
            <Route
              element={
                <ProtectedRoute
                  resource={RESOURCES.USERS}
                  action={ACTIONS.MANAGE}
                />
              }
            >
              <Route
                path="/admin/permissions"
                element={<RolePermissionsPanel />}
              />
            </Route>
            <Route
              path="*"
              element={<Navigate to="/admin/permissions" replace />}
            />
          </Routes>
        </section>
      </div>
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState(
    () => window.localStorage.getItem(ACCESS_TOKEN_KEY),
  );

  const logout = useCallback(() => {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    setToken(null);
  }, []);

  if (!token) {
    return <LoginForm onLogin={setToken} />;
  }

  return (
    <AuthProvider
      key={token}
      getAccessToken={() => window.localStorage.getItem(ACCESS_TOKEN_KEY)}
    >
      <AdminRoutes onLogout={logout} />
    </AuthProvider>
  );
}
