from django.contrib import admin
from myproject.admin import ReadOnlyModelAdmin

from .models import Breed, Pet, PetPhoto, Species


@admin.register(Pet)
class PetAdmin(ReadOnlyModelAdmin):
    list_display = ("name", "breed", "shelter", "status")
    list_filter = ("status", "breed__species", "size")
    search_fields = ("name", "shelter__name", "breed__name")


admin.site.register((Species, Breed, PetPhoto), ReadOnlyModelAdmin)
