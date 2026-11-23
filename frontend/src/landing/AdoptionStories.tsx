import { revealRef } from "../ui/motion";
import { adoptionStories } from "./storiesData";

// Historias de mascotas que ya encontraron hogar. Las de ejemplo lo dicen en
// la propia tarjeta para no presentarse como testimonios reales.
export function AdoptionStories() {
  if (adoptionStories.length === 0) return null;

  return (
    <section
      className="landing-stories"
      ref={revealRef}
      aria-labelledby="landing-stories-title"
    >
      <div className="landing-stories__intro">
        <h2 id="landing-stories-title">Historias que empezaron aquí</h2>
        <p>
          Cada adopción cambia dos vidas: la de la mascota y la de quien le abre
          la puerta de su casa.
        </p>
      </div>
      <ul className="landing-stories__list">
        {adoptionStories.map((story) => (
          <li key={story.id} className="landing-story">
            <div className="landing-story__photo">
              <img src={story.imageUrl} alt={`Foto de ${story.petName}`} loading="lazy" />
            </div>
            <h3>{story.petName}</h3>
            <p className="landing-story__text">{story.story}</p>
            <p className="landing-story__meta">
              Con {story.family} desde {story.adoptedOn}, en {story.city}.
            </p>
            {story.example && <p className="landing-story__example">Historia de ejemplo</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
