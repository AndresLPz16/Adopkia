from django.contrib import admin


class ReadOnlyModelAdmin(admin.ModelAdmin):
    def get_readonly_fields(self, request, obj=None):
        excluded = set(self.get_exclude(request, obj) or ())
        return tuple(
            field.name
            for field in (*self.model._meta.concrete_fields, *self.model._meta.many_to_many)
            if field.name not in excluded
        )

    def get_exclude(self, request, obj=None):
        field_names = {field.name for field in self.model._meta.fields}
        return tuple(name for name in ("password",) if name in field_names)

    def has_view_permission(self, request, obj=None):
        user = request.user
        return bool(user.is_authenticated and user.is_active and user.is_staff)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
