from django.contrib.auth.password_validation import validate_password
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from .models import Role, User


class UserRegistrationSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(validators=[])
    role = serializers.SlugRelatedField(
        slug_field="name",
        queryset=Role.objects.filter(name__in=(Role.Name.ADOPTER, Role.Name.SHELTER)),
        required=False,
    )
    password = serializers.CharField(
        write_only=True,
        validators=[validate_password],
        max_length=255,
    )

    class Meta:
        model = User
        fields = ("id", "email", "password", "name", "phone", "role")
        read_only_fields = ("id",)
        extra_kwargs = {"phone": {"required": False, "allow_null": True}}

    def validate_email(self, email):
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError(_("Ya existe una cuenta registrada con este correo."))
        return email

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class UserProfileSerializer(serializers.ModelSerializer):
    role = serializers.SlugRelatedField(slug_field="name", read_only=True)

    def to_internal_value(self, data):
        immutable_fields = {"id", "email", "role", "active", "registered_at", "password"}
        attempted = immutable_fields.intersection(data)
        if attempted:
            field = sorted(attempted)[0]
            raise serializers.ValidationError(
                {field: _("Este campo no se puede modificar desde el perfil.")}
            )
        return super().to_internal_value(data)

    class Meta:
        model = User
        fields = ("id", "email", "name", "phone", "role", "active", "registered_at")
        read_only_fields = ("id", "email", "role", "active", "registered_at")
