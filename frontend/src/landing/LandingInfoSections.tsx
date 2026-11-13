// Secciones estáticas: cómo funciona el proceso y preguntas frecuentes.
export function LandingInfoSections() {
  return (
    <>
      <section
        className="landing-process"
        id="como-funciona"
        aria-labelledby="landing-process-title"
      >
        <div className="landing-process__intro">
          <p className="landing-eyebrow"><span aria-hidden="true">♥</span> Un proceso claro y acompañado</p>
          <h2 id="landing-process-title">Conoce, conecta y acompaña.</h2>
          <p>
            Cada adopción empieza con información clara y continúa junto a las
            personas que cuidan de cada mascota.
          </p>
        </div>
        <ol className="landing-process__steps">
          <li>
            <span aria-hidden="true">01</span>
            <h3>Encuentra una conexión</h3>
            <p>Explora perfiles y filtra por especie, ciudad o personalidad.</p>
          </li>
          <li>
            <span aria-hidden="true">02</span>
            <h3>Conoce su historia</h3>
            <p>Consulta los detalles de salud, carácter y refugio de cada mascota.</p>
          </li>
          <li>
            <span aria-hidden="true">03</span>
            <h3>Da el siguiente paso</h3>
            <p>Inicia sesión para enviar tu solicitud y seguir el proceso con el refugio.</p>
          </li>
        </ol>
        <a className="landing-process__link" href="#mascotas">
          Ver mascotas disponibles <span aria-hidden="true">→</span>
        </a>
      </section>
      <section
        className="landing-faq"
        id="preguntas-frecuentes"
        aria-labelledby="landing-faq-title"
      >
        <div className="landing-faq__intro">
          <p className="landing-eyebrow"><span aria-hidden="true">♥</span> Antes de empezar</p>
          <h2 id="landing-faq-title">Preguntas frecuentes</h2>
          <p>Información práctica para dar tus primeros pasos en Adopkia.</p>
        </div>
        <div className="landing-faq__list">
          <details>
            <summary>¿Cómo envío una solicitud de adopción?</summary>
            <p>
              Inicia sesión o crea una cuenta, elige una mascota y completa las
              preguntas que aparecen en el formulario. Al enviarlo, la solicitud
              queda disponible para el refugio.
            </p>
          </details>
          <details>
            <summary>¿Enviar la solicitud significa que la adopción ya está aprobada?</summary>
            <p>
              No. Enviar una solicitud inicia el proceso; el refugio revisa la
              información y registra su respuesta. Puedes consultar el estado
              desde “Mis solicitudes” en tu cuenta.
            </p>
          </details>
          <details>
            <summary>¿Qué requisitos debo cumplir para adoptar?</summary>
            <p>
              Los requisitos y las preguntas pueden variar según el refugio.
              Revisa con atención el formulario de la mascota y cualquier
              información publicada por la organización antes de enviar tu solicitud.
            </p>
          </details>
          <details>
            <summary>¿Por qué algunos perfiles no muestran información médica?</summary>
            <p>
              La información depende de lo que haya registrado el refugio.
              Si un dato no aparece en el perfil, confirma los detalles
              directamente con la organización antes de tomar una decisión.
            </p>
          </details>
          <details>
            <summary>¿Cuánto tarda el refugio en responder?</summary>
            <p>
              El tiempo de respuesta puede variar según cada organización.
              Revisa el estado de tu solicitud en tu cuenta para consultar las
              actualizaciones disponibles.
            </p>
          </details>
        </div>
        <a className="landing-faq__link" href="#mascotas">
          Explorar mascotas <span aria-hidden="true">→</span>
        </a>
      </section>
    </>
  );
}
