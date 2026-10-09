from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from myproject.i18n import LocalizedModelSerializer

from .models import MedicalRecord, Reminder, Vaccine, Veterinarian


class VeterinarianSerializer(LocalizedModelSerializer):
    user = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Veterinarian
        fields = ("id", "user", "professional_card", "clinic", "specialty")
        read_only_fields = ("id", "user")


class MedicalRecordSerializer(LocalizedModelSerializer):
    choice_fields = ("record_type",)

    veterinarian_name = serializers.CharField(
        source="veterinarian.user.name", read_only=True, allow_null=True
    )

    class Meta:
        model = MedicalRecord
        fields = (
            "id",
            "pet",
            "veterinarian",
            "veterinarian_name",
            "vaccine",
            "date",
            "record_type",
            "description",
        )
        read_only_fields = ("id", "veterinarian_name")

    def validate(self, attrs):
        vaccine = attrs.get("vaccine", getattr(self.instance, "vaccine", None))
        record_type = attrs.get("record_type", getattr(self.instance, "record_type", None))
        if vaccine and record_type != MedicalRecord.RecordType.VACCINATION:
            raise serializers.ValidationError(
                {"vaccine": _("Solo se puede asociar una vacuna a un registro de tipo vacunación.")}
            )
        return attrs


class VaccineSerializer(LocalizedModelSerializer):
    species_name = serializers.CharField(source="species.name", read_only=True)
    catalog_fields = ("name", "species_name", "description")

    class Meta:
        model = Vaccine
        fields = ("id", "species", "species_name", "name", "description", "booster_interval_days")
        read_only_fields = fields


class ReminderSerializer(LocalizedModelSerializer):
    choice_fields = ("reminder_type", "status")
    catalog_fields = ("vaccine_name",)
    adopter = serializers.IntegerField(source="adoption.request.applicant_id", read_only=True)
    pet = serializers.IntegerField(source="adoption.request.pet_id", read_only=True)
    vaccine_name = serializers.CharField(source="vaccine.name", read_only=True, allow_null=True)

    class Meta:
        model = Reminder
        fields = (
            "id",
            "adoption",
            "adopter",
            "pet",
            "vaccine",
            "vaccine_name",
            "medical_record",
            "reminder_type",
            "scheduled_date",
            "status",
        )
        read_only_fields = ("id", "adopter", "pet", "vaccine_name")

    def validate(self, attrs):
        reminder_type = attrs.get("reminder_type", getattr(self.instance, "reminder_type", None))
        vaccine = attrs.get("vaccine", getattr(self.instance, "vaccine", None))
        if vaccine and reminder_type != Reminder.ReminderType.VACCINE:
            raise serializers.ValidationError(
                {"vaccine": _("Solo los recordatorios de vacuna pueden tener una vacuna asociada.")}
            )
        return attrs
