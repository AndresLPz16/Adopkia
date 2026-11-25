import { AdoptionStories } from "./AdoptionStories";
import { AuthScreen } from "./AuthScreen";
import { LandingClosing } from "./LandingClosing";
import { LandingFeatures } from "./LandingFeatures";
import { LandingHeader } from "./LandingHeader";
import { LandingHero } from "./LandingHero";
import { LandingInfoSections } from "./LandingInfoSections";
import { LandingMarquee } from "./LandingMarquee";
import { LandingStats } from "./LandingStats";
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
      <LandingStats catalog={catalog} />
      <PetCarousel catalog={catalog} showAuthentication={showAuthentication} />
      <LandingMarquee />
      {featuredPet && <PetSpotlight catalog={catalog} featuredPet={featuredPet} />}
      <AdoptionStories />
      <LandingFeatures />
      <LandingInfoSections />
      {selectedPet && (
        <PetDialog
          catalog={catalog}
          selectedPet={selectedPet}
          showAuthentication={showAuthentication}
        />
      )}
      <LandingClosing showAuthentication={showAuthentication} />
    </main>
  );
}
