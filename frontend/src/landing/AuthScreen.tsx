import type { AuthFlow } from "./useAuthFlow";

export function AuthScreen({ auth }: { auth: AuthFlow }) {
  const {
    view,
    setView,
    form,
    update,
    busy,
    error,
    setError,
    authNotice,
    verificationCode,
    setVerificationCode,
    mathChallenge,
    mathAnswer,
    setMathAnswer,
    showAuthentication,
    resendVerificationCode,
    submit,
  } = auth;

  return (
    <main className="landing landing--auth">
      <header className="landing-header">
        <a className="landing-brand" href="/">
          <img className="app-header__logo" src="/logo-adopkia-mark.png" alt="" />
          <span>Adopkia</span>
        </a>
        <button
          className="landing-auth-screen__back"
          type="button"
          onClick={() => {
            setError("");
            setView("catalog");
          }}
        >
          ← Volver a las mascotas
        </button>
      </header>
      <section className="landing-auth-screen">
        <form className="landing-auth" onSubmit={(event) => void submit(event)}>
          <p className="portal-eyebrow">
            {view === "login"
              ? "Bienvenido de vuelta"
              : view === "verify-email"
                ? "Un paso más"
                : "Únete a Adopkia"}
          </p>
          <h1>
            {view === "login"
              ? "Inicia sesión para continuar"
              : view === "verify-email"
                ? "Verifica tu correo"
                : "Crea tu cuenta para continuar"}
          </h1>
          <p className="landing-auth-screen__copy">
            {view === "login"
              ? "Accede para conocer a las mascotas que buscan un hogar."
              : view === "verify-email"
                ? `Escribe el código de seis dígitos que enviamos a ${form.email}.`
                : "Regístrate y da el primer paso para encontrar a tu nuevo compañero."}
          </p>
          {view === "register" && (
            <>
              <label className="portal-field"><span>Nombre completo</span><input value={form.name} onChange={(event) => update("name", event.target.value)} required /></label>
              <label className="portal-field"><span>Nombre de usuario</span><input autoComplete="username" value={form.username} onChange={(event) => update("username", event.target.value)} required minLength={3} maxLength={30} pattern="[A-Za-z0-9][A-Za-z0-9_.-]{2,29}" /></label>
              <label className="portal-field"><span>Teléfono (opcional)</span><input value={form.phone} onChange={(event) => update("phone", event.target.value)} /></label>
              <label className="portal-field"><span>Tipo de cuenta</span><select value={form.role} onChange={(event) => update("role", event.target.value)}><option value="adoptante">Adoptante</option><option value="refugio">Refugio</option></select></label>
            </>
          )}
          {view === "verify-email" ? (
            <label className="portal-field">
              <span>Código de verificación</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={verificationCode}
                onChange={(event) =>
                  setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                pattern="[0-9]{6}"
                maxLength={6}
                required
              />
            </label>
          ) : (
            <>
              <label className="portal-field">
                <span>{view === "login" ? "Correo o nombre de usuario" : "Correo electrónico"}</span>
                <input
                  type={view === "login" ? "text" : "email"}
                  autoComplete={view === "login" ? "username" : "email"}
                  value={form.email}
                  onChange={(event) => update("email", event.target.value)}
                  required
                />
              </label>
              <label className="portal-field">
                <span>Contraseña</span>
                <input
                  type="password"
                  autoComplete={view === "login" ? "current-password" : "new-password"}
                  value={form.password}
                  onChange={(event) => update("password", event.target.value)}
                  required
                  minLength={8}
                />
              </label>
            </>
          )}
          {view === "login" && (
            <div className="login-math-challenge" aria-live="polite">
              {mathChallenge ? (
                <>
                  <span>Resuelve para continuar</span>
                  <strong
                    className="login-math-challenge__question"
                    key={mathChallenge.challenge_id}
                  >
                    {mathChallenge.question}
                  </strong>
                  <label className="portal-field">
                    <span>Tu respuesta</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={mathAnswer}
                      onChange={(event) => setMathAnswer(event.target.value)}
                      required
                    />
                  </label>
                </>
              ) : (
                <span role="status">Cargando reto de seguridad…</span>
              )}
            </div>
          )}
          {authNotice && <p className="portal-alert portal-alert--success" role="status">{authNotice}</p>}
          {error && <p className="portal-alert portal-alert--error" role="alert">{error}</p>}
          <button className="portal-button" disabled={busy || (view === "login" && !mathChallenge)}>
            {busy
              ? "Un momento…"
              : view === "login"
                ? "Entrar"
                : view === "verify-email"
                  ? "Verificar correo"
                  : "Crear cuenta"}
          </button>
          {view === "verify-email" ? (
            <>
              <button className="portal-link" type="button" onClick={() => void resendVerificationCode()} disabled={busy}>
                Reenviar código
              </button>
              <button className="portal-link" type="button" onClick={() => showAuthentication("login")}>
                Volver al inicio de sesión
              </button>
            </>
          ) : (
            <button
              className="portal-link"
              type="button"
              onClick={() => showAuthentication(view === "login" ? "register" : "login")}
            >
              {view === "login" ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Inicia sesión"}
            </button>
          )}
          <small>Las cuentas de refugio tienen herramientas especializadas. Las cuentas de veterinario y administración deben ser habilitadas por el equipo de Adopkia.</small>
        </form>
      </section>
    </main>
  );
}
