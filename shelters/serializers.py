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
    verification_status_code = serializers.CharField(source="verification_status", read_only=True)

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
            "verification_status_code",
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
    """Agrega un integrante por el correo de su cuenta (o por su id)."""

    email = serializers.EmailField(write_only=True, required=False)
    user = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), required=False)

    class Meta:
        model = ShelterMember
        fields = ("email", "user", "position")

    def validate(self, attrs):
        email = attrs.pop("email", None)
        user = attrs.get("user")
        if email:
            # El mismo mensaje para un correo inexistente y para una cuenta de
            # otro rol: el formulario no revela qué tipo de cuenta tiene un correo.
            user = User.objects.filter(
                email__iexact=email, role__name=Role.Name.SHELTER
            ).first()
            if user is None:
                raise serializers.ValidationError(
                    {"email": _("No hay una cuenta de refugio con ese correo.")}
                )
            attrs["user"] = user
        elif user is None:
            raise serializers.ValidationError(
                {"email": _("Indica el correo de la cuenta que quieres agregar.")}
            )
        elif user.role.name != Role.Name.SHELTER:
            raise serializers.ValidationError(
                {"user": _("El integrante debe tener rol de refugio.")}
            )
        if ShelterMember.objects.filter(user=user).exists():
            field = "email" if email else "user"
            raise serializers.ValidationError(
                {field: _("Esa cuenta ya pertenece a un refugio.")}
            )
        return attrs
