from django.db import transaction
from django.utils import timezone
from django.utils.crypto import constant_time_compare, salted_hmac
from rest_framework import generics, permissions, serializers, status
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import OpenApiTypes, extend_schema

from myproject.permissions import IsAdminRole, RolePermissionRequired
from myproject.throttling import (
    EmailVerificationRateThrottle,
    LoginChallengeRateThrottle,
    RegisterRateThrottle,
    ResendEmailVerificationRateThrottle,
)

from .models import (
    EmailVerificationCode,
    LoginMathChallenge,
    PermissionResource,
    PortalSettings,
    Role,
    RolePermission,
    User,
)
from .rbac import get_permission_catalog
from .serializers import (
    RoleDefinitionSerializer,
    RolePermissionSerializer,
    PermissionResourceSerializer,
    UserAdminSerializer,
    UserProfileSerializer,
    UserRegistrationSerializer,
)
from .security import create_login_math_challenge, issue_email_verification_code


class EmailAddressSerializer(serializers.Serializer):
    email = serializers.EmailField()


class EmailVerificationSerializer(EmailAddressSerializer):
    code = serializers.RegexField(r"^\d{6}$")


class RegisterView(generics.CreateAPIView):
    serializer_class = UserRegistrationSerializer
    permission_classes = (permissions.AllowAny,)
    throttle_classes = (RegisterRateThrottle,)

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        issue_email_verification_code(user)
        return Response(
            {
                "detail": "Cuenta creada. Revisa tu correo e ingresa el código de verificación.",
                "id": user.pk,
                "email": user.email,
                "username": user.username,
            },
            status=status.HTTP_201_CREATED,
        )


class EmailVerificationView(APIView):
    permission_classes = (permissions.AllowAny,)
    throttle_classes = (EmailVerificationRateThrottle,)

    @extend_schema(request=EmailVerificationSerializer, responses=OpenApiTypes.OBJECT)
    def post(self, request):
        serializer = EmailVerificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]
        code = serializer.validated_data["code"]

        invalid_code = False
        with transaction.atomic():
            verification = (
                EmailVerificationCode.objects.select_for_update()
                .select_related("user")
                .filter(user__email__iexact=email)
                .first()
            )
            if (
                verification is None
                or verification.expires_at <= timezone.now()
                or verification.failed_attempts >= 5
            ):
                if verification is not None:
                    verification.delete()
                invalid_code = True
            else:
                submitted_hash = salted_hmac(
                    f"adopkia.email-verification:user:{verification.user_id}",
                    code,
                ).hexdigest()
                if not constant_time_compare(verification.code_hash, submitted_hash):
                    verification.failed_attempts += 1
                    if verification.failed_attempts >= 5:
                        verification.delete()
                    else:
                        verification.save(update_fields=("failed_attempts",))
                    invalid_code = True
                else:
                    verification.user.email_verified = True
                    verification.user.save(update_fields=("email_verified",))
                    verification.delete()

        if invalid_code:
            raise AuthenticationFailed("El código es inválido o ha vencido.")

        return Response({"detail": "Correo verificado. Ya puedes iniciar sesión."})


class ResendEmailVerificationView(APIView):
    permission_classes = (permissions.AllowAny,)
    throttle_classes = (ResendEmailVerificationRateThrottle,)

    @extend_schema(request=EmailAddressSerializer, responses=OpenApiTypes.OBJECT)
    def post(self, request):
        serializer = EmailAddressSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]
        user = User.objects.filter(email__iexact=email, email_verified=False).first()
        if user is not None:
            existing = EmailVerificationCode.objects.filter(user=user).first()
            if (
                existing is None
                or (timezone.now() - existing.sent_at).total_seconds() >= 60
            ):
                issue_email_verification_code(user)
        return Response(
            {"detail": "Si la cuenta necesita verificación, recibirás un código por correo."}
        )


class LoginMathChallengeView(APIView):
    permission_classes = (permissions.AllowAny,)
    throttle_classes = (LoginChallengeRateThrottle,)

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        LoginMathChallenge.objects.filter(expires_at__lte=timezone.now()).delete()
        challenge, question = create_login_math_challenge()
        return Response(
            {
                "challenge_id": str(challenge.pk),
                "question": question,
            }
        )


class ProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserProfileSerializer
    permission_classes = (permissions.IsAuthenticated, RolePermissionRequired)
    rbac_resource = "profile"

    def get_object(self):
        return self.request.user


class RolePermissionsView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    @extend_schema(
        responses=OpenApiTypes.OBJECT,
        operation_id="role_permissions_catalog",
    )
    def get(self, request):
        return Response(get_permission_catalog())


class PermissionResourceListCreateView(APIView):
    permission_classes = (permissions.IsAuthenticated,)
    rbac_resource = "rolePermissions"
    rbac_required_action = "create"

    def get_permissions(self):
        if self.request.method == "GET":
            self.rbac_required_action = "read"
        return [RolePermissionRequired()]

    @extend_schema(
        responses=PermissionResourceSerializer(many=True),
        operation_id="permission_resources_list",
    )
    def get(self, request):
        return Response(PermissionResourceSerializer(
            PermissionResource.objects.all(), many=True
        ).data)

    @extend_schema(
        request=PermissionResourceSerializer,
        responses=OpenApiTypes.OBJECT,
        operation_id="create_permission_resource",
    )
    def post(self, request):
        serializer = PermissionResourceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        resource = serializer.validated_data["key"]
        if PermissionResource.objects.filter(pk=resource).exists():
            raise ValidationError({"key": "Ya existe un recurso con esta clave."})
        if RolePermission.objects.filter(resource=resource).exists():
            raise ValidationError(
                {"key": "La clave ya está usada por permisos existentes."}
            )
        serializer.save()
        return Response(get_permission_catalog(), status=status.HTTP_201_CREATED)


class PermissionResourceDetailView(APIView):
    permission_classes = (RolePermissionRequired,)
    rbac_resource = "rolePermissions"

    def get_resource(self, key):
        from django.shortcuts import get_object_or_404

        return get_object_or_404(PermissionResource.objects.select_for_update(), pk=key)

    @extend_schema(
        request=PermissionResourceSerializer,
        responses=OpenApiTypes.OBJECT,
        operation_id="update_permission_resource",
    )
    @transaction.atomic
    def patch(self, request, key):
        resource = self.get_resource(key)
        serializer = PermissionResourceSerializer(
            resource,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        updated_resource = serializer.save()
        if "actions" in serializer.validated_data:
            RolePermission.objects.filter(resource=key).exclude(
                action__in=updated_resource.actions
            ).delete()
        return Response(get_permission_catalog())

    @extend_schema(
        responses=OpenApiTypes.OBJECT,
        operation_id="delete_permission_resource",
    )
    @transaction.atomic
    def delete(self, request, key):
        resource = self.get_resource(key)
        RolePermission.objects.filter(resource=key).delete()
        resource.delete()
        return Response(get_permission_catalog())


SIDEBAR_DEFAULT_LABELS = {
    "dashboard": "Inicio",
    "profile": "Mi perfil",
    "pets": "Mascotas",
    "vaccines": "Catálogo de vacunas",
    "requests": "Solicitudes",
    "adoptions": "Adopciones y cuidados",
    "messages": "Mensajes",
    "records": "Atención veterinaria",
    "veterinarians": "Perfiles veterinarios",
    "shelters": "Refugios y equipo",
    "notifications": "Notificaciones",
    "users": "Usuarios",
    "statistics": "Estadísticas",
    "permissions": "Permisos",
}


class SidebarLabelsSerializer(serializers.Serializer):
    labels = serializers.DictField(
        child=serializers.CharField(max_length=60, allow_blank=False, trim_whitespace=True)
    )

    def validate_labels(self, labels):
        unknown = set(labels) - set(SIDEBAR_DEFAULT_LABELS)
        if unknown:
            raise serializers.ValidationError(
                f"Vistas desconocidas: {', '.join(sorted(unknown))}."
            )
        return {key: value.strip() for key, value in labels.items()}


class SidebarLabelsView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get_permissions(self):
        if self.request.method == "PUT":
            return [IsAdminRole()]
        return super().get_permissions()

    @extend_schema(responses=OpenApiTypes.OBJECT, operation_id="sidebar_labels")
    def get(self, request):
        settings = PortalSettings.objects.filter(pk=1).first()
        return Response(
            {
                "defaults": SIDEBAR_DEFAULT_LABELS,
                "labels": {
                    **SIDEBAR_DEFAULT_LABELS,
                    **(settings.sidebar_labels if settings else {}),
                },
            }
        )

    @extend_schema(
        request=SidebarLabelsSerializer,
        responses=OpenApiTypes.OBJECT,
        operation_id="update_sidebar_labels",
    )
    def put(self, request):
        serializer = SidebarLabelsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        settings, _ = PortalSettings.objects.get_or_create(pk=1)
        settings.sidebar_labels = serializer.validated_data["labels"]
        settings.save(update_fields=("sidebar_labels",))
        return self.get(request)


class RolePermissionUpdateView(APIView):
    permission_classes = (RolePermissionRequired,)
    rbac_resource = "rolePermissions"
    rbac_required_action = "update"

    @extend_schema(
        request=RolePermissionSerializer(many=True),
        responses=OpenApiTypes.OBJECT,
        operation_id="replace_role_permissions",
    )
    def put(self, request, role_name):
        try:
            role = Role.objects.get(name=role_name)
        except Role.DoesNotExist as exc:
            raise ValidationError({"role": "El rol indicado no existe."}) from exc
        if (
            role.name == Role.Name.ADMIN
            and not request.user.is_platform_superadmin
        ):
            raise PermissionDenied(
                "No tienes autorización para modificar los permisos del rol administrador."
            )

        serializer = RolePermissionSerializer(data=request.data, many=True)
        serializer.is_valid(raise_exception=True)
        permissions_data = serializer.validated_data
        pairs = [(item["resource"], item["action"]) for item in permissions_data]
        if len(pairs) != len(set(pairs)):
            raise ValidationError(
                {"permissions": "No se permiten permisos duplicados."}
            )

        resource_actions = {
            resource["key"]: {action["key"] for action in resource["actions"]}
            for resource in get_permission_catalog()["resources"]
        }
        if any(
            item["resource"] not in resource_actions
            or item["action"] not in resource_actions[item["resource"]]
            for item in permissions_data
        ):
            raise ValidationError({"permissions": "Recurso o acción desconocidos."})
        required_admin_permissions = {
            ("users", "manage"),
            ("shelters", "verify"),
            ("rolePermissions", "manage"),
        }
        missing_admin_permissions = (
            required_admin_permissions.difference(pairs)
            if role.name == Role.Name.ADMIN
            and not request.user.is_platform_superadmin
            else set()
        )
        if missing_admin_permissions:
            raise ValidationError(
                {
                    "permissions": (
                        "El administrador debe conservar los permisos para gestionar "
                        "roles y permisos y verificar refugios."
                    )
                }
            )

        with transaction.atomic():
            RolePermission.objects.filter(role=role).delete()
            RolePermission.objects.bulk_create(
                [
                    RolePermission(role=role, **permission)
                    for permission in permissions_data
                ]
            )

        return Response(get_permission_catalog(), status=status.HTTP_200_OK)


class RoleListCreateView(APIView):
    permission_classes = (permissions.IsAuthenticated,)
    rbac_resource = "rolePermissions"
    rbac_required_action = "create"

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.IsAuthenticated()]
        return [RolePermissionRequired()]

    @extend_schema(responses=RoleDefinitionSerializer(many=True), operation_id="roles_list")
    def get(self, request):
        roles = Role.objects.order_by("id")
        return Response(RoleDefinitionSerializer(roles, many=True).data)

    @extend_schema(
        request=RoleDefinitionSerializer,
        responses=RoleDefinitionSerializer,
        operation_id="roles_create",
    )
    def post(self, request):
        serializer = RoleDefinitionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        role = serializer.save()
        return Response(
            RoleDefinitionSerializer(role).data,
            status=status.HTTP_201_CREATED,
        )


class RoleDetailView(APIView):
    permission_classes = (RolePermissionRequired,)
    rbac_resource = "rolePermissions"

    def get_role(self, pk):
        from django.shortcuts import get_object_or_404

        return get_object_or_404(Role, pk=pk)

    @extend_schema(
        request=RoleDefinitionSerializer,
        responses=RoleDefinitionSerializer,
        operation_id="roles_update",
    )
    def patch(self, request, pk):
        role = self.get_role(pk)
        if role.name in Role.Name.values:
            raise ValidationError({"role": "Los roles del sistema no se pueden editar."})
        serializer = RoleDefinitionSerializer(role, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        return Response(RoleDefinitionSerializer(serializer.save()).data)

    @extend_schema(operation_id="roles_delete", responses={204: None})
    def delete(self, request, pk):
        from django.shortcuts import get_object_or_404

        with transaction.atomic():
            role = get_object_or_404(Role.objects.select_for_update(), pk=pk)
            if role.name in Role.Name.values:
                raise ValidationError({"role": "Los roles del sistema no se pueden eliminar."})
            if role.users.exists():
                raise ValidationError(
                    {"role": "Reasigna o elimina las cuentas que usan este rol antes de eliminarlo."}
                )
            role.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class UserManagementBaseView(generics.GenericAPIView):
    permission_classes = (permissions.IsAuthenticated, RolePermissionRequired)
    rbac_resource = "users"
    serializer_class = UserAdminSerializer

    def get_queryset(self):
        return User.objects.select_related("role").order_by("id")

    def get_object(self, pk):
        from django.shortcuts import get_object_or_404

        return get_object_or_404(self.get_queryset(), pk=pk)


class UserListCreateView(UserManagementBaseView):
    @extend_schema(responses=UserAdminSerializer(many=True), operation_id="users_list")
    def get(self, request):
        return Response(self.get_serializer(self.get_queryset(), many=True).data)

    @extend_schema(
        request=UserAdminSerializer,
        responses=UserAdminSerializer,
        operation_id="users_create",
    )
    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

class UserDetailView(UserManagementBaseView):
    @extend_schema(responses=UserAdminSerializer, operation_id="users_retrieve")
    def get(self, request, pk):
        return Response(self.get_serializer(self.get_object(pk)).data)

    @extend_schema(
        request=UserAdminSerializer,
        responses=UserAdminSerializer,
        operation_id="users_update",
    )
    def patch(self, request, pk):
        user = self.get_object(pk)
        serializer = self.get_serializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        target_role = serializer.validated_data.get("role", user.role)
        if user.pk == request.user.pk and serializer.validated_data.get("active") is False:
            raise ValidationError({"active": "No puedes desactivar tu propia cuenta."})
        if (
            (user.is_platform_superadmin or user.role.name == Role.Name.ADMIN)
            and not request.user.is_platform_superadmin
        ):
            raise PermissionDenied(
                "No tienes autorización para administrar cuentas de administrador."
            )
        if user.is_platform_superadmin and (
            target_role.pk != user.role_id
            or serializer.validated_data.get("active") is False
        ):
            raise ValidationError(
                {"role": "Esta cuenta está protegida y no puede degradarse ni desactivarse."}
            )
        if (
            user.role.name == Role.Name.ADMIN
            and user.active
            and (
                target_role.name != Role.Name.ADMIN
                or serializer.validated_data.get("active") is False
            )
            and User.objects.filter(role__name=Role.Name.ADMIN, active=True).count() <= 1
        ):
            raise ValidationError(
                {"role": "No se puede desactivar ni degradar al último administrador activo."}
            )
        serializer.save()
        return Response(serializer.data)

    @extend_schema(operation_id="users_delete", responses={204: None})
    def delete(self, request, pk):
        user = self.get_object(pk)
        if (
            (user.is_platform_superadmin or user.role.name == Role.Name.ADMIN)
            and not request.user.is_platform_superadmin
        ):
            raise PermissionDenied(
                "No tienes autorización para eliminar cuentas de administrador."
            )
        if user.is_platform_superadmin:
            raise ValidationError("Esta cuenta está protegida y no se puede eliminar.")
        if user.pk == request.user.pk:
            raise ValidationError("No puedes eliminar tu propia cuenta.")
        if user.role.name == Role.Name.ADMIN and user.active and (
            User.objects.filter(role__name=Role.Name.ADMIN, active=True).count() <= 1
        ):
            raise ValidationError("No se puede eliminar al último administrador activo.")
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
