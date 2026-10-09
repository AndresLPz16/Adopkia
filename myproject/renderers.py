from rest_framework.renderers import BrowsableAPIRenderer

from users.models import Role


class RoleAwareBrowsableAPIRenderer(BrowsableAPIRenderer):
    def show_form_for_method(self, view, method, request, obj):
        if (
            method == "POST"
            and request.path.rstrip("/") == "/api/v1/pets"
            and request.user.is_authenticated
        ):
            if request.user.role.name == Role.Name.ADMIN:
                return super().show_form_for_method(view, method, request, obj)
            if (
                request.user.role.name != Role.Name.SHELTER
                or not getattr(request.user, "shelter_membership", None)
            ):
                return False
        return super().show_form_for_method(view, method, request, obj)
