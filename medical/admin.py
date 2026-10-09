from django.contrib import admin
from myproject.admin import ReadOnlyModelAdmin

from .models import MedicalRecord, Reminder, Vaccine, Veterinarian

admin.site.register(
    (Veterinarian, MedicalRecord, Vaccine, Reminder), ReadOnlyModelAdmin
)
