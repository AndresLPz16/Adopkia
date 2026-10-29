from django.contrib.auth.password_validation import validate_password
from django.core.validators import RegexValidator
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from .models import Role, RolePermission, User
from .rbac import ACTIONS, RESOURCES


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
        immutable_fields = {
            "id",
            "email",
            "role",
            "active",
            "is_platform_superadmin",
            "registered_at",
            "password",
        }
        attempted = immutable_fields.intersection(data)
        if attempted:
            field = sorted(attempted)[0]
            raise serializers.ValidationError(
                {field: _("Este campo no se puede modificar desde el perfil.")}
            )
        return super().to_internal_value(data)

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "name",
            "phone",
            "role",
            "active",
            "is_platform_superadmin",
            "registered_at",
        )
        read_only_fields = (
            "id",
            "email",
            "role",
            "active",
            "is_platform_superadmin",
            "registered_at",
        )


class UserAdminSerializer(serializers.ModelSerializer):
    role = serializers.SlugRelatedField(
        slug_field="name",
        queryset=Role.objects.all(),
    )
    password = serializers.CharField(
        write_only=True,
        required=False,
        validators=[validate_password],
        max_length=255,
    )

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "name",
            "phone",
            "role",
            "active",
            "is_platform_superadmin",
            "registered_at",
            "password",
        )
        read_only_fields = ("id", "is_platform_superadmin", "registered_at")
        extra_kwargs = {
            "email": {"validators": []},
            "active": {"required": False},
            "phone": {"required": False, "allow_null": True},
        }

    def get_fields(self):
        fields = super().get_fields()
        request = self.context.get("request")
        requester = getattr(request, "user", None)
        if not getattr(requester, "is_platform_superadmin", False):
            fields.pop("is_platform_superadmin", None)
        return fields

    def validate_email(self, email):
        matching = User.objects.filter(email__iexact=email)
        if self.instance is not None:
            matching = matching.exclude(pk=self.instance.pk)
        if matching.exists():
            raise serializers.ValidationError(
                _("Ya existe una cuenta registrada con este correo.")
            )
        return email

    def validate(self, attrs):
        if self.instance is None and not attrs.get("password"):
            raise serializers.ValidationError(
                {"password": _("La contraseña es obligatoria al crear una cuenta.")}
            )
        return attrs

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class RolePermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = RolePermission
        fields = ("resource", "action")

    def validate_resource(self, resource):
        if resource not in {key for key, _label in RESOURCES}:
            raise serializers.ValidationError("Recurso desconocido.")
        return resource

    def validate_action(self, action):
        if action not in {key for key, _label in ACTIONS}:
            raise serializers.ValidationError("Acción desconocida.")
        return action


class RoleDefinitionSerializer(serializers.ModelSerializer):
    name = serializers.CharField(
        max_length=30,
        validators=[
            RegexValidator(
                regex=r"^[a-z][a-z0-9_]{2,29}$",
                message="Usa un identificador en minúsculas, con letras, números o guion bajo.",
            )
        ],
    )
    label = serializers.CharField(max_length=60)
    description = serializers.CharField(
        max_length=150,
        required=False,
        allow_blank=True,
        allow_null=True,
    )

    class Meta:
        model = Role
        fields = ("id", "name", "label", "description")
        read_only_fields = ("id",)

    def validate_name(self, name):
        if name in Role.Name.values:
            raise serializers.ValidationError(
                "Ese identificador está reservado para un rol del sistema."
            )
        matching = Role.objects.filter(name=name)
        if self.instance is not None:
            matching = matching.exclude(pk=self.instance.pk)
        if matching.exists():
            raise serializers.ValidationError("Ya existe un rol con ese identificador.")
        return name
