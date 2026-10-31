from django.utils.translation import gettext as _
from django.utils.translation import gettext_lazy as _lazy
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import OpenApiTypes, extend_schema

from users.models import Role, RolePermission
from users.rbac import DEFAULT_PERMISSIONS


PUBLIC_RESOURCES = (
    "register",
    "verify_email",
    "resend_email_verification",
    "login",
    "login_challenge",
    "refresh",
    "verified_shelters",
    "species",
    "breeds",
    "pets",
    "form_questions",
    "vaccines",
    "api_docs",
    "openapi_schema",
)

AUTHENTICATED_RESOURCES = (
    "profile",
    "role_permissions",
    "users",
    "shelter_members",
    "pet_photos",
    "adoption_requests",
    "adoptions",
    "follow_ups",
    "veterinarians",
    "medical_records",
    "reminders",
    "conversations",
    "messages",
    "notifications",
)

RESOURCE_DEFINITIONS = {
    "register": ("Registro", "/api/v1/auth/register/"),
    "verify_email": ("Verificación de correo", "/api/v1/auth/verify-email/"),
    "resend_email_verification": (
        "Reenviar verificación de correo",
        "/api/v1/auth/resend-email-verification/",
    ),
    "login": ("Iniciar sesión", "/api/v1/auth/login/"),
    "login_challenge": ("Reto de seguridad de inicio de sesión", "/api/v1/auth/login-challenge/"),
    "refresh": ("Renovar token", "/api/v1/auth/refresh/"),
    "profile": ("Mi perfil", "/api/v1/auth/me/"),
    "role_permissions": ("Permisos por rol", "/api/v1/auth/permissions/"),
    "users": ("Administración de usuarios", "/api/v1/auth/users/"),
    "verified_shelters": ("Refugios verificados", "/api/v1/shelters/"),
    "shelter_members": ("Integrantes de refugios", "/api/v1/shelter-members/"),
    "species": ("Especies", "/api/v1/species/"),
    "breeds": ("Razas", "/api/v1/breeds/"),
    "pets": ("Mascotas", "/api/v1/pets/"),
    "pet_photos": ("Fotos de mascotas", "/api/v1/pet-photos/"),
    "form_questions": ("Preguntas del formulario", "/api/v1/form-questions/"),
    "adoption_requests": ("Solicitudes de adopción", "/api/v1/adoption-requests/"),
    "adoptions": ("Adopciones", "/api/v1/adoptions/"),
    "follow_ups": ("Seguimientos", "/api/v1/follow-ups/"),
    "veterinarians": ("Veterinarios", "/api/v1/veterinarians/"),
    "medical_records": ("Historiales médicos", "/api/v1/medical-records/"),
    "vaccines": ("Vacunas", "/api/v1/vaccines/"),
    "reminders": ("Recordatorios", "/api/v1/reminders/"),
    "conversations": ("Conversaciones", "/api/v1/conversations/"),
    "messages": ("Mensajes", "/api/v1/messages/"),
    "notifications": ("Notificaciones", "/api/v1/notifications/"),
    "adoption_statistics": ("Estadísticas de adopción", "/api/v1/statistics/adoptions/"),
    "api_docs": ("Documentación de la API", "/api/docs/"),
    "openapi_schema": ("Esquema OpenAPI", "/api/schema/"),
}

COMMON_AUTHENTICATED_RESOURCES = frozenset(
    (*PUBLIC_RESOURCES, *AUTHENTICATED_RESOURCES)
)

API_RESOURCE_PERMISSION_KEYS = {
    "profile": "profile",
    "users": "users",
    "verified_shelters": "shelters",
    "shelter_members": "shelterMembers",
    "species": "pets",
    "breeds": "pets",
    "pets": "pets",
    "pet_photos": "petPhotos",
    "form_questions": "formQuestions",
    "adoption_requests": "adoptionRequests",
    "adoptions": "adoptions",
    "follow_ups": "followUps",
    "veterinarians": "veterinarians",
    "medical_records": "medicalRecords",
    "vaccines": "vaccines",
    "reminders": "reminders",
    "conversations": "conversations",
    "messages": "messages",
    "notifications": "notifications",
    "adoption_statistics": "statistics",
}

ROLE_RESOURCES = {
    role: frozenset(
        (*PUBLIC_RESOURCES, "role_permissions")
        + tuple(
            key
            for key, permission_resource in API_RESOURCE_PERMISSION_KEYS.items()
            if any(
                resource == permission_resource and action in ("read", "manage")
                for resource, action in role_permissions
            )
        )
    )
    for role, role_permissions in DEFAULT_PERMISSIONS.items()
}


class ApiIndexView(APIView):
    name = _lazy("Api Root")
    description = _lazy("Root endpoint for the Adopkia API.")
    permission_classes = (AllowAny,)

    @extend_schema(
        responses={
            200: OpenApiTypes.OBJECT,
        }
    )
    def get(self, request):
        role = None
        if request.user.is_authenticated:
            role = request.user.role.name
            grants = RolePermission.objects.filter(role_id=request.user.role_id)
            allowed = set(grants.values_list("resource", "action"))
            resource_keys = set(PUBLIC_RESOURCES)
            resource_keys.add("role_permissions")
            resource_keys.update(
                key
                for key, permission_resource in API_RESOURCE_PERMISSION_KEYS.items()
                if any(
                    resource == permission_resource and action in ("read", "manage")
                    for resource, action in allowed
                )
            )
        else:
            resource_keys = PUBLIC_RESOURCES

        resources = [
            {
                "key": key,
                "name": str(_(RESOURCE_DEFINITIONS[key][0])),
                "url": request.build_absolute_uri(RESOURCE_DEFINITIONS[key][1]),
            }
            for key in RESOURCE_DEFINITIONS
            if key in resource_keys
        ]
        return Response(
            {
                "role": str(_(role)) if role else None,
                "role_code": role,
                "resources": resources,
                **(
                    {
                        "message": str(
                            _(
                                "Only public resources are shown. Sign in with the "
                                "Log in link in the upper-right corner to see the "
                                "resources for your role."
                            )
                        ),
                        "login_url": "/api-auth/login/",
                    }
                    if not request.user.is_authenticated
                    else {}
                ),
            }
        )
