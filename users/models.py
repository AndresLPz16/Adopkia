import uuid

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from myproject.db_fields import (
    SQLDateTimeField,
    TinyAutoField,
)


class Role(models.Model):
    class Name(models.TextChoices):
        ADOPTER = "adoptante", "Adoptante"
        SHELTER = "refugio", "Refugio"
        ADMIN = "administrador", "Administrador"
        VETERINARIAN = "veterinario", "Veterinario"

    id = TinyAutoField(primary_key=True, db_column="id_rol")
    name = models.CharField(max_length=30, unique=True, db_column="nombre")
    label = models.CharField(max_length=60, null=True, blank=True, db_column="etiqueta")
    description = models.CharField(max_length=150, null=True, db_column="descripcion")

    class Meta:
        db_table = "rol"
        ordering = ("id",)

    def __str__(self):
        return self.name


class RolePermission(models.Model):
    id = models.BigAutoField(primary_key=True, db_column="id_permiso")
    role = models.ForeignKey(
        Role,
        on_delete=models.CASCADE,
        related_name="permissions",
        db_column="id_rol",
    )
    resource = models.CharField(max_length=40, db_column="recurso")
    action = models.CharField(max_length=20, db_column="accion")

    class Meta:
        db_table = "permiso_rol"
        constraints = [
            models.UniqueConstraint(
                fields=("role", "resource", "action"),
                name="uq_permiso_rol_recurso_accion",
            )
        ]
        ordering = ("resource", "action")

    def __str__(self):
        return f"{self.role.name}:{self.resource}:{self.action}"


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError(_("El correo electrónico es obligatorio."))
        email = self.normalize_email(email)
        username = extra_fields.get("username")
        if not username:
            base = email.split("@", 1)[0].lower()
            normalized = "".join(
                character if character.isalnum() or character in "._-" else "_"
                for character in base
            ).strip("._-")
            base = (normalized or "usuario")[:24]
            username = base
            suffix = 1
            while User.objects.filter(username__iexact=username).exists():
                username = f"{base[:24 - len(str(suffix))]}{suffix}"
                suffix += 1
            extra_fields["username"] = username
        extra_fields.setdefault("email_verified", True)
        role = extra_fields.pop("role", None)
        if role is None:
            role = Role.objects.get(name=Role.Name.ADOPTER)
        elif isinstance(role, str):
            role = Role.objects.get(name=role)
        user = self.model(email=email, role=role, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("active", True)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        role = extra_fields.pop("role", Role.Name.ADMIN)
        role_name = role.name if isinstance(role, Role) else role
        if role_name != Role.Name.ADMIN:
            raise ValueError(_("Un superusuario debe tener el rol administrador."))
        extra_fields["role"] = Role.objects.get(name=Role.Name.ADMIN)
        extra_fields.setdefault("active", True)
        return self._create_user(email, password, **extra_fields)


class User(AbstractBaseUser):
    class Role:
        ADOPTER = "adoptante"
        SHELTER = "refugio"
        ADMIN = "administrador"
        VET = "veterinario"

    id = models.AutoField(primary_key=True, db_column="id_usuario")
    last_login = None
    password = models.CharField(max_length=255, db_column="contrasena_hash")
    role = models.ForeignKey(
        "users.Role",
        on_delete=models.PROTECT,
        related_name="users",
        db_column="id_rol",
    )
    name = models.CharField(max_length=100, db_column="nombre")
    username = models.CharField(max_length=30, unique=True, db_column="nombre_usuario")
    email = models.EmailField(max_length=150, unique=True, db_column="correo")
    email_verified = models.BooleanField(default=False, db_column="correo_verificado")
    phone = models.CharField(max_length=20, null=True, db_column="telefono")
    active = models.BooleanField(default=True, db_column="activo")
    is_platform_superadmin = models.BooleanField(
        default=False,
        db_column="es_superadministrador",
    )
    registered_at = SQLDateTimeField(auto_now_add=True, db_column="fecha_registro")

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["name"]

    objects = UserManager()

    class Meta:
        db_table = "usuario"

    @property
    def is_active(self):
        return self.active

    @property
    def is_staff(self):
        return self.role.name == Role.Name.ADMIN

    @property
    def is_superuser(self):
        return self.role.name == Role.Name.ADMIN

    def has_perm(self, perm, obj=None):
        return self.is_active and self.is_superuser

    def has_module_perms(self, app_label):
        return self.is_active and self.is_superuser

    @property
    def role_name(self):
        return self.role.name

    def __str__(self):
        return self.email


class EmailVerificationCode(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="email_verification_code",
        db_column="id_usuario",
    )
    code_hash = models.CharField(max_length=64, db_column="codigo_hash")
    expires_at = models.DateTimeField(db_column="expira_en")
    failed_attempts = models.PositiveSmallIntegerField(default=0, db_column="intentos_fallidos")
    sent_at = models.DateTimeField(default=timezone.now, db_column="enviado_en")

    class Meta:
        db_table = "codigo_verificacion_correo"


class LoginMathChallenge(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, db_column="id_reto")
    answer_hash = models.CharField(max_length=64, db_column="respuesta_hash")
    expires_at = models.DateTimeField(db_column="expira_en")

    class Meta:
        db_table = "reto_matematico_login"
