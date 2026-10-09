from django.db import models

from myproject.db_fields import SQLDateTimeField, SQLTextField
from pets.models import Pet
from shelters.models import Shelter
from users.models import User


class Conversation(models.Model):
    id = models.AutoField(primary_key=True, db_column="id_conversacion")
    adopter = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="conversations", db_column="id_adoptante"
    )
    shelter = models.ForeignKey(
        Shelter, on_delete=models.CASCADE, related_name="conversations", db_column="id_refugio"
    )
    pet = models.ForeignKey(
        Pet, on_delete=models.SET_NULL, null=True, related_name="conversations",
        db_column="id_mascota"
    )
    started_at = SQLDateTimeField(auto_now_add=True, db_column="fecha_inicio")

    class Meta:
        db_table = "conversacion"
        ordering = ("-started_at",)

    def __str__(self):
        return f"Conversation {self.pk}: {self.adopter} - {self.shelter}"


class Message(models.Model):
    id = models.AutoField(primary_key=True, db_column="id_mensaje")
    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name="messages",
        db_column="id_conversacion"
    )
    sender = models.ForeignKey(
        User, on_delete=models.DO_NOTHING, related_name="sent_messages",
        db_column="id_remitente"
    )
    content = SQLTextField(db_column="contenido")
    sent_at = SQLDateTimeField(auto_now_add=True, db_column="fecha_envio")
    is_read = models.BooleanField(default=False, db_column="leido")

    class Meta:
        db_table = "mensaje"
        ordering = ("sent_at",)
        indexes = [
            models.Index(
                fields=("conversation", "sent_at"), name="idx_mensaje_conv_fecha"
            )
        ]

    def __str__(self):
        return f"Message {self.pk} in conversation {self.conversation_id}"
