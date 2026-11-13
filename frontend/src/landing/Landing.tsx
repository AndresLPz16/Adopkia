import { AuthScreen } from "./AuthScreen";
import { LandingHeader } from "./LandingHeader";
import { LandingHero } from "./LandingHero";
import { LandingInfoSections } from "./LandingInfoSections";
import { PetCarousel } from "./PetCarousel";
import { PetDialog } from "./PetDialog";
import { PetSpotlight } from "./PetSpotlight";
import { useAuthFlow } from "./useAuthFlow";
import { usePetCatalog } from "./usePetCatalog";

export function Landing() {
  const auth = useAuthFlow();
  const catalog = usePetCatalog();
  const { showAuthentication } = auth;
  const { featuredPet, selectedPet } = catalog;

  if (auth.view !== "catalog") {
    return <AuthScreen auth={auth} />;
  }

  return (
    <main className="landing">
      <LandingHeader showAuthentication={showAuthentication} />
      <LandingHero catalog={catalog} />
      <PetCarousel catalog={catalog} showAuthentication={showAuthentication} />
      {featuredPet && <PetSpotlight catalog={catalog} featuredPet={featuredPet} />}
      <LandingInfoSections />
      {selectedPet && (
        <PetDialog
          catalog={catalog}
          selectedPet={selectedPet}
          showAuthentication={showAuthentication}
        />
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
