from rest_framework.permissions import BasePermission
from django.utils.translation import gettext_lazy as _

from users.models import RolePermission


HTTP_ACTIONS = {
    "GET": "read",
    "HEAD": "read",
    "OPTIONS": "read",
    "POST": "create",
    "PUT": "update",
    "PATCH": "update",
    "DELETE": "delete",
}

VIEW_ACTIONS = {
    "approve": "approve",
    "reject": "reject",
    "verify": "verify",
    "cancel": "update",
    "return_adoption": "return",
    "relist": "update",
    "mark_read": "update",
}


def user_has_role_permission(user, resource, action):
    if not user or not user.is_authenticated or not user.is_active:
        return False
    if user.is_platform_superadmin:
        return True
    grants = RolePermission.objects.filter(
        role_id=user.role_id,
        resource=resource,
    )
    return grants.filter(action__in=(action, "manage")).exists()


class RolePermissionRequired(BasePermission):
    message = _("Tu rol no tiene permiso para realizar esta acción.")

    def has_permission(self, request, view):
        action_name = getattr(view, "action", None)
        resource = getattr(view, "rbac_action_resources", {}).get(
            action_name,
            getattr(view, "rbac_resource", None),
        )
        if resource is None:
            return True

        action = getattr(view, "rbac_required_action", None) or VIEW_ACTIONS.get(
            action_name,
            HTTP_ACTIONS.get(request.method),
        )
        if action is None:
            return False

        if action == "read" and getattr(view, "rbac_allow_anonymous_read", False):
            return True
        return user_has_role_permission(request.user, resource, action)


def user_can_manage_shelter(user, shelter):
    return bool(
        user
        and user.is_authenticated
        and (
            user.role.name == "administrador"
            or user.is_platform_superadmin
            or shelter.members.filter(user_id=user.pk).exists()
        )
    )


class IsAdminRole(BasePermission):
    message = _("Solo un administrador puede realizar esta acción.")

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (user.role.name == "administrador" or user.is_platform_superadmin)
        )


class IsShelterMemberOrAdmin(BasePermission):
    message = _("No tienes permisos para gestionar este refugio.")

    def has_object_permission(self, request, view, obj):
        shelter = getattr(obj, "shelter", obj)
        return user_can_manage_shelter(request.user, shelter)
