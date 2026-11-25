import { Suspense, lazy, useEffect, useState } from "react";
import { AuthProvider } from "./rbac/auth";
import { Landing } from "./landing/Landing";
import { ErrorBoundary } from "./ui/ErrorBoundary";
import {
  endSession,
  forgetLegacyTokens,
  getAccessToken,
  hasSessionHint,
  renewAccessToken,
} from "./session";

// El portal se descarga solo al iniciar sesión: quien visita la página
// pública no carga el código de gestión.
const Portal = lazy(() => import("./Portal"));

type SessionPhase = "checking" | "signed-in" | "signed-out";

const loadingPortal = <p className="app-loading" role="status">Abriendo el portal…</p>;

export default function App() {
  const [phase, setPhase] = useState<SessionPhase>(() => {
    forgetLegacyTokens();
    if (getAccessToken()) return "signed-in";
    return hasSessionHint() ? "checking" : "signed-out";
  });

  // Al recargar la página el token en memoria se pierde: se recupera con la
  // cookie de renovación, si la sesión sigue vigente.
  useEffect(() => {
    if (phase !== "checking") return;
    let active = true;
    void renewAccessToken().then((token) => {
      if (active) setPhase(token ? "signed-in" : "signed-out");
    });
    return () => {
      active = false;
    };
  }, [phase]);

  const logout = () => {
    void endSession();
    setPhase("signed-out");
  };

  return (
    <ErrorBoundary>
      {phase === "checking" && loadingPortal}
      {phase === "signed-out" && <Landing />}
      {phase === "signed-in" && (
        <AuthProvider getAccessToken={getAccessToken}>
          <Suspense fallback={loadingPortal}>
            <Portal onLogout={logout} />
          </Suspense>
        </AuthProvider>
      )}
    </ErrorBoundary>
  );
}
