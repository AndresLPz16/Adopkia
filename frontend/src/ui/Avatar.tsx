import { useEffect, useState } from "react";

// Foto de perfil de una cuenta. Sin foto, o si la imagen no carga, muestra las
// iniciales del nombre.

function initials(name: string): string {
  // Se ignoran los signos al inicio de cada palabra: "[E2E] Ana" da "EA".
  const words = name
    .split(/\s+/)
    .map((word) => word.replace(/^[^\p{L}\p{N}]+/u, ""))
    .filter(Boolean);
  if (words.length === 0) return "?";
  const first = [...words[0]][0] ?? "";
  const last = words.length > 1 ? ([...words[words.length - 1]][0] ?? "") : "";
  return (first + last).toLocaleUpperCase();
}

export function Avatar({
  name,
  photoUrl,
  size = "md",
}: {
  name: string;
  photoUrl?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const [failed, setFailed] = useState(false);

  // Una foto nueva merece otro intento aunque la anterior no haya cargado.
  useEffect(() => {
    setFailed(false);
  }, [photoUrl]);

  return (
    <span className={`avatar avatar--${size}`} aria-hidden="true">
      {photoUrl && !failed ? (
        <img src={photoUrl} alt="" onError={() => setFailed(true)} />
      ) : (
        initials(name)
      )}
    </span>
  );
}
