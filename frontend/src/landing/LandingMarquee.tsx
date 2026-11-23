import { PawPrint } from "lucide-react";

const PHRASES = [
  "Refugios verificados",
  "Adopción responsable",
  "Perros y gatos que buscan hogar",
  "Tu solicitud, acompañada",
  "Seguimiento después de adoptar",
];

// Cinta de frases que se desplaza entre secciones. Es decorativa: lo que dice
// ya aparece en la página, así que los lectores de pantalla la omiten. La lista
// va dos veces para que el desplazamiento no tenga cortes.
export function LandingMarquee() {
  const items = [...PHRASES, ...PHRASES];
  return (
    <div className="landing-marquee" aria-hidden="true">
      <div className="landing-marquee__track">
        {items.map((phrase, index) => (
          <span key={index} className="landing-marquee__item">
            {phrase}
            <PawPrint size={22} strokeWidth={2.2} />
          </span>
        ))}
      </div>
    </div>
  );
}
