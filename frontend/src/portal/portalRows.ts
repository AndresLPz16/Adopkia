import { ROLES } from "../rbac/types";
import { isAvailablePet, rows, text } from "./shared";
import type { PortalDataRow } from "./shared";

/**
 * Convierte las respuestas cargadas (una por endpoint) en las listas que usan
 * las secciones, y calcula las que dependen del rol: lo que gestiona un
 * refugio y las mascotas que ve cada cuenta según su búsqueda.
 */
export function portalRows(
  data: Record<string, unknown>,
  {
    role,
    userId,
    petSearch,
  }: { role: string; userId: unknown; petSearch: string },
) {
  const pets = rows(data["/api/v1/pets/"]);
  const shelters = rows(data["/api/v1/shelters/"]);
  const members = rows(data["/api/v1/shelter-members/"]);

  const myShelterIds = new Set(
    members
      .filter((member) => text(member.user) === text(userId))
      .map((member) => text(member.shelter)),
  );
  const managedPets =
    role === ROLES.SHELTER
      ? pets.filter((pet) => myShelterIds.has(text(pet.shelter)))
      : pets;
  const managedShelters =
    role === ROLES.SHELTER
      ? shelters.filter((shelter) => myShelterIds.has(text(shelter.id)))
      : shelters;
  const visiblePets = (role === ROLES.ADOPTER
    ? pets.filter(isAvailablePet)
    : managedPets
  ).filter((pet) =>
    [pet.name, pet.species, pet.city, pet.temperament]
      .map(text)
      .join(" ")
      .toLocaleLowerCase()
      .includes(petSearch.trim().toLocaleLowerCase()),
  );

  return {
    pets,
    managedPets,
    visiblePets,
    shelters,
    managedShelters,
    breeds: rows(data["/api/v1/breeds/"]),
    questions: rows(data["/api/v1/form-questions/"]),
    requests: rows(data["/api/v1/adoption-requests/"]),
    adoptions: rows(data["/api/v1/adoptions/"]),
    followUps: rows(data["/api/v1/follow-ups/"]),
    reminders: rows(data["/api/v1/reminders/"]),
    conversations: rows(data["/api/v1/conversations/"]),
    messages: rows(data["/api/v1/messages/"]),
    records: rows(data["/api/v1/medical-records/"]),
    vaccines: rows(data["/api/v1/vaccines/"]),
    species: rows(data["/api/v1/species/"]),
    veterinarians: rows(data["/api/v1/veterinarians/"]),
    members,
    notifications: rows(data["/api/v1/notifications/"]),
    users: rows(data["/api/v1/auth/users/"]),
    availableRoleRows: rows(data["/api/v1/auth/roles/"]),
    profile: data["/api/v1/auth/me/"] as PortalDataRow | undefined,
  };
}
