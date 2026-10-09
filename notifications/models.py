from django.db import models

from myproject.db_fields import EnumField, SQLDateTimeField
from adoptions.models import AdoptionRequest
from medical.models import Reminder
from users.models import User


class Notification(models.Model):
    class NotificationType(models.TextChoices):
        NEW_REQUEST = "nueva_solicitud", "Nueva solicitud"
        APPROVAL = "aprobacion", "Aprobación"
        REJECTION = "rechazo", "Rechazo"
        REMINDER = "recordatorio", "Recordatorio"
        MESSAGE = "mensaje", "Mensaje"
        SYSTEM = "sistema", "Sistema"

    id = models.AutoField(primary_key=True, db_column="id_notificacion")
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="notifications", db_column="id_usuario"
    )
    request = models.ForeignKey(
        AdoptionRequest, on_delete=models.SET_NULL, null=True, related_name="notifications",
        db_column="id_solicitud"
    )
    reminder = models.ForeignKey(
        Reminder, on_delete=models.SET_NULL, null=True, related_name="notifications",
        db_column="id_recordatorio"
    )
    notification_type = EnumField(
        max_length=20, choices=NotificationType.choices, db_column="tipo"
    )
    message = models.CharField(max_length=500, db_column="mensaje")
    sent_at = SQLDateTimeField(auto_now_add=True, db_column="fecha_envio")
    is_read = models.BooleanField(default=False, db_column="leida")

    class Meta:
        db_table = "notificacion"
        ordering = ("-sent_at",)
        indexes = [models.Index(fields=("user", "is_read"), name="idx_notif_usuario_leida")]

    def __str__(self):
        return f"Notification for {self.user}"
