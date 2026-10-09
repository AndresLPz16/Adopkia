from django.conf import settings
from django.db import models
from django.db.models import Case, Value, When

from myproject.db_fields import EnumField, SQLDateTimeField, SQLTextField, TinyIntegerField
from pets.models import Pet
from users.models import User


class FormQuestion(models.Model):
    class AnswerType(models.TextChoices):
        TEXT = "texto", "Texto"
        NUMBER = "numero", "Número"
        YES_NO = "si_no", "Sí/No"
        OPTION = "opcion", "Opción"

    id = models.AutoField(primary_key=True, db_column="id_pregunta")
    prompt = models.CharField(max_length=300, db_column="enunciado")
    answer_type = EnumField(
        max_length=10, choices=AnswerType.choices, default=AnswerType.TEXT,
        db_column="tipo_respuesta"
    )
    required = models.BooleanField(default=True, db_column="obligatoria")
    order = models.SmallIntegerField(default=1, db_column="orden")
    active = models.BooleanField(default=True, db_column="activa")

    class Meta:
        db_table = "pregunta_formulario"
        ordering = ("order", "id")

    def __str__(self):
        return self.prompt


class AdoptionRequest(models.Model):
    class Status(models.TextChoices):
        PENDING = "pendiente", "Pendiente"
        APPROVED = "aprobada", "Aprobada"
        REJECTED = "rechazada", "Rechazada"
        CANCELLED = "cancelada", "Cancelada"

    id = models.AutoField(primary_key=True, db_column="id_solicitud")
    applicant = models.ForeignKey(
        User, on_delete=models.DO_NOTHING, related_name="adoption_requests",
        db_column="id_adoptante"
    )
    pet = models.ForeignKey(
        Pet, on_delete=models.DO_NOTHING, related_name="adoption_requests", db_column="id_mascota"
    )
    requested_at = SQLDateTimeField(auto_now_add=True, db_column="fecha_solicitud")
    status = EnumField(
        max_length=20, choices=Status.choices, default=Status.PENDING, db_column="estado"
    )
    responded_at = SQLDateTimeField(null=True, db_column="fecha_respuesta")
    shelter_notes = models.CharField(max_length=500, null=True, db_column="observaciones_refugio")
    pending_unique = models.GeneratedField(
        expression=Case(
            When(status=Status.PENDING, then=Value(1)),
            default=Value(None),
            output_field=TinyIntegerField(null=True),
        ),
        output_field=TinyIntegerField(null=True),
        db_persist=True,
        db_column="pendiente_unica",
    )

    class Meta:
        db_table = "solicitud_adopcion"
        ordering = ("-requested_at",)
        constraints = [
            models.UniqueConstraint(
                fields=("applicant", "pet", "pending_unique"),
                name="uq_solicitud_pendiente",
            )
        ]
        indexes = [models.Index(fields=("status",), name="idx_solicitud_estado")]

    def __str__(self):
        return f"Request {self.pk}: {self.applicant} - {self.pet}"


class FormAnswer(models.Model):
    pk = models.CompositePrimaryKey("request", "question")
    request = models.ForeignKey(
        AdoptionRequest, on_delete=models.CASCADE, related_name="answers",
        db_column="id_solicitud"
    )
    question = models.ForeignKey(
        FormQuestion, on_delete=models.DO_NOTHING, related_name="answers",
        db_column="id_pregunta"
    )
    value = SQLTextField(db_column="valor")

    class Meta:
        db_table = "respuesta"

    def __str__(self):
        return f"Answer {self.question_id} for request {self.request_id}"


class Adoption(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "activa", "Activa"
        RETURNED = "devuelta", "Devuelta"
        FINALIZED = "finalizada", "Finalizada"

    id = models.AutoField(primary_key=True, db_column="id_adopcion")
    request = models.OneToOneField(
        AdoptionRequest, on_delete=models.DO_NOTHING, related_name="adoption",
        db_column="id_solicitud"
    )
    adoption_date = models.DateField(db_column="fecha_adopcion")
    status = EnumField(
        max_length=20, choices=Status.choices, default=Status.ACTIVE, db_column="estado"
    )
    return_date = models.DateField(null=True, db_column="fecha_devolucion")
    return_reason = models.CharField(max_length=500, null=True, db_column="motivo_devolucion")

    class Meta:
        db_table = "adopcion"
        ordering = ("-adoption_date",)
        constraints = [
            models.CheckConstraint(
                condition=(
                    (
                        models.Q(status="devuelta")
                        & models.Q(return_date__isnull=False)
                        & models.Q(return_reason__isnull=False)
                        & models.Q(return_date__gte=models.F("adoption_date"))
                    )
                    | (
                        ~models.Q(status="devuelta")
                        & models.Q(return_date__isnull=True)
                        & models.Q(return_reason__isnull=True)
                    )
                ),
                name="ck_adopcion_devolucion",
            )
        ]
        indexes = [models.Index(fields=("status",), name="idx_adopcion_estado")]

    @property
    def pet(self):
        return self.request.pet

    @property
    def adopter(self):
        return self.request.applicant

    def __str__(self):
        return f"Adoption {self.pk} for {self.pet}"


class FollowUp(models.Model):
    class Wellbeing(models.TextChoices):
        EXCELLENT = "excelente", "Excelente"
        GOOD = "bueno", "Bueno"
        FAIR = "regular", "Regular"
        CONCERNING = "preocupante", "Preocupante"

    id = models.AutoField(primary_key=True, db_column="id_seguimiento")
    adoption = models.ForeignKey(
        Adoption, on_delete=models.CASCADE, related_name="follow_ups", db_column="id_adopcion"
    )
    registered_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name="registered_follow_ups",
        db_column="id_registrado_por"
    )
    date = models.DateField(db_column="fecha")
    wellbeing = EnumField(
        max_length=20, choices=Wellbeing.choices, default=Wellbeing.GOOD, db_column="bienestar"
    )
    observations = SQLTextField(null=True, db_column="observaciones")

    class Meta:
        db_table = "seguimiento"
        ordering = ("-date",)

    def __str__(self):
        return f"Follow-up for adoption {self.adoption_id} ({self.date})"
