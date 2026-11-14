import { useEffect } from "react";

const SITE_TITLE = "Adopkia | Adopción responsable";

/**
 * Pone el nombre de la pantalla actual en la pestaña del navegador
 * ("Usuarios · Adopkia") y restaura el título general al salir.
 */
export function useDocumentTitle(screen: string | undefined) {
  useEffect(() => {
    document.title = screen ? `${screen} · Adopkia` : SITE_TITLE;
    return () => {
      document.title = SITE_TITLE;
    };
  }, [screen]);
}
