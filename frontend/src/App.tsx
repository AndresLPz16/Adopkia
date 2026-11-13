import { useState } from "react";
import { AuthProvider } from "./rbac/auth";
import Portal from "./Portal";
import { Landing } from "./landing/Landing";
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from "./landing/api";


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
      <Portal onLogout={logout} />
    </AuthProvider>
  );
}

export default function App() {
  return window.localStorage.getItem(ACCESS_TOKEN_KEY) ? (
    <AuthenticatedApp />
  ) : (
    <Landing />
  );
}
