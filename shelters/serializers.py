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
    user = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())

    class Meta:
        model = ShelterMember
        fields = ("user", "position")

    def validate_user(self, user):
        if user.role.name != Role.Name.SHELTER:
            raise serializers.ValidationError(_("El integrante debe tener rol de refugio."))
        return user
