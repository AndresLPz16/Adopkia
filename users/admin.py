from django.contrib import admin

from myproject.admin import ReadOnlyModelAdmin

from .models import Role, User


@admin.register(User)
class UserAdmin(ReadOnlyModelAdmin):
    list_display = ("email", "name", "role", "active", "registered_at")
    list_filter = ("role", "active")
    search_fields = ("email", "name")


admin.site.register(Role, ReadOnlyModelAdmin)
