from users.models import Role


RESOURCES = (
    ("dashboard", "Panel"),
    ("pets", "Mascotas"),
    ("shelters", "Refugios"),
    ("adoptionRequests", "Solicitudes de adopción"),
    ("adoptions", "Adopciones"),
    ("medicalRecords", "Historiales médicos"),
    ("conversations", "Conversaciones"),
    ("notifications", "Notificaciones"),
    ("users", "Usuarios"),
    ("statistics", "Estadísticas"),
)

ACTIONS = (
    ("read", "Consultar"),
    ("create", "Crear"),
    ("update", "Editar"),
    ("delete", "Eliminar"),
    ("approve", "Aprobar"),
    ("reject", "Rechazar"),
    ("verify", "Verificar"),
    ("manage", "Administrar"),
)

ROLE_LABELS = {
    Role.Name.ADOPTER: "Adoptante",
    Role.Name.SHELTER: "Refugio",
    Role.Name.ADMIN: "Administrador",
    Role.Name.VETERINARIAN: "Veterinario",
}

DEFAULT_PERMISSIONS = {
    Role.Name.ADOPTER: (
        ("dashboard", "read"),
        ("pets", "read"),
        ("shelters", "read"),
        ("adoptionRequests", "read"),
        ("adoptionRequests", "create"),
        ("adoptionRequests", "update"),
        ("adoptions", "read"),
        ("medicalRecords", "read"),
        ("conversations", "read"),
        ("conversations", "create"),
        ("notifications", "read"),
    ),
    Role.Name.SHELTER: (
        ("dashboard", "read"),
        ("pets", "read"),
        ("pets", "create"),
        ("pets", "update"),
        ("pets", "delete"),
        ("shelters", "read"),
        ("shelters", "update"),
        ("adoptionRequests", "read"),
        ("adoptionRequests", "approve"),
        ("adoptionRequests", "reject"),
        ("adoptions", "read"),
        ("medicalRecords", "read"),
        ("conversations", "read"),
        ("conversations", "create"),
        ("notifications", "read"),
    ),
    Role.Name.VETERINARIAN: (
        ("dashboard", "read"),
        ("pets", "read"),
        ("adoptions", "read"),
        ("medicalRecords", "read"),
        ("medicalRecords", "create"),
        ("medicalRecords", "update"),
        ("notifications", "read"),
    ),
    Role.Name.ADMIN: tuple(
        permission
        for resource, _label in RESOURCES
        for permission in (
            ((resource, "read"),)
            if resource in ("dashboard", "statistics")
            else ((resource, "manage"),)
        )
    )
    + (("shelters", "verify"),),
}


def get_permission_catalog():
    return {
        "resources": [
            {
                "key": resource,
                "label": label,
                "actions": [
                    {"key": action, "label": action_label}
                    for action, action_label in ACTIONS
                ],
            }
            for resource, label in RESOURCES
        ],
        "roles": [
            {
                "name": role.name,
                "label": ROLE_LABELS[role.name],
                "description": role.description,
                "permissions": [
                    {"resource": permission.resource, "action": permission.action}
                    for permission in role.permissions.all()
                ],
            }
            for role in Role.objects.prefetch_related("permissions").order_by("id")
        ],
    }
