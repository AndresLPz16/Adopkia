import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { AuthProvider } from "./rbac/auth";
import Portal from "./Portal";
import { loadPublicPets } from "./publicCatalog";
import type { PublicPetPreview } from "./publicCatalog";
import { apiErrorMessage } from "./portal/shared";

const ACCESS_TOKEN_KEY = "adopkia_access";
const REFRESH_TOKEN_KEY = "adopkia_refresh";

type AuthResponse = { access: string; refresh?: string; detail?: string };
type LoginMathChallenge = { challenge_id: string; question: string };
async function readJson(response: Response): Promise<unknown> {
  const body = await response.text();
  let data: unknown = null;
  if (body) {
    try {
      data = JSON.parse(body);
    } catch {
      data = body;
    }
  }
  if (!response.ok) {
    throw new Error(apiErrorMessage(data, response.status));
  }
  return data;
}

function Landing() {
  const [view, setView] = useState<
    "catalog" | "login" | "register" | "verify-email"
  >("catalog");
  const [pets, setPets] = useState<PublicPetPreview[]>([]);
  const [petsLoading, setPetsLoading] = useState(true);
  const [petsError, setPetsError] = useState("");
  const [petSearch, setPetSearch] = useState("");
  const [speciesFilter, setSpeciesFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [carouselPage, setCarouselPage] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  const [selectedPet, setSelectedPet] = useState<PublicPetPreview | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [likedPetIds, setLikedPetIds] = useState<Set<number>>(() => new Set());
  const photoOpenerRef = useRef<HTMLButtonElement | null>(null);
  const dialogCloseRef = useRef<HTMLButtonElement | null>(null);
  const [form, setForm] = useState({
    email: "",
    username: "",
    password: "",
    name: "",
    phone: "",
    role: "adoptante",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [mathChallenge, setMathChallenge] = useState<LoginMathChallenge | null>(null);
  const [mathAnswer, setMathAnswer] = useState("");
  const [challengeRefresh, setChallengeRefresh] = useState(0);
  const [challengeError, setChallengeError] = useState("");

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    void loadPublicPets(fetch, controller.signal)
      .then((catalog) => {
        if (active) {
          setPets(catalog);
          setPetsLoading(false);
        }
      })
      .catch((caught: unknown) => {
        if (active && !controller.signal.aborted) {
          setPetsError(
            caught instanceof Error
              ? caught.message
              : "No se pudieron cargar las mascotas.",
          );
          setPetsLoading(false);
        }
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const update = (name: string, value: string) =>
    setForm((current) => ({ ...current, [name]: value }));
  const speciesOptions = [...new Set(pets.map((pet) => pet.species).filter(Boolean))].sort();
  const cityOptions = [...new Set(pets.map((pet) => pet.city).filter(Boolean))].sort();
  const visiblePets = pets
    .filter((pet) => {
      const search = petSearch.trim().toLocaleLowerCase();
      const matchesSearch = !search ||
        [pet.name, pet.species, pet.city, pet.temperament]
          .join(" ")
          .toLocaleLowerCase()
          .includes(search);
      return (
        matchesSearch &&
        (!speciesFilter || pet.species === speciesFilter) &&
        (!cityFilter || pet.city === cityFilter)
      );
    });
  const petPages = Array.from(
    { length: Math.ceil(visiblePets.length / 6) },
    (_, page) => visiblePets.slice(page * 6, page * 6 + 6),
  );
  const featuredPet = pets[0];

  useEffect(() => {
    setCarouselPage(0);
    const carousel = carouselRef.current;
    if (carousel) {
      if (typeof carousel.scrollTo === "function") {
        carousel.scrollTo({ left: 0 });
      } else {
        carousel.scrollLeft = 0;
      }
    }
  }, [petSearch, speciesFilter, cityFilter]);

  useEffect(() => {
    if (!selectedPet) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogCloseRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedPet(null);
    };
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
      photoOpenerRef.current?.focus();
    };
  }, [selectedPet]);

  const showAuthentication = (nextView: "login" | "register") => {
    setError("");
    setAuthNotice("");
    setChallengeError("");
    setView(nextView);
  };

  useEffect(() => {
    if (view !== "login") {
      setMathChallenge(null);
      setMathAnswer("");
      setChallengeError("");
      return;
    }

    const controller = new AbortController();
    setMathChallenge(null);
    setMathAnswer("");
    setChallengeError("");
    void (async () => {
      try {
        const data = await readJson(
          await fetch("/api/v1/auth/login-challenge/", {
            signal: controller.signal,
          }),
        );
        if (
          !data ||
          typeof data !== "object" ||
          !("challenge_id" in data) ||
          typeof data.challenge_id !== "string" ||
          !("question" in data) ||
          typeof data.question !== "string"
        ) {
          throw new Error("No se pudo cargar el reto de seguridad.");
        }
        setMathChallenge({
          challenge_id: data.challenge_id,
          question: data.question,
        });
      } catch (caught) {
        if (!controller.signal.aborted) {
          setChallengeError(
            caught instanceof Error
              ? caught.message
              : "No se pudo cargar el reto de seguridad.",
          );
        }
      }
    })();

    return () => controller.abort();
  }, [view, challengeRefresh]);

  async function resendVerificationCode() {
    setBusy(true);
    setError("");
    setAuthNotice("");
    try {
      const response = await readJson(
        await fetch("/api/v1/auth/resend-email-verification/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: form.email }),
        }),
      );
      setAuthNotice(
        response && typeof response === "object" && "detail" in response &&
          typeof response.detail === "string"
          ? response.detail
          : "Si la cuenta necesita verificación, recibirás un código por correo.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo solicitar otro código.",
      );
    } finally {
      setBusy(false);
    }
  }

  const togglePetLike = (petId: number) => {
    setLikedPetIds((current) => {
      const next = new Set(current);
      if (next.has(petId)) next.delete(petId);
      else next.add(petId);
      return next;
    });
  };

  const selectedPetPhotos = selectedPet?.photos.slice(0, 10) ?? [];

  const changePetPhoto = (direction: -1 | 1) => {
    if (selectedPetPhotos.length < 2) return;
    setSelectedPhotoIndex((current) =>
      (current + direction + selectedPetPhotos.length) %
      selectedPetPhotos.length,
    );
  };

  const scrollCarousel = (direction: -1 | 1) => {
    const nextPage = Math.max(
      0,
      Math.min(petPages.length - 1, carouselPage + direction),
    );
    const carousel = carouselRef.current;
    if (carousel) {
      const left = nextPage * carousel.clientWidth;
      if (typeof carousel.scrollTo === "function") {
        carousel.scrollTo({ left, behavior: "smooth" });
      } else {
        carousel.scrollLeft = left;
      }
    }
    setCarouselPage(nextPage);
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setAuthNotice("");
    try {
      if (view === "register") {
        await readJson(
          await fetch("/api/v1/auth/register/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: form.email,
              username: form.username,
              password: form.password,
              name: form.name,
              phone: form.phone || null,
              role: form.role,
            }),
          }),
        );
        setVerificationCode("");
        setAuthNotice(
          "Enviamos un código a tu correo. Ingresa los seis dígitos para verificar tu cuenta.",
        );
        setView("verify-email");
        return;
      }

      if (view === "verify-email") {
        await readJson(
          await fetch("/api/v1/auth/verify-email/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: form.email,
              code: verificationCode,
            }),
          }),
        );
        setForm((current) => ({ ...current, password: "" }));
        setAuthNotice("Correo verificado. Ya puedes iniciar sesión.");
        setView("login");
        return;
      }

      if (!mathChallenge) {
        throw new Error("Espera a que cargue el reto matemático.");
      }
      const login = (await readJson(
        await fetch("/api/v1/auth/login/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            identifier: form.email,
            password: form.password,
            challenge_id: mathChallenge.challenge_id,
            challenge_answer: mathAnswer,
          }),
        }),
      )) as AuthResponse;
      if (!login || typeof login.access !== "string") {
        throw new Error("El servidor no devolvió un token de acceso válido.");
      }
      window.localStorage.setItem(ACCESS_TOKEN_KEY, login.access);
      if (typeof login.refresh === "string") {
        window.localStorage.setItem(REFRESH_TOKEN_KEY, login.refresh);
      }
      window.location.assign("/app/dashboard");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo completar la solicitud. Inténtalo de nuevo.",
      );
      if (view === "login") {
        setChallengeRefresh((current) => current + 1);
      }
    } finally {
      setBusy(false);
    }
  }

  if (view !== "catalog") {
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
                  challengeError ? (
                    <div>
                      <p role="alert">{challengeError}</p>
                      <button
                        className="portal-link"
                        type="button"
                        onClick={() => setChallengeRefresh((current) => current + 1)}
                      >
                        Reintentar
                      </button>
                    </div>
                  ) : (
                    <span role="status">Cargando reto de seguridad…</span>
                  )
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

  return (
    <main className="landing">
      <header className="landing-header">
        <a className="landing-brand" href="/">
          <img className="app-header__logo" src="/logo-adopkia-mark.png" alt="" />
          <span>Adopkia</span>
        </a>
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
      <section className="landing-hero">
        <div className="landing-hero__copy">
          <p className="landing-eyebrow"><span aria-hidden="true">♥</span> Adopción responsable</p>
          <h1>Tu próxima gran amistad <em>te está esperando.</em></h1>
          <p>
            Conoce mascotas de refugios verificados y encuentra esa conexión que
            cambia dos vidas para siempre.
          </p>
          <div className="landing-search">
            <span className="landing-search__icon" aria-hidden="true">⌕</span>
            <input
              aria-label="Buscar mascotas por nombre, especie, ciudad o personalidad"
              placeholder="¿A quién estás buscando?"
              value={petSearch}
              onChange={(event) => setPetSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  document.getElementById("mascotas")?.scrollIntoView({ behavior: "smooth" });
                }
              }}
            />
            <button
              type="button"
              onClick={() => document.getElementById("mascotas")?.scrollIntoView({ behavior: "smooth" })}
            >
              Buscar
            </button>
          </div>
          <div className="landing-hero__trust">
            <span><strong>♡</strong> Adopciones con acompañamiento</span>
            <span><strong>✓</strong> Refugios verificados</span>
          </div>
        </div>
        <div className="landing-hero__art" aria-hidden="true">
          <div className="landing-hero__blob" />
          <div className="landing-hero__photo">
            {featuredPet?.photos?.[0]?.url ? (
              <img src={featuredPet.photos.find((item) => item.is_primary)?.url ?? featuredPet.photos[0].url} alt="" />
            ) : (
              <span>🐾</span>
            )}
          </div>
          <div className="landing-hero__note">
            <span className="landing-hero__note-icon" aria-hidden="true">♡</span>
            <span><strong>Una nueva historia</strong><small>empieza contigo</small></span>
          </div>
          <span className="landing-hero__spark landing-hero__spark--one">✦</span>
          <span className="landing-hero__spark landing-hero__spark--two">✳</span>
        </div>
      </section>
      <section className="landing-benefits" aria-label="Beneficios de Adopkia">
        <div><span aria-hidden="true">⌂</span><p><strong>Refugios verificados</strong><small>Conoce organizaciones confiables</small></p></div>
        <div><span aria-hidden="true">♡</span><p><strong>Adopción responsable</strong><small>Acompañamiento en cada paso</small></p></div>
        <div><span aria-hidden="true">✚</span><p><strong>Bienestar primero</strong><small>Seguimiento para una vida feliz</small></p></div>
      </section>
      <section className="landing-pets" id="mascotas">
        <div className="landing-pets__heading">
          <div>
            <p className="landing-eyebrow"><span aria-hidden="true">♥</span> Encuentra a tu compañero</p>
            <h2>Conoce a quienes buscan hogar</h2>
            <p>Cada perfil es una oportunidad para empezar una historia juntos.</p>
          </div>
          {!petsLoading && !petsError && <span className="landing-pets__count">{visiblePets.length} {visiblePets.length === 1 ? "mascota" : "mascotas"} disponibles</span>}
          {petPages.length > 1 && (
            <div className="landing-carousel__controls" aria-label="Controles del carrusel de mascotas">
              <button
                type="button"
                aria-label="Mostrar mascotas anteriores"
                onClick={() => scrollCarousel(-1)}
                disabled={carouselPage === 0}
              >
                ←
              </button>
              <span aria-live="polite">{carouselPage + 1} / {petPages.length}</span>
              <button
                type="button"
                aria-label="Mostrar más mascotas"
                onClick={() => scrollCarousel(1)}
                disabled={carouselPage === petPages.length - 1}
              >
                →
              </button>
            </div>
          )}
        </div>
        {petsError && <p className="portal-alert portal-alert--error">{petsError}</p>}
        <div className="landing-filters">
          <label className="landing-filter landing-filter--search">
            <span aria-hidden="true">⌕</span>
            <input
              aria-label="Filtrar mascotas"
              placeholder="Nombre, ciudad o personalidad"
              value={petSearch}
              onChange={(event) => setPetSearch(event.target.value)}
            />
          </label>
          <label className="landing-filter">
            <span className="landing-filter__label">Especie</span>
            <select aria-label="Filtrar por especie" value={speciesFilter} onChange={(event) => setSpeciesFilter(event.target.value)}>
              <option value="">Todas</option>
              {speciesOptions.map((species) => <option key={species} value={species}>{species}</option>)}
            </select>
          </label>
          <label className="landing-filter">
            <span className="landing-filter__label">Ciudad</span>
            <select aria-label="Filtrar por ciudad" value={cityFilter} onChange={(event) => setCityFilter(event.target.value)}>
              <option value="">Todas</option>
              {cityOptions.map((city) => <option key={city} value={city}>{city}</option>)}
            </select>
          </label>
          {(petSearch || speciesFilter || cityFilter) && (
            <button className="landing-filters__clear" onClick={() => {
              setPetSearch("");
              setSpeciesFilter("");
              setCityFilter("");
            }}>
              Limpiar filtros
            </button>
          )}
        </div>
        <div
          className="landing-carousel__viewport"
          ref={carouselRef}
          aria-label="Mascotas disponibles"
          onScroll={(event) => {
            const pageWidth = event.currentTarget.clientWidth;
            if (pageWidth > 0) {
              setCarouselPage(Math.round(event.currentTarget.scrollLeft / pageWidth));
            }
          }}
        >
          <div className="landing-carousel__track">
          {petPages.map((page, pageIndex) => (
            <div className="landing-carousel__page" key={pageIndex}>
              {page.map((pet) => {
                const photo =
                  pet.photos?.find((item) => item.is_primary) ?? pet.photos?.[0];
                return (
                  <article className="portal-card landing-pet" key={pet.id}>
                    <div className="landing-pet__media">
                      <button
                        className="landing-pet__photo-open"
                        type="button"
                        aria-label={`Ver detalles de ${pet.name}`}
                        onClick={(event) => {
                          photoOpenerRef.current = event.currentTarget;
                          const primaryPhotoIndex = pet.photos.findIndex(
                            (item) => item.is_primary,
                          );
                          setSelectedPhotoIndex(Math.max(0, primaryPhotoIndex));
                          setSelectedPet(pet);
                        }}
                      >
                        {photo?.url ? (
                          <img src={photo.url} alt="" loading="lazy" />
                        ) : (
                          <span className="landing-pet__placeholder" aria-hidden="true">🐾</span>
                        )}
                      </button>
                      <span className="landing-pet__badge"><span aria-hidden="true">♥</span> Busca familia</span>
                    </div>
                    <div className="landing-pet__content">
                      <div className="landing-pet__title">
                        <div><h3>{pet.name}</h3><span>{pet.species}</span></div>
                        <button
                          className={`landing-pet__heart ${likedPetIds.has(pet.id) ? "landing-pet__heart--liked" : ""}`}
                          type="button"
                          aria-label={likedPetIds.has(pet.id) ? `Quitar de favoritos a ${pet.name}` : `Dar like a ${pet.name}`}
                          aria-pressed={likedPetIds.has(pet.id)}
                          onClick={() => togglePetLike(pet.id)}
                        >
                          {likedPetIds.has(pet.id) ? "♥" : "♡"}
                        </button>
                      </div>
                      <p className="landing-pet__details">
                        <span aria-hidden="true">⌖</span> {pet.city || "Ubicación por confirmar"}
                        {pet.age != null && <><span className="landing-pet__dot">·</span>{pet.age} {pet.age === 1 ? "año" : "años"}</>}
                      </p>
                      {pet.temperament && <p className="landing-pet__temperament">{pet.temperament}</p>}
                      <button className="landing-pet__action" onClick={() => showAuthentication("login")}>
                        Quiero adoptar <span aria-hidden="true">→</span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ))}
          </div>
          {!petsLoading && visiblePets.length === 0 && !petsError && (
            <div className="landing-pets__empty">
              <span aria-hidden="true">♡</span>
              <strong>{pets.length ? "No encontramos coincidencias" : "Pronto habrá nuevos perfiles"}</strong>
              <p>{pets.length ? "Prueba con otros filtros para encontrar a tu compañero." : "Estamos preparando nuevas historias para que encuentres a tu mejor amigo."}</p>
              {(petSearch || speciesFilter || cityFilter) && <button className="portal-link" onClick={() => {
                setPetSearch("");
                setSpeciesFilter("");
                setCityFilter("");
              }}>Ver todas las mascotas</button>}
            </div>
          )}
          {petsLoading && (
            <div className="landing-pets__empty" role="status">
              <span aria-hidden="true">♡</span><strong>Buscando mascotas disponibles…</strong>
            </div>
          )}
        </div>
      </section>
      {selectedPet && (
        <div
          className="landing-pet-dialog__backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedPet(null);
          }}
        >
          <section
            className="landing-pet-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="landing-pet-dialog-title"
            aria-describedby="landing-pet-dialog-description"
            tabIndex={-1}
          >
            <button
              ref={dialogCloseRef}
              className="landing-pet-dialog__close"
              type="button"
              aria-label="Cerrar detalles de la mascota"
              onClick={() => setSelectedPet(null)}
            >
              ×
            </button>
            <div className="landing-pet-dialog__gallery" aria-label={`Fotos de ${selectedPet.name}`}>
              {selectedPetPhotos.length > 0 ? (
                <div
                  className="landing-pet-dialog__gallery-track"
                  style={{ transform: `translateX(-${selectedPhotoIndex * 100}%)` }}
                >
                  {selectedPetPhotos.map((photo, index) => (
                    <div className="landing-pet-dialog__gallery-slide" key={photo.id ?? photo.url}>
                      <img
                        className="landing-pet-dialog__photo"
                        src={photo.url}
                        alt={`Foto ${index + 1} de ${selectedPet.name}`}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="landing-pet-dialog__photo landing-pet__placeholder" aria-hidden="true">🐾</div>
              )}
              {selectedPetPhotos.length > 1 && (
                <>
                  <button
                    className="landing-pet-dialog__gallery-arrow landing-pet-dialog__gallery-arrow--previous"
                    type="button"
                    aria-label="Foto anterior"
                    onClick={() => changePetPhoto(-1)}
                  >
                    ←
                  </button>
                  <button
                    className="landing-pet-dialog__gallery-arrow landing-pet-dialog__gallery-arrow--next"
                    type="button"
                    aria-label="Foto siguiente"
                    onClick={() => changePetPhoto(1)}
                  >
                    →
                  </button>
                  <span className="landing-pet-dialog__gallery-count" aria-live="polite">
                    {selectedPhotoIndex + 1} / {selectedPetPhotos.length}
                  </span>
                </>
              )}
            </div>
            <div className="landing-pet-dialog__content">
              <p className="portal-eyebrow">Busca una familia</p>
              <h2 id="landing-pet-dialog-title">{selectedPet.name}</h2>
              <p className="landing-pet-dialog__summary" id="landing-pet-dialog-description">
                {selectedPet.temperament || "Conoce a esta mascota que está buscando un hogar."}
              </p>
              <dl className="landing-pet-dialog__details">
                <div><dt>Especie</dt><dd>{selectedPet.species}</dd></div>
                <div><dt>Raza</dt><dd>{selectedPet.breed_name || "No especificada"}</dd></div>
                <div><dt>Refugio</dt><dd>{selectedPet.shelter_name || "No especificado"}</dd></div>
                <div><dt>Ciudad</dt><dd>{selectedPet.city || "Ubicación por confirmar"}</dd></div>
                {selectedPet.age != null && (
                  <div><dt>Edad aproximada</dt><dd>{selectedPet.age} {selectedPet.age === 1 ? "año" : "años"}</dd></div>
                )}
                {selectedPet.size && <div><dt>Tamaño</dt><dd>{selectedPet.size}</dd></div>}
                {selectedPet.approximate_birth_date && (
                  <div><dt>Fecha aproximada de nacimiento</dt><dd>{new Date(`${selectedPet.approximate_birth_date}T12:00:00`).toLocaleDateString("es-CO")}</dd></div>
                )}
                {selectedPet.published_at && (
                  <div><dt>Perfil publicado</dt><dd>{new Date(selectedPet.published_at).toLocaleDateString("es-CO")}</dd></div>
                )}
                <div className="landing-pet-dialog__health">
                  <dt>Salud y condiciones médicas</dt>
                  <dd>
                    {selectedPet.health?.trim()
                      ? selectedPet.health
                      : "El refugio no ha añadido información médica. Consulta directamente con el refugio."}
                  </dd>
                </div>
              </dl>
              <button
                className={`landing-pet-dialog__like ${likedPetIds.has(selectedPet.id) ? "landing-pet-dialog__like--liked" : ""}`}
                type="button"
                aria-label={likedPetIds.has(selectedPet.id) ? `Quitar de favoritos a ${selectedPet.name}` : `Dar like a ${selectedPet.name}`}
                aria-pressed={likedPetIds.has(selectedPet.id)}
                onClick={() => togglePetLike(selectedPet.id)}
              >
                {likedPetIds.has(selectedPet.id) ? "♥ Te gusta esta mascota" : "♡ Me gusta"}
              </button>
              <button
                className="portal-button"
                type="button"
                onClick={() => {
                  setSelectedPet(null);
                  showAuthentication("login");
                }}
              >
                Quiero adoptar
              </button>
            </div>
          </section>
        </div>
      )}
      <section className="landing-bottom">
        <div>
          <p className="portal-eyebrow">Nuestra comunidad</p>
          <h2>Un espacio para cada persona que cuida.</h2>
          <p>
            Adoptantes, refugios y veterinarios trabajan juntos para que cada
            mascota reciba el cuidado y la familia que merece.
          </p>
        </div>
      </section>
      <footer className="landing-footer">Adopkia · Una comunidad por el bienestar animal</footer>
    </main>
  );
}

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
