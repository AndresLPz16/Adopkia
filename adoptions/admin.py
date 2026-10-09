from django.contrib import admin
from myproject.admin import ReadOnlyModelAdmin

from .models import Adoption, AdoptionRequest, FormQuestion, FollowUp


@admin.register(AdoptionRequest)
class AdoptionRequestAdmin(ReadOnlyModelAdmin):
    list_display = ("id", "applicant", "pet", "status", "requested_at")
    list_filter = ("status",)
    search_fields = ("applicant__email", "pet__name")


admin.site.register((Adoption, FormQuestion, FollowUp), ReadOnlyModelAdmin)
