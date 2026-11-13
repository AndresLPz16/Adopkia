import type { Dispatch, ReactNode, SetStateAction } from "react";
import { ROLES } from "../../rbac/types";

// Catálogo paginado para adoptantes o cuadrícula de gestión para el resto.
export function PetListing({
  role,
  petCards,
  visiblePetCards,
  petPage,
  setPetPage,
  petPageCount,
  managementPetsPerPage,
  setManagementPetsPerPage,
}: {
  role: string;
  petCards: ReactNode[];
  visiblePetCards: ReactNode[];
  petPage: number;
  setPetPage: Dispatch<SetStateAction<number>>;
  petPageCount: number;
  managementPetsPerPage: number;
  setManagementPetsPerPage: (value: number) => void;
}) {
  return role === ROLES.ADOPTER ? (
    <section className="portal-pet-carousel" aria-label="Catálogo de mascotas disponibles">
      {petPageCount > 0 && (
        <nav className="portal-pet-pagination" aria-label="Páginas de mascotas">
          <button
            className="portal-button portal-button--secondary"
            type="button"
            aria-label="Página anterior"
            disabled={petPage === 1}
            onClick={() => setPetPage((page) => page - 1)}
          >
            Anterior
          </button>
          {Array.from({ length: petPageCount }, (_, index) => {
            const page = index + 1;
            return (
              <button
                className={`portal-button portal-pet-pagination__number${page === petPage ? " is-active" : ""}`}
                type="button"
                key={page}
                aria-label={`Página ${page}`}
                aria-current={page === petPage ? "page" : undefined}
                onClick={() => setPetPage(page)}
              >
                {page}
              </button>
            );
          })}
          <button
            className="portal-button portal-button--secondary"
            type="button"
            aria-label="Página siguiente"
            disabled={petPage === petPageCount}
            onClick={() => setPetPage((page) => page + 1)}
          >
            Siguiente
          </button>
        </nav>
      )}
      <div
        className="portal-pet-carousel__viewport"
        role="region"
        aria-label="Listado de mascotas"
        tabIndex={0}
      >
        <div className="portal-pet-carousel__track">{visiblePetCards}</div>
      </div>
    </section>
  ) : (
    <>
      <div className="portal-grid">{visiblePetCards}</div>
      {petCards.length > 0 && (
        <div className="portal-user-pagination" aria-label="Paginación de mascotas">
          <label className="portal-user-pagination__size">
            <span>Por página</span>
            <select
              value={managementPetsPerPage}
              onChange={(event) => {
                setManagementPetsPerPage(Number(event.target.value));
                setPetPage(1);
              }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </label>
          <div className="portal-user-pagination__controls">
            <button
              type="button"
              className="portal-button portal-button--secondary"
              disabled={petPage === 1}
              onClick={() => setPetPage((page) => Math.max(page - 1, 1))}
            >
              Anterior
            </button>
            <span aria-live="polite">Página {petPage} de {petPageCount}</span>
            <button
              type="button"
              className="portal-button portal-button--secondary"
              disabled={petPage >= petPageCount}
              onClick={() => setPetPage((page) => Math.min(page + 1, petPageCount))}
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </>
  );
}
