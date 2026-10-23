from django.utils.translation import gettext as _
from django.utils.translation import gettext_lazy as _lazy
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import OpenApiTypes, extend_schema

from users.models import Role


PUBLIC_RESOURCES = (
    "register",
    "login",
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
    "login": ("Iniciar sesión", "/api/v1/auth/login/"),
    "refresh": ("Renovar token", "/api/v1/auth/refresh/"),
    "profile": ("Mi perfil", "/api/v1/auth/me/"),
    "role_permissions": ("Permisos por rol", "/api/v1/auth/permissions/"),
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

ROLE_RESOURCES = {
    Role.Name.ADOPTER: COMMON_AUTHENTICATED_RESOURCES,
    Role.Name.SHELTER: COMMON_AUTHENTICATED_RESOURCES,
    Role.Name.VETERINARIAN: COMMON_AUTHENTICATED_RESOURCES,
    Role.Name.ADMIN: frozenset(RESOURCE_DEFINITIONS),
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
            resource_keys = ROLE_RESOURCES[role]
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
