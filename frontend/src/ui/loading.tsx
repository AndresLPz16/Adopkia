import { useEffect, useRef, useState } from "react";
import type { ImgHTMLAttributes } from "react";

/**
 * Imagen que aparece con una transición suave cuando termina de cargar.
 * Mientras carga (o si la dirección no existe) se ve el fondo del contenedor
 * en lugar de un hueco en blanco o el icono de imagen rota.
 */
export function FadeImage({ onLoad, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  // Una imagen que ya estaba en caché puede terminar antes de que React
  // registre `onLoad`.
  useEffect(() => {
    const image = ref.current;
    if (image?.complete && image.naturalWidth > 0) setLoaded(true);
  }, [props.src]);

  return (
    <img
      {...props}
      ref={ref}
      data-loaded={loaded}
      onLoad={(event) => {
        setLoaded(true);
        onLoad?.(event);
      }}
    />
  );
}

/** Silueta de una tarjeta mientras llegan los datos. */
function SkeletonCard() {
  return (
    <div className="skeleton-card" aria-hidden="true">
      <div className="skeleton skeleton--media" />
      <div className="skeleton skeleton--title" />
      <div className="skeleton skeleton--line" />
      <div className="skeleton skeleton--line skeleton--short" />
    </div>
  );
}

/**
 * Marcador de carga con la forma del contenido. El texto solo lo anuncian los
 * lectores de pantalla.
 */
export function SkeletonGrid({ label, cards = 3 }: { label: string; cards?: number }) {
  return (
    <div className="skeleton-grid" role="status">
      <span className="sr-only">{label}</span>
      {Array.from({ length: cards }, (_, index) => (
        <SkeletonCard key={index} />
      ))}
    </div>
  );
}
