// Historias de adopción que muestra la página de inicio.
//
// Estas tres son ejemplos, con nombres e imágenes de demostración, y la página
// las marca como "Historia de ejemplo". Para publicar una historia real:
// pide permiso a la familia, cambia los datos y pon `example: false`.
export type AdoptionStory = {
  id: string;
  petName: string;
  /** Una o dos frases: cómo llegó y cómo vive ahora. */
  story: string;
  /** Quién adoptó, solo con el nombre de pila. */
  family: string;
  adoptedOn: string;
  city: string;
  imageUrl: string;
  example: boolean;
};

export const adoptionStories: AdoptionStory[] = [
  {
    id: "luna",
    petName: "Luna",
    story:
      "Llegó al refugio con tres meses y miedo a todo. Hoy duerme al sol en el balcón y recibe a todos en la puerta.",
    family: "Andrea y su abuela",
    adoptedOn: "marzo de 2026",
    city: "Riohacha",
    imageUrl: "/demo-pets/luna.svg",
    example: true,
  },
  {
    id: "toby",
    petName: "Toby",
    story:
      "Pasó un año esperando porque era «demasiado grande». Ahora acompaña a Julián en sus caminatas por el malecón.",
    family: "Julián",
    adoptedOn: "junio de 2026",
    city: "Riohacha",
    imageUrl: "/demo-pets/toby.svg",
    example: true,
  },
  {
    id: "canela",
    petName: "Canela",
    story:
      "El refugio la cuidó durante una cirugía de cadera. Con su nueva familia ya corre detrás de la pelota.",
    family: "Daniela y sus hijos",
    adoptedOn: "agosto de 2026",
    city: "Maicao",
    imageUrl: "/demo-pets/canela.svg",
    example: true,
  },
];
