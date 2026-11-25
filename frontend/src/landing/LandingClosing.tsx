import type { AuthFlow } from "./useAuthFlow";

// Llamado final y pie de página.
export function LandingClosing({
  showAuthentication,
}: {
  showAuthentication: AuthFlow["showAuthentication"];
}) {
  return (
    <>
      <section className="landing-cta" aria-labelledby="landing-cta-title">
        <div className="landing-cta__glow" aria-hidden="true" />
        <h2 id="landing-cta-title">Cada huella merece un hogar.</h2>
        <p>Crea tu cuenta en un par de minutos y envía tu primera solicitud.</p>
        <div className="landing-cta__actions">
          <button type="button" className="landing-cta__primary" onClick={() => showAuthentication("register")}>
            Crear cuenta
          </button>
          <a className="landing-cta__secondary" href="#mascotas">
            Ver mascotas
          </a>
        </div>
      </section>
      <footer className="landing-footer">
        <div className="landing-footer__top">
          <div className="landing-footer__brand">
            <a className="landing-brand" href="/">
              <img className="app-header__logo" src="/logo-adopkia-mark.png" alt="" />
              <span>Adopkia</span>
            </a>
            <p>Adopción responsable con refugios verificados.</p>
          </div>
          <nav className="landing-footer__links" aria-label="Enlaces del pie de página">
            <a href="#mascotas">Mascotas</a>
            <a href="#como-funciona">Cómo funciona</a>
            <a href="#preguntas-frecuentes">Preguntas frecuentes</a>
            <button type="button" onClick={() => showAuthentication("login")}>
              Entrar a mi cuenta
            </button>
          </nav>
        </div>
        <p className="landing-footer__legal">© {new Date().getFullYear()} Adopkia. Hecho en Riohacha, Colombia.</p>
      </footer>
    </>
  );
}
