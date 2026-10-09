from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from myproject.i18n import LocalizedModelSerializer
from shelters.models import Shelter

from .models import Breed, Pet, PetPhoto, Species


class SpeciesSerializer(LocalizedModelSerializer):
    catalog_fields = ("name",)

    class Meta:
        model = Species
        fields = ("id", "name")


class BreedSerializer(LocalizedModelSerializer):
    species_name = serializers.CharField(source="species.name", read_only=True)
    catalog_fields = ("name", "species_name")

    class Meta:
        model = Breed
        fields = ("id", "species", "species_name", "name")


class PetPhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = PetPhoto
        fields = ("id", "pet", "url", "is_primary", "uploaded_at")
        read_only_fields = ("id", "uploaded_at")


class PetReadSerializer(LocalizedModelSerializer):
    choice_fields = ("size", "status")
    catalog_fields = ("species",)

    age = serializers.IntegerField(read_only=True, allow_null=True)
    photos = PetPhotoSerializer(many=True, read_only=True)
    city = serializers.CharField(source="shelter.city", read_only=True)
    species = serializers.CharField(source="breed.species.name", read_only=True)

    class Meta:
        model = Pet
        fields = (
            "id",
            "shelter",
            "city",
            "species",
            "breed",
            "name",
            "approximate_birth_date",
            "age",
            "size",
            "health",
            "temperament",
            "status",
            "published_at",
            "photos",
        )
        read_only_fields = ("id", "status", "published_at")


class PetWriteSerializer(LocalizedModelSerializer):
    class Meta:
        model = Pet
        fields = (
            "id",
            "shelter",
            "breed",
            "name",
            "approximate_birth_date",
            "size",
            "health",
            "temperament",
        )
        read_only_fields = ("id",)

    def to_internal_value(self, data):
        immutable_fields = {"id", "status", "published_at"}
        attempted = immutable_fields.intersection(data)
        if attempted:
            field = sorted(attempted)[0]
            raise serializers.ValidationError(
                {field: _("Este campo no se puede modificar directamente.")}
            )
        return super().to_internal_value(data)

    def validate(self, attrs):
        if (
            self.instance is not None
            and "shelter" in attrs
            and attrs["shelter"].pk != self.instance.shelter_id
        ):
            raise serializers.ValidationError(
                {"shelter": _("No se puede trasladar una mascota a otro refugio.")}
            )
        return attrs

    def validate_approximate_birth_date(self, value):
        if value and value > timezone.localdate():
            raise serializers.ValidationError(
                _("La fecha de nacimiento aproximada no puede estar en el futuro.")
            )
        return value

    def validate_shelter(self, shelter):
        if shelter.verification_status == Shelter.VerificationStatus.REJECTED:
            raise serializers.ValidationError(
                _("No se pueden publicar mascotas en un refugio rechazado.")
            )
        return shelter


class PetPhotoWriteSerializer(LocalizedModelSerializer):
    class Meta:
        model = PetPhoto
        fields = ("id", "pet", "url", "is_primary")
        read_only_fields = ("id",)
