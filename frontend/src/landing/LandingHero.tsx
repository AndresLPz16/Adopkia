import type { PetCatalog } from "./usePetCatalog";

export function LandingHero({ catalog }: { catalog: PetCatalog }) {
  const { petSearch, setPetSearch, featuredPet } = catalog;

  return (
    <>
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
    </>
  );
}
