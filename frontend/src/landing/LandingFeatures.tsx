import { CalendarCheck, HeartPulse, MessageCircle, ShieldCheck } from "lucide-react";
import { revealRef } from "../ui/motion";

// Lo que Adopkia hace por cada adopción, en tarjetas de distinto peso: la más
// grande es el seguimiento, que es lo que la diferencia. Solo funciones reales.
export function LandingFeatures() {
  return (
    <section className="landing-features" ref={revealRef} aria-labelledby="landing-features-title">
      <div className="landing-features__intro">
        <h2 id="landing-features-title">Pensado para que nadie vuelva al refugio.</h2>
        <p>
          Adopkia acompaña antes, durante y después de la adopción, para que cada
          mascota se quede en su nuevo hogar.
        </p>
      </div>
      <ul className="landing-bento">
        <li className="landing-bento__card landing-bento__card--big">
          <HeartPulse size={44} strokeWidth={1.8} aria-hidden="true" />
          <h3>Seguimiento después de adoptar</h3>
          <p>
            El refugio registra cómo está la mascota, programa vacunas y controles,
            y queda constancia si alguna vez tiene que volver.
          </p>
        </li>
        <li className="landing-bento__card">
          <ShieldCheck size={30} strokeWidth={1.8} aria-hidden="true" />
          <h3>Refugios verificados</h3>
          <p>El equipo de Adopkia revisa cada refugio antes de que publique.</p>
        </li>
        <li className="landing-bento__card">
          <MessageCircle size={30} strokeWidth={1.8} aria-hidden="true" />
          <h3>Mensajes con el refugio</h3>
          <p>Resuelve tus dudas antes de enviar la solicitud.</p>
        </li>
        <li className="landing-bento__card landing-bento__card--wide">
          <CalendarCheck size={30} strokeWidth={1.8} aria-hidden="true" />
          <h3>Vacunas y recordatorios</h3>
          <p>
            Los veterinarios aliados registran cada atención y el historial queda
            con la mascota. Tú recibes el aviso cuando toca la siguiente.
          </p>
        </li>
      </ul>
    </section>
  );
}
