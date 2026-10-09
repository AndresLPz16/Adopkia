from django.db import models

from myproject.db_fields import EnumField, SQLTextField
from pets.models import Pet, Species
from users.models import User
from adoptions.models import Adoption


class Veterinarian(models.Model):
    id = models.AutoField(primary_key=True, db_column="id_veterinario")
    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="veterinarian_profile", db_column="id_usuario"
    )
    professional_card = models.CharField(
        max_length=30, unique=True, db_column="tarjeta_profesional"
    )
    clinic = models.CharField(max_length=120, null=True, db_column="clinica")
    specialty = models.CharField(max_length=80, null=True, db_column="especialidad")

    class Meta:
        db_table = "veterinario"

    def __str__(self):
        return self.user.name


class Vaccine(models.Model):
    id = models.AutoField(primary_key=True, db_column="id_vacuna")
    species = models.ForeignKey(
        Species, on_delete=models.DO_NOTHING, related_name="vaccines", db_column="id_especie"
    )
    name = models.CharField(max_length=100, db_column="nombre")
    description = models.CharField(max_length=255, null=True, db_column="descripcion")
    booster_interval_days = models.SmallIntegerField(
        null=True, db_column="intervalo_refuerzo_dias"
    )

    class Meta:
        db_table = "vacuna"
        constraints = [
            models.UniqueConstraint(fields=("species", "name"), name="uq_vacuna_especie_nombre")
        ]

    def __str__(self):
        return self.name


class MedicalRecord(models.Model):
    class RecordType(models.TextChoices):
        CONSULTATION = "consulta", "Consulta"
        VACCINATION = "vacunacion", "Vacunación"
        DEWORMING = "desparasitacion", "Desparasitación"
        SURGERY = "cirugia", "Cirugía"
        CHECKUP = "control", "Control"
        OTHER = "otro", "Otro"

    id = models.AutoField(primary_key=True, db_column="id_historial")
    pet = models.ForeignKey(
        Pet, on_delete=models.CASCADE, related_name="medical_records", db_column="id_mascota"
    )
    veterinarian = models.ForeignKey(
        Veterinarian, on_delete=models.SET_NULL, null=True, related_name="medical_records",
        db_column="id_veterinario"
    )
    vaccine = models.ForeignKey(
        Vaccine, on_delete=models.DO_NOTHING, null=True, related_name="medical_records",
        db_column="id_vacuna"
    )
    date = models.DateField(db_column="fecha")
    record_type = EnumField(max_length=20, choices=RecordType.choices, db_column="tipo")
    description = SQLTextField(null=True, db_column="descripcion")

    class Meta:
        db_table = "historial_medico"
        ordering = ("-date",)
        constraints = [
            models.CheckConstraint(
                condition=models.Q(vaccine__isnull=True)
                | models.Q(record_type="vacunacion"),
                name="ck_historial_vacuna",
            )
        ]
        indexes = [models.Index(fields=("date",), name="idx_historial_fecha")]

    def __str__(self):
        return f"{self.record_type} for {self.pet} on {self.date}"


class Reminder(models.Model):
    class ReminderType(models.TextChoices):
        VACCINE = "vacuna", "Vacuna"
        VETERINARY_CHECKUP = "control_veterinario", "Control veterinario"
        CHECKIN = "checkin", "Seguimiento"

    class Status(models.TextChoices):
        PENDING = "pendiente", "Pendiente"
        NOTIFIED = "notificado", "Notificado"
        COMPLETED = "cumplido", "Cumplido"
        OVERDUE = "vencido", "Vencido"
        CANCELLED = "cancelado", "Cancelado"

    id = models.AutoField(primary_key=True, db_column="id_recordatorio")
    adoption = models.ForeignKey(
        Adoption, on_delete=models.CASCADE, related_name="reminders", db_column="id_adopcion"
    )
    vaccine = models.ForeignKey(
        Vaccine, on_delete=models.DO_NOTHING, null=True, related_name="reminders",
        db_column="id_vacuna"
    )
    medical_record = models.ForeignKey(
        MedicalRecord, on_delete=models.SET_NULL, null=True, related_name="reminders",
        db_column="id_historial"
    )
    reminder_type = EnumField(
        max_length=25, choices=ReminderType.choices, db_column="tipo"
    )
    scheduled_date = models.DateField(db_column="fecha_programada")
    status = EnumField(
        max_length=20, choices=Status.choices, default=Status.PENDING, db_column="estado"
    )

    class Meta:
        db_table = "recordatorio"
        ordering = ("scheduled_date",)
        constraints = [
            models.CheckConstraint(
                condition=models.Q(vaccine__isnull=True)
                | models.Q(reminder_type="vacuna"),
                name="ck_recordatorio_vacuna",
            )
        ]
        indexes = [
            models.Index(
                fields=("scheduled_date", "status"),
                name="idx_recordatorio_fecha_estado",
            )
        ]

    @property
    def pet(self):
        return self.adoption.request.pet

    def __str__(self):
        return f"{self.reminder_type} for adoption {self.adoption_id}"
