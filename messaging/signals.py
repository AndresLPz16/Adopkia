from django.db.models import Case, IntegerField, Value, When
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import ValidationError

from notifications.models import Notification

from .models import Message


@receiver(post_save, sender=Message, dispatch_uid="messaging.notify_new_message")
def notify_new_message(sender, instance, created, raw=False, **kwargs):
    if raw or not created:
        return
    conversation = instance.conversation
    if instance.sender_id == conversation.adopter_id:
        recipient_id = (
            conversation.shelter.members.order_by(
                Case(
                    When(position="responsable", then=Value(0)),
                    default=Value(1),
                    output_field=IntegerField(),
                ),
                "id",
            )
            .values_list("user_id", flat=True)
            .first()
        )
        if recipient_id is None:
            raise ValidationError(
                {"conversation": _("El refugio debe tener un integrante para recibir mensajes.")}
            )
    else:
        recipient_id = conversation.adopter_id
    Notification.objects.create(
        user_id=recipient_id,
        notification_type=Notification.NotificationType.MESSAGE,
        message=f"Nuevo mensaje en una conversación sobre {conversation.shelter.name}.",
    )
