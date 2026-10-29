import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { AuthProvider } from "./rbac/auth";
import Portal from "./Portal";
import { loadPublicPets } from "./publicCatalog";
import type { PublicPetPreview } from "./publicCatalog";
import { apiErrorMessage } from "./portal/shared";

const ACCESS_TOKEN_KEY = "adopkia_access";
const REFRESH_TOKEN_KEY = "adopkia_refresh";

type AuthResponse = { access: string; refresh?: string; detail?: string };
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
  const [view, setView] = useState<"login" | "register">("login");
  const [pets, setPets] = useState<PublicPetPreview[]>([]);
  const [petsLoading, setPetsLoading] = useState(true);
  const [petsError, setPetsError] = useState("");
  const [petSearch, setPetSearch] = useState("");
  const [speciesFilter, setSpeciesFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    phone: "",
    role: "adoptante",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
  const featuredPet = pets[0];

  const openRegistration = () => {
    setView("register");
    document.getElementById("cuenta")?.scrollIntoView({ behavior: "smooth" });
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (view === "register") {
        await readJson(
          await fetch("/api/v1/auth/register/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: form.email,
              password: form.password,
              name: form.name,
              phone: form.phone || null,
              role: form.role,
            }),
          }),
        );
      }

      const login = (await readJson(
        await fetch("/api/v1/auth/login/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: form.email, password: form.password }),
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
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="landing">
      <header className="landing-header">
        <a className="landing-brand" href="/">
          <span className="app-header__mark">A</span>
          <span>Adopkia</span>
        </a>
        <nav className="landing-header__actions" aria-label="Acceso a tu cuenta">
          <button
            className="landing-header__login"
            onClick={() => {
              setView("login");
              document.getElementById("cuenta")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Iniciar sesión
          </button>
          <button className="portal-button" onClick={openRegistration}>
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
        <div className="portal-grid">
          {visiblePets.map((pet) => {
            const photo =
              pet.photos?.find((item) => item.is_primary) ?? pet.photos?.[0];
            return (
              <article className="portal-card landing-pet" key={pet.id}>
                <div className="landing-pet__media">
                  {photo?.url ? (
                    <img src={photo.url} alt={`Conoce a ${pet.name}`} loading="lazy" />
                  ) : (
                    <div className="landing-pet__placeholder" aria-hidden="true">🐾</div>
                  )}
                  <span className="landing-pet__badge"><span aria-hidden="true">♥</span> Busca familia</span>
                </div>
                <div className="landing-pet__content">
                  <div className="landing-pet__title">
                    <div><h3>{pet.name}</h3><span>{pet.species}</span></div>
                    <span className="landing-pet__heart" aria-hidden="true">♡</span>
                  </div>
                  <p className="landing-pet__details">
                    <span aria-hidden="true">⌖</span> {pet.city || "Ubicación por confirmar"}
                    {pet.age != null && <><span className="landing-pet__dot">·</span>{pet.age} {pet.age === 1 ? "año" : "años"}</>}
                  </p>
                  {pet.temperament && <p className="landing-pet__temperament">{pet.temperament}</p>}
                  <button className="landing-pet__action" onClick={openRegistration}>
                    Quiero conocerlo <span aria-hidden="true">→</span>
                  </button>
                </div>
              </article>
            );
          })}
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
      <section className="landing-bottom">
        <div>
          <p className="portal-eyebrow">Nuestra comunidad</p>
          <h2>Un espacio para cada persona que cuida.</h2>
          <p>
            Adoptantes, refugios y veterinarios trabajan juntos para que cada
            mascota reciba el cuidado y la familia que merece.
          </p>
        </div>
        <form className="landing-auth" id="cuenta" onSubmit={(event) => void submit(event)}>
          <p className="portal-eyebrow">{view === "login" ? "Bienvenido de vuelta" : "Únete a Adopkia"}</p>
          <h2>{view === "login" ? "Iniciar sesión" : "Crear cuenta"}</h2>
          {view === "register" && (
            <>
              <label className="portal-field"><span>Nombre completo</span><input value={form.name} onChange={(event) => update("name", event.target.value)} required /></label>
              <label className="portal-field"><span>Teléfono (opcional)</span><input value={form.phone} onChange={(event) => update("phone", event.target.value)} /></label>
              <label className="portal-field"><span>Tipo de cuenta</span><select value={form.role} onChange={(event) => update("role", event.target.value)}><option value="adoptante">Adoptante</option><option value="refugio">Refugio</option></select></label>
            </>
          )}
          <label className="portal-field"><span>Correo electrónico</span><input type="email" autoComplete="email" value={form.email} onChange={(event) => update("email", event.target.value)} required /></label>
          <label className="portal-field"><span>Contraseña</span><input type="password" autoComplete={view === "login" ? "current-password" : "new-password"} value={form.password} onChange={(event) => update("password", event.target.value)} required minLength={8} /></label>
          {error && <p className="portal-alert portal-alert--error" role="alert">{error}</p>}
          <button className="portal-button" disabled={busy}>{busy ? "Un momento…" : view === "login" ? "Entrar" : "Crear cuenta y entrar"}</button>
          <button className="portal-link" type="button" onClick={() => { setError(""); setView(view === "login" ? "register" : "login"); }}>
            {view === "login" ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Inicia sesión"}
          </button>
          <small>Las cuentas de refugio tienen herramientas especializadas. Las cuentas de veterinario y administración deben ser habilitadas por el equipo de Adopkia.</small>
        </form>
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
