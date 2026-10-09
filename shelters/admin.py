from django.contrib import admin
from myproject.admin import ReadOnlyModelAdmin

from .models import Shelter, ShelterMember


@admin.register(Shelter)
class ShelterAdmin(ReadOnlyModelAdmin):
    list_display = ("name", "city", "verification_status", "verification_date")
    list_filter = ("verification_status", "city")
    search_fields = ("name", "city", "contact_email")


admin.site.register(ShelterMember, ReadOnlyModelAdmin)
