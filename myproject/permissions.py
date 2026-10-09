from rest_framework.permissions import BasePermission
from django.utils.translation import gettext_lazy as _


def user_can_manage_shelter(user, shelter):
    return bool(
        user
        and user.is_authenticated
        and (
            user.role.name == "administrador"
            or (
                user.role.name == "refugio"
                and shelter.members.filter(user_id=user.pk).exists()
            )
        )
    )


class IsAdminRole(BasePermission):
    message = _("Solo un administrador puede realizar esta acción.")

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role.name == "administrador")


class IsShelterMemberOrAdmin(BasePermission):
    message = _("No tienes permisos para gestionar este refugio.")

    def has_object_permission(self, request, view, obj):
        shelter = getattr(obj, "shelter", obj)
        return user_can_manage_shelter(request.user, shelter)
