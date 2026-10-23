# Adopkia frontend RBAC

The repository provides a Django REST API and a runnable React + TypeScript
administration app. It uses the backend's current role names
(`adoptante`, `refugio`, `administrador`, `veterinario`) and profile endpoint
(`/api/v1/auth/me/`).

Frontend permission checks only control presentation and navigation. They are
not a security boundary: the backend must authorize every protected request.
The role-to-resource matrix is an initial UI policy and must stay consistent
with the backend's object-level rules.

## Install and verify

Run the following from `frontend/`:

```sh
npm install
npm run dev
npm run build
npm test
npm run typecheck
```

For example, from the repository root use `cd frontend` first.
Start the Django API at `http://127.0.0.1:8000`, apply migrations, and create an
administrator account first. Then open
`http://localhost:5173/admin/permissions`, sign in with that account, and the
matrix appears. Vite proxies `/api` requests to the local Django server.

## Use in an application

Provide a function that reads the current access token from the application's
existing auth storage. `AuthProvider` requests the authenticated profile and
maps its backend `role` value to the user's `roles` array.

```tsx
import { AuthProvider, PermissionButton, RESOURCES, ACTIONS } from "./rbac";

function App() {
  return (
    <AuthProvider
      getAccessToken={() => window.localStorage.getItem("access")}
    >
      <PermissionButton
        resource={RESOURCES.PETS}
        permissionAction={ACTIONS.CREATE}
        onClick={() => openPetForm()}
      >
        Registrar mascota
      </PermissionButton>
    </AuthProvider>
  );
}
```

After login or logout changes the token, call `refresh()` from `useAuth()` so
the provider reloads the profile and updates protected controls.

Use `PermissionGate` to conditionally render content. For routes, wrap protected
React Router routes in `ProtectedRoute` and pass `resource` and `action` for
authorization:

```tsx
<Routes>
  <Route
    element={
      <ProtectedRoute
        resource={RESOURCES.PETS}
        action={ACTIONS.CREATE}
      />
    }
  >
    <Route path="/pets/new" element={<NewPetPage />} />
  </Route>
</Routes>
```

The route guard displays a loading state, redirects unauthenticated users to
`/login`, and renders a denied state for insufficient permissions.

Mount `RolePermissionsPanel` on an administrator-only route to show the
permission matrix and save role changes to the backend:

```tsx
import { RolePermissionsPanel } from "./rbac";

<Route
  path="/admin/permissions"
  element={
    <ProtectedRoute
      resource={RESOURCES.USERS}
      action={ACTIONS.MANAGE}
    />
  }
>
  <Route index element={<RolePermissionsPanel />} />
</Route>
```

The API stores grants in `permiso_rol`. Authenticated users can read the
catalog; only administrator-role users can replace a role's permissions.
After saving, the provider reloads the policy used by `can`, `PermissionGate`,
`PermissionButton`, and `ProtectedRoute`. The database migration seeds the
initial matrix. To add a role or resource, update the backend catalog and
initial migration as well as the TypeScript types as needed.

These permissions configure frontend visibility and navigation only. Existing
backend endpoint and object-level rules remain authoritative and are not
weakened by frontend grants or replaced by this UI matrix.
