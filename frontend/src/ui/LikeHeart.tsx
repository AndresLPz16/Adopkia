import { Heart } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

const PARTICLE_COUNT = 6;

/**
 * Corazón de "me gusta". Al marcarlo se rellena con un rebote y lanza un
 * anillo y unas chispas; al desmarcarlo solo se encoge un poco. La animación
 * responde al clic: un corazón que ya venía marcado no se anima al aparecer.
 * Los estilos están en 13-animations.css.
 */
export function LikeHeart({ liked, size }: { liked: boolean; size: number }) {
  const [likes, setLikes] = useState(0);
  const [unlikes, setUnlikes] = useState(0);
  const previous = useRef(liked);

  useEffect(() => {
    if (liked === previous.current) return;
    if (liked) setLikes((count) => count + 1);
    else setUnlikes((count) => count + 1);
    previous.current = liked;
  }, [liked]);

  const playing = liked ? likes > 0 : unlikes > 0;
  const className = [
    "like-heart",
    liked ? "like-heart--on" : "",
    playing ? (liked ? "like-heart--pop" : "like-heart--release") : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={className} aria-hidden="true">
      {/* La clave cambia en cada clic para que la animación vuelva a empezar. */}
      <Heart
        key={liked ? `on-${likes}` : `off-${unlikes}`}
        className="like-heart__icon"
        size={size}
        fill={liked ? "currentColor" : "none"}
      />
      {liked && likes > 0 && (
        <span key={likes} className="like-heart__burst">
          <span className="like-heart__ring" />
          {Array.from({ length: PARTICLE_COUNT }, (_, index) => (
            <span
              key={index}
              className="like-heart__spark"
              style={{ "--angle": `${(index * 360) / PARTICLE_COUNT + 30}deg` } as CSSProperties}
            />
          ))}
        </span>
      )}
    </span>
  );
}
