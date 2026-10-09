from rest_framework.permissions import BasePermission
from django.utils.translation import gettext_lazy as _

from myproject.permissions import user_can_manage_shelter


class ShelterAccessPermission(BasePermission):
    message = _("No tienes permisos para gestionar este refugio.")

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        return user_can_manage_shelter(request.user, obj)
