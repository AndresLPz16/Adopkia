from users.models import Role


RESOURCES = (
    ("dashboard", "Panel"),
    ("profile", "Perfil personal"),
    ("pets", "Mascotas"),
    ("petPhotos", "Fotos de mascotas"),
    ("shelters", "Refugios"),
    ("shelterMembers", "Integrantes de refugios"),
    ("formQuestions", "Preguntas de adopción"),
    ("adoptionRequests", "Solicitudes de adopción"),
    ("adoptions", "Adopciones"),
    ("followUps", "Seguimientos"),
    ("veterinarians", "Perfiles veterinarios"),
    ("medicalRecords", "Historiales médicos"),
    ("vaccines", "Catálogo de vacunas"),
    ("reminders", "Recordatorios"),
    ("conversations", "Conversaciones"),
    ("messages", "Mensajes"),
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
    ("return", "Registrar devolución"),
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
        ("profile", "read"),
        ("profile", "update"),
        ("pets", "read"),
        ("shelters", "read"),
        ("formQuestions", "read"),
        ("adoptionRequests", "read"),
        ("adoptionRequests", "create"),
        ("adoptionRequests", "update"),
        ("adoptions", "read"),
        ("followUps", "read"),
        ("medicalRecords", "read"),
        ("vaccines", "read"),
        ("conversations", "read"),
        ("conversations", "create"),
        ("messages", "read"),
        ("messages", "create"),
        ("messages", "update"),
        ("messages", "delete"),
        ("notifications", "read"),
        ("notifications", "update"),
    ),
    Role.Name.SHELTER: (
        ("dashboard", "read"),
        ("profile", "read"),
        ("profile", "update"),
        ("pets", "read"),
        ("pets", "create"),
        ("pets", "update"),
        ("pets", "delete"),
        ("petPhotos", "read"),
        ("petPhotos", "create"),
        ("petPhotos", "delete"),
        ("shelters", "read"),
        ("shelters", "create"),
        ("shelters", "update"),
        ("shelterMembers", "read"),
        ("shelterMembers", "create"),
        ("shelterMembers", "update"),
        ("shelterMembers", "delete"),
        ("formQuestions", "read"),
        ("adoptionRequests", "read"),
        ("adoptionRequests", "approve"),
        ("adoptionRequests", "reject"),
        ("adoptions", "read"),
        ("adoptions", "return"),
        ("followUps", "read"),
        ("followUps", "create"),
        ("followUps", "update"),
        ("followUps", "delete"),
        ("medicalRecords", "read"),
        ("medicalRecords", "create"),
        ("medicalRecords", "update"),
        ("medicalRecords", "delete"),
        ("vaccines", "read"),
        ("reminders", "read"),
        ("reminders", "create"),
        ("reminders", "update"),
        ("reminders", "delete"),
        ("conversations", "read"),
        ("conversations", "create"),
        ("messages", "read"),
        ("messages", "create"),
        ("messages", "update"),
        ("messages", "delete"),
        ("notifications", "read"),
        ("notifications", "update"),
    ),
    Role.Name.VETERINARIAN: (
        ("dashboard", "read"),
        ("profile", "read"),
        ("profile", "update"),
        ("pets", "read"),
        ("adoptions", "read"),
        ("veterinarians", "read"),
        ("veterinarians", "create"),
        ("veterinarians", "update"),
        ("medicalRecords", "read"),
        ("medicalRecords", "create"),
        ("medicalRecords", "update"),
        ("medicalRecords", "delete"),
        ("vaccines", "read"),
        ("formQuestions", "read"),
        ("notifications", "read"),
        ("notifications", "update"),
    ),
    Role.Name.ADMIN: tuple(
        permission
        for resource, _label in RESOURCES
        for permission in (
            ((resource, "read"),)
            if resource in ("dashboard", "statistics", "formQuestions", "vaccines")
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
                "id": role.pk,
                "name": role.name,
                "label": role.label or ROLE_LABELS.get(role.name, role.name.replace("_", " ").title()),
                "description": role.description,
                "permissions": [
                    {"resource": permission.resource, "action": permission.action}
                    for permission in role.permissions.all()
                ],
            }
            for role in Role.objects.prefetch_related("permissions").order_by("id")
        ],
    }
