export function PetManagementFilters({
  managementSearch,
  setManagementSearch,
  statusFilter,
  setStatusFilter,
  sizeFilter,
  setSizeFilter,
  petSort,
  setPetSort,
  updateManagementFilter,
}: {
  managementSearch: string;
  setManagementSearch: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  sizeFilter: string;
  setSizeFilter: (value: string) => void;
  petSort: string;
  setPetSort: (value: string) => void;
  updateManagementFilter: (update: () => void) => void;
}) {
  return (
    <div
      className="portal-pet-management-filters"
      role="group"
      aria-label="Filtros de mascotas"
    >
      <label className="portal-search">
        <span>Buscar por nombre, especie, raza, ciudad o refugio</span>
        <input
          type="search"
          value={managementSearch}
          onChange={(event) =>
            updateManagementFilter(() => setManagementSearch(event.target.value))
          }
          placeholder="Ej. Luna, perro o Huellas…"
        />
      </label>
      <label className="portal-pet-management-filters__field">
        <span>Estado</span>
        <select
          value={statusFilter}
          onChange={(event) =>
            updateManagementFilter(() => setStatusFilter(event.target.value))
          }
        >
          <option value="">Todos los estados</option>
          <option value="disponible">Disponible</option>
          <option value="en_proceso">En proceso</option>
          <option value="adoptada">Adoptada</option>
          <option value="devuelta">Devuelta</option>
        </select>
      </label>
      <label className="portal-pet-management-filters__field">
        <span>Tamaño</span>
        <select
          value={sizeFilter}
          onChange={(event) =>
            updateManagementFilter(() => setSizeFilter(event.target.value))
          }
        >
          <option value="">Todos los tamaños</option>
          <option value="pequeno">Pequeño</option>
          <option value="mediano">Mediano</option>
          <option value="grande">Grande</option>
        </select>
      </label>
      <label className="portal-pet-management-filters__field">
        <span>Ordenar por</span>
        <select
          value={petSort}
          onChange={(event) =>
            updateManagementFilter(() => setPetSort(event.target.value))
          }
        >
          <option value="name-asc">Nombre: A–Z</option>
          <option value="name-desc">Nombre: Z–A</option>
          <option value="status">Estado</option>
          <option value="newest">Más recientes</option>
          <option value="oldest">Más antiguas</option>
        </select>
      </label>
    </div>
  );
}
