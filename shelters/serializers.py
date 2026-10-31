from django.utils.translation import gettext_lazy as _
from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field

from myproject.i18n import LocalizedModelSerializer
from .models import Shelter, ShelterMember
from users.models import Role, User


class PublicShelterSerializer(serializers.ModelSerializer):
    description = serializers.SerializerMethodField()

    class Meta:
        model = Shelter
        fields = ("name", "city", "description")

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_description(self, obj) -> str | None:
        return None


class ShelterSerializer(LocalizedModelSerializer):
    choice_fields = ("verification_status",)

    class Meta:
        model = Shelter
        fields = (
            "id",
            "name",
            "address",
            "city",
            "contact_phone",
            "contact_email",
            "verification_status",
            "verification_date",
            "verified_by",
            "registered_at",
        )
        read_only_fields = ("id", "verification_status", "verification_date", "verified_by", "registered_at")


class ShelterMemberSerializer(LocalizedModelSerializer):
    choice_fields = ("position",)

    class Meta:
        model = ShelterMember
        fields = ("id", "shelter", "user", "position")
        read_only_fields = ("id", "shelter", "user")


class ShelterMemberCreateSerializer(LocalizedModelSerializer):
    email = serializers.EmailField(write_only=True)

    class Meta:
        model = ShelterMember
        fields = ("email", "position")

    def validate_email(self, email):
        user = User.objects.filter(email__iexact=email).first()
        if user is None:
            raise serializers.ValidationError(
                _("No existe una cuenta con ese correo electrónico.")
            )
        if user.role.name != Role.Name.SHELTER:
            raise serializers.ValidationError(
                _("La cuenta debe tener rol de refugio.")
            )
        if ShelterMember.objects.filter(user=user).exists():
            raise serializers.ValidationError(
                _("La cuenta ya pertenece a un refugio.")
            )
        return user

    def create(self, validated_data):
        user = validated_data.pop("email")
        return ShelterMember.objects.create(user=user, **validated_data)
