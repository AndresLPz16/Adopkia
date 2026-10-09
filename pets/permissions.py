from rest_framework.permissions import BasePermission, SAFE_METHODS
from django.utils.translation import gettext_lazy as _

from myproject.permissions import user_can_manage_shelter


class PetAccessPermission(BasePermission):
    message = _("No tienes permisos para gestionar esta mascota.")

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        pet = getattr(obj, "pet", obj)
        return user_can_manage_shelter(request.user, pet.shelter)
