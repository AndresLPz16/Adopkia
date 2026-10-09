from django.db import models

from myproject.db_fields import EnumField, SQLDateTimeField
from users.models import User


class Shelter(models.Model):
    class VerificationStatus(models.TextChoices):
        PENDING = "pendiente", "Pendiente"
        VERIFIED = "verificado", "Verificado"
        REJECTED = "rechazado", "Rechazado"

    id = models.AutoField(primary_key=True, db_column="id_refugio")
    name = models.CharField(max_length=120, db_column="nombre")
    address = models.CharField(max_length=200, db_column="direccion")
    city = models.CharField(max_length=80, db_column="ciudad")
    contact_phone = models.CharField(max_length=20, null=True, db_column="telefono_contacto")
    contact_email = models.EmailField(max_length=150, null=True, db_column="correo_contacto")
    verification_status = EnumField(
        max_length=20,
        choices=VerificationStatus.choices,
        default=VerificationStatus.PENDING,
        db_column="estado_verificacion",
    )
    verification_date = SQLDateTimeField(null=True, db_column="fecha_verificacion")
    verified_by = models.ForeignKey(
        User,
        on_delete=models.DO_NOTHING,
        null=True,
        related_name="verified_shelters",
        db_column="id_admin_verificador",
    )
    registered_at = SQLDateTimeField(auto_now_add=True, db_column="fecha_registro")

    class Meta:
        db_table = "refugio"
        constraints = [
            models.UniqueConstraint(fields=("name", "city"), name="uq_refugio_nombre_ciudad"),
            models.CheckConstraint(
                condition=(
                    ~models.Q(verification_status="verificado")
                    | (
                        models.Q(verification_date__isnull=False)
                        & models.Q(verified_by__isnull=False)
                    )
                ),
                name="ck_refugio_verificacion",
            ),
        ]
        indexes = [models.Index(fields=("city",), name="idx_refugio_ciudad")]

    def __str__(self):
        return self.name


class ShelterMember(models.Model):
    class Position(models.TextChoices):
        MANAGER = "responsable", "Responsable"
        COLLABORATOR = "colaborador", "Colaborador"

    id = models.AutoField(primary_key=True, db_column="id_miembro")
    shelter = models.ForeignKey(
        Shelter, on_delete=models.CASCADE, related_name="members", db_column="id_refugio"
    )
    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="shelter_membership", db_column="id_usuario"
    )
    position = EnumField(
        max_length=20,
        choices=Position.choices,
        default=Position.COLLABORATOR,
        db_column="cargo",
    )

    class Meta:
        db_table = "miembro_refugio"

    def __str__(self):
        return f"{self.user} - {self.shelter}"
