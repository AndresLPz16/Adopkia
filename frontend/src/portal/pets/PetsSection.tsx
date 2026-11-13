import { useEffect, useRef, useState } from "react";
import { ACTIONS, RESOURCES, ROLES } from "../../rbac/types";
import { EmptyState, SectionTitle, text } from "../shared";
import type {
  PermissionCheck,
  PortalDataRow,
  PortalPetSaver,
  PortalSender,
  PortalSubmit,
} from "../shared";
import { PetCard } from "./PetCard";
import { PetDetailsDialog } from "./PetDetailsDialog";
import { PetForm } from "./PetForm";
import { PetListing } from "./PetListing";
import { PetManagementFilters } from "./PetManagementFilters";
import { usePetPhotos } from "./usePetPhotos";


export function PetsSection({
  role,
  canDo,
  visiblePets,
  managedShelters,
  breeds,
  form,
  setValue,
  submit,
  savePet,
  send,
  setForm,
  editingPet,
  setEditingPet,
  busy,
  loading,
  petSearch,
  setPetSearch,
  onRequestAdoption,
}: {
  role: string;
  canDo: PermissionCheck;
  visiblePets: PortalDataRow[];
  managedShelters: PortalDataRow[];
  breeds: PortalDataRow[];
  form: Record<string, string>;
  setValue: (name: string, value: string) => void;
  submit: PortalSubmit;
  savePet: PortalPetSaver;
  send: PortalSender;
  setForm: (value: Record<string, string>) => void;
  editingPet: string;
  setEditingPet: (value: string) => void;
  busy: boolean;
  loading: boolean;
  petSearch: string;
  setPetSearch: (value: string) => void;
  onRequestAdoption: (petId: string) => void;
}) {
  const [managementSearch, setManagementSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sizeFilter, setSizeFilter] = useState("");
  const [petSort, setPetSort] = useState("name-asc");
  const [managementPetsPerPage, setManagementPetsPerPage] = useState(10);
  const [selectedPet, setSelectedPet] = useState<PortalDataRow | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [petPage, setPetPage] = useState(1);
  const photoOpenerRef = useRef<HTMLButtonElement | null>(null);
  const petDialogCloseRef = useRef<HTMLButtonElement | null>(null);
  const isAdopter = role === ROLES.ADOPTER;
  const petsPerPage = isAdopter ? 15 : managementPetsPerPage;
  const normalizedSearch = managementSearch.trim().toLocaleLowerCase();
  const filteredPets = isAdopter
    ? visiblePets
    : visiblePets
        .filter((pet) => {
          const matchesSearch = [
            pet.name,
            pet.species,
            pet.breed_name,
            pet.city,
            pet.shelter_name,
            pet.temperament,
          ]
            .map(text)
            .join(" ")
            .toLocaleLowerCase()
            .includes(normalizedSearch);
          const status = text(pet.status_code || pet.status).toLocaleLowerCase();
          const matchesStatus = !statusFilter || status === statusFilter;
          const matchesSize =
            !sizeFilter || text(pet.size).toLocaleLowerCase() === sizeFilter;
          return matchesSearch && matchesStatus && matchesSize;
        })
        .sort((left, right) => {
          if (petSort === "name-desc") {
            return text(right.name).localeCompare(text(left.name), "es");
          }
          if (petSort === "status") {
            const statusDifference = text(left.status_code || left.status).localeCompare(
              text(right.status_code || right.status),
              "es",
            );
            return statusDifference || text(left.name).localeCompare(text(right.name), "es");
          }
          if (petSort === "newest" || petSort === "oldest") {
            const leftDate = Date.parse(text(left.published_at)) || 0;
            const rightDate = Date.parse(text(right.published_at)) || 0;
            return petSort === "newest"
              ? rightDate - leftDate
              : leftDate - rightDate;
          }
          return text(left.name).localeCompare(text(right.name), "es");
        });
  const updateManagementFilter = (update: () => void) => {
    update();
    setPetPage(1);
  };
  const photos = usePetPhotos(editingPet, visiblePets);
  const { clearPhotos } = photos;


  const closePetDetails = () => {
    setSelectedPet(null);
    photoOpenerRef.current?.focus();
  };

  useEffect(() => {
    if (!selectedPet) return;
    petDialogCloseRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePetDetails();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedPet]);

  const petCards = filteredPets.map((pet) => (
    <PetCard
      key={text(pet.id)}
      pet={pet}
      role={role}
      canDo={canDo}
      send={send}
      setEditingPet={setEditingPet}
      setForm={setForm}
      clearPhotos={clearPhotos}
      onRequestAdoption={onRequestAdoption}
      photoOpenerRef={photoOpenerRef}
      setSelectedPhotoIndex={setSelectedPhotoIndex}
      setSelectedPet={setSelectedPet}
    />
  ));


  const petPageCount = Math.ceil(petCards.length / petsPerPage);
  const visiblePetCards = petCards.slice(
    (petPage - 1) * petsPerPage,
    petPage * petsPerPage,
  );

  useEffect(() => {
    setPetPage(1);
  }, [petSearch, visiblePets.length]);

  useEffect(() => {
    if (petPageCount > 0 && petPage > petPageCount) {
      setPetPage(petPageCount);
    }
  }, [petPage, petPageCount]);

  return (
    <>
      <SectionTitle
        eyebrow={role === ROLES.ADOPTER ? "Encuentra compañía" : "Gestión del refugio"}
        title={role === ROLES.ADOPTER ? "Mascotas" : "Mascotas a tu cuidado"}
        description={
          role === ROLES.ADOPTER
            ? "Explora perfiles y comienza una solicitud de adopción."
            : "Publica y administra los perfiles de tus mascotas."
        }
      />
      {role === ROLES.ADOPTER && (
        <label className="portal-search">
          <span>Buscar por nombre, especie, ciudad o temperamento</span>
          <input
            type="search"
            value={petSearch}
            onChange={(event) => setPetSearch(event.target.value)}
            placeholder="Ej. Luna, perro, Medellín…"
          />
        </label>
      )}
      {!isAdopter && (
        <PetManagementFilters
          managementSearch={managementSearch}
          setManagementSearch={setManagementSearch}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          sizeFilter={sizeFilter}
          setSizeFilter={setSizeFilter}
          petSort={petSort}
          setPetSort={setPetSort}
          updateManagementFilter={updateManagementFilter}
        />
      )}
      {!isAdopter && (
        <p className="portal-pet-management__summary" aria-live="polite">
          {filteredPets.length === 0
            ? "No hay mascotas para mostrar."
            : `Mostrando ${((petPage - 1) * petsPerPage) + 1}–${Math.min(petPage * petsPerPage, filteredPets.length)} de ${filteredPets.length} mascotas`}
        </p>
      )}
      {role !== ROLES.ADOPTER && canDo(RESOURCES.PETS, ACTIONS.CREATE) && (
        <PetForm
          form={form}
          setForm={setForm}
          setValue={setValue}
          submit={submit}
          savePet={savePet}
          editingPet={editingPet}
          setEditingPet={setEditingPet}
          managedShelters={managedShelters}
          breeds={breeds}
          busy={busy}
          photos={photos}
        />
      )}
      <PetListing
        role={role}
        petCards={petCards}
        visiblePetCards={visiblePetCards}
        petPage={petPage}
        setPetPage={setPetPage}
        petPageCount={petPageCount}
        managementPetsPerPage={managementPetsPerPage}
        setManagementPetsPerPage={setManagementPetsPerPage}
      />
      {!loading && visiblePets.length === 0 && <EmptyState>{petSearch ? "No encontramos mascotas con esos criterios." : "No hay mascotas disponibles para mostrar."}</EmptyState>}
      {!loading && visiblePets.length > 0 && petCards.length === 0 && (
        <EmptyState>
          {isAdopter
            ? "No encontramos mascotas con esos criterios."
            : "No se encontraron mascotas que coincidan con los filtros."}
        </EmptyState>
      )}
      {selectedPet && (
        <PetDetailsDialog
          selectedPet={selectedPet}
          closePetDetails={closePetDetails}
          petDialogCloseRef={petDialogCloseRef}
          selectedPhotoIndex={selectedPhotoIndex}
          setSelectedPhotoIndex={setSelectedPhotoIndex}
          role={role}
          canDo={canDo}
          onRequestAdoption={onRequestAdoption}
        />
      )}
    </>
  );
}
