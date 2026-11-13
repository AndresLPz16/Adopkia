import type { AuthFlow } from "./useAuthFlow";

export function LandingHeader({
  showAuthentication,
}: {
  showAuthentication: AuthFlow["showAuthentication"];
}) {
  return (
    <header className="landing-header">
      <a className="landing-brand" href="/">
        <img className="app-header__logo" src="/logo-adopkia-mark.png" alt="" />
        <span>Adopkia</span>
      </a>
      <nav className="landing-header__nav" aria-label="Navegación principal">
        <a href="#mascotas">Mascotas</a>
        <a href="#como-funciona">Cómo funciona</a>
        <a href="#preguntas-frecuentes">Preguntas frecuentes</a>
      </nav>
      <nav className="landing-header__actions" aria-label="Acceso a tu cuenta">
        <button
          className="landing-header__login"
          onClick={() => showAuthentication("login")}
        >
          Iniciar sesión
        </button>
        <button className="portal-button" onClick={() => showAuthentication("register")}>
          Crear cuenta
        </button>
      </nav>
    </header>
  );
}
