from django.db import transaction
from django.utils import timezone
from django.utils.crypto import constant_time_compare, salted_hmac
from rest_framework import generics, permissions, serializers, status
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import OpenApiTypes, extend_schema

from myproject.permissions import IsAdminRole, RolePermissionRequired

from .models import EmailVerificationCode, LoginMathChallenge, Role, RolePermission, User
from .rbac import ACTIONS, RESOURCES, get_permission_catalog
from .serializers import (
    RoleDefinitionSerializer,
    RolePermissionSerializer,
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

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.IsAuthenticated()]
        return super().get_permissions()

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


class RolePermissionUpdateView(APIView):
    permission_classes = (IsAdminRole, RolePermissionRequired)
    rbac_resource = "users"
    rbac_required_action = "manage"

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

        valid_resources = {resource for resource, _label in RESOURCES}
        valid_actions = {action for action, _label in ACTIONS}
        if any(
            item["resource"] not in valid_resources
            or item["action"] not in valid_actions
            for item in permissions_data
        ):
            raise ValidationError({"permissions": "Recurso o acción desconocidos."})
        required_admin_permissions = {
            ("users", "manage"),
            ("shelters", "verify"),
        }
        missing_admin_permissions = (
            required_admin_permissions.difference(pairs)
            if role.name == Role.Name.ADMIN
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
    rbac_resource = "users"
    rbac_required_action = "manage"

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.IsAuthenticated()]
        return [permission() for permission in (IsAdminRole, RolePermissionRequired)]

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
    permission_classes = (IsAdminRole, RolePermissionRequired)
    rbac_resource = "users"
    rbac_required_action = "manage"

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
        target_role = serializer.validated_data["role"]
        if (
            target_role.name == Role.Name.ADMIN
            and not request.user.is_platform_superadmin
        ):
            raise PermissionDenied(
                "No tienes autorización para crear cuentas de administrador."
            )
        if (
            target_role.name not in (Role.Name.ADOPTER, Role.Name.SHELTER)
            and request.user.role.name != Role.Name.ADMIN
            and not request.user.is_platform_superadmin
        ):
            raise PermissionDenied(
                "Solo un administrador puede asignar roles veterinarios, administrativos o personalizados."
            )
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
            (user.is_platform_superadmin or user.role.name == Role.Name.ADMIN
             or target_role.name == Role.Name.ADMIN)
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
            target_role.pk != user.role_id
            and request.user.role.name != Role.Name.ADMIN
            and not request.user.is_platform_superadmin
        ):
            raise PermissionDenied(
                "Solo un administrador puede cambiar el rol de una cuenta."
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
