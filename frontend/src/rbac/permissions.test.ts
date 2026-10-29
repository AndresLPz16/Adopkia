import { describe, expect, it } from "vitest";
import { can } from "./permissions";
import { ACTIONS, RESOURCES, ROLES } from "./types";

describe("can", () => {
  it("permite una acción declarada para uno de los roles del usuario", () => {
    expect(
      can(
        { roles: [ROLES.ADOPTER] },
        RESOURCES.PETS,
        ACTIONS.READ,
      ),
    ).toBe(true);
  });

  it("deniega acciones no declaradas y usuarios anónimos", () => {
    expect(
      can(
        { roles: [ROLES.ADOPTER] },
        RESOURCES.PETS,
        ACTIONS.DELETE,
      ),
    ).toBe(false);
    expect(can(null, RESOURCES.PETS, ACTIONS.READ)).toBe(false);
  });

  it("deniega usuarios desactivados", () => {
    expect(
      can(
        { roles: [ROLES.ADMIN], active: false },
        RESOURCES.USERS,
        ACTIONS.READ,
      ),
    ).toBe(false);
  });

  it("acepta MANAGE como permiso general para el recurso", () => {
    expect(
      can(
        { roles: [ROLES.ADMIN] },
        RESOURCES.USERS,
        ACTIONS.DELETE,
      ),
    ).toBe(true);
  });

  it("acepta permisos declarados fuera de la lógica de evaluación", () => {
    expect(
      can(
        { roles: ["coordinator"] },
        RESOURCES.PETS,
        ACTIONS.CREATE,
        { coordinator: { [RESOURCES.PETS]: [ACTIONS.CREATE] } },
      ),
    ).toBe(true);
  });

  it("usa la matriz recibida del backend como autoridad sobre los defaults", () => {
    const user = { roles: [ROLES.ADOPTER] };
    expect(
      can(user, RESOURCES.PETS, ACTIONS.CREATE, {
        [ROLES.ADOPTER]: { [RESOURCES.PETS]: [ACTIONS.READ] },
      }),
    ).toBe(false);
    expect(
      can(user, RESOURCES.PETS, ACTIONS.CREATE, {
        [ROLES.ADOPTER]: { [RESOURCES.PETS]: [ACTIONS.CREATE] },
      }),
    ).toBe(true);
  });

  it("allows the platform superadministrator every action independent of role grants", () => {
    expect(
      can(
        {
          roles: [ROLES.ADMIN],
          isPlatformSuperadmin: true,
        },
        RESOURCES.USERS,
        ACTIONS.DELETE,
        {},
      ),
    ).toBe(true);
  });
});
