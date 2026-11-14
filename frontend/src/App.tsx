import { Suspense, lazy, useState } from "react";
import { AuthProvider } from "./rbac/auth";
import { Landing } from "./landing/Landing";
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from "./landing/api";
import { ErrorBoundary } from "./ui/ErrorBoundary";

// El portal se descarga solo al iniciar sesión: quien visita la página
// pública no carga el código de gestión.
const Portal = lazy(() => import("./Portal"));

function AuthenticatedApp() {
  const [token, setToken] = useState(
    () => window.localStorage.getItem(ACCESS_TOKEN_KEY),
  );
  const logout = () => {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    setToken(null);
  };
  if (!token) return <Landing />;
  return (
    <AuthProvider
      key={token}
      getAccessToken={() => window.localStorage.getItem(ACCESS_TOKEN_KEY)}
    >
      <Suspense fallback={<p className="app-loading" role="status">Abriendo el portal…</p>}>
        <Portal onLogout={logout} />
      </Suspense>
    </AuthProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      {window.localStorage.getItem(ACCESS_TOKEN_KEY) ? <AuthenticatedApp /> : <Landing />}
    </ErrorBoundary>
  );
}
