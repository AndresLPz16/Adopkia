from django.db import transaction
from rest_framework import generics, permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import OpenApiTypes, extend_schema

from myproject.permissions import IsAdminRole

from .models import Role, RolePermission
from .rbac import ACTIONS, RESOURCES, get_permission_catalog
from .serializers import (
    RolePermissionSerializer,
    UserProfileSerializer,
    UserRegistrationSerializer,
)


class RegisterView(generics.CreateAPIView):
    serializer_class = UserRegistrationSerializer
    permission_classes = (permissions.AllowAny,)


class ProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserProfileSerializer

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
    permission_classes = (IsAdminRole,)

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
        if role.name == Role.Name.ADMIN and (
            "users",
            "manage",
        ) not in pairs:
            raise ValidationError(
                {
                    "permissions": (
                        "El administrador debe conservar el permiso para gestionar "
                        "roles y permisos."
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
