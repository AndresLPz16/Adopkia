from django.utils.translation import gettext as _
from rest_framework import serializers

from myproject.i18n import LocalizedModelSerializer
from .models import Notification


class NotificationSerializer(LocalizedModelSerializer):
    choice_fields = ("notification_type",)

    class Meta:
        model = Notification
        fields = (
            "id",
            "user",
            "request",
            "reminder",
            "notification_type",
            "message",
            "sent_at",
            "is_read",
        )
        read_only_fields = (
            "id",
            "user",
            "request",
            "reminder",
            "notification_type",
            "message",
            "sent_at",
        )

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        message = None
        if instance.notification_type == Notification.NotificationType.NEW_REQUEST:
            if instance.request_id:
                message = _("Nueva solicitud de adopción para %(pet)s.") % {
                    "pet": instance.request.pet.name
                }
            else:
                message = _("Nueva solicitud de adopción.")
        elif instance.notification_type == Notification.NotificationType.APPROVAL:
            message = _("Tu solicitud de adopción fue aprobada.")
        elif instance.notification_type == Notification.NotificationType.REJECTION:
            message = _("Tu solicitud de adopción fue rechazada.")
        elif instance.notification_type == Notification.NotificationType.REMINDER:
            if instance.reminder_id:
                reminder = instance.reminder
                message = _("Recordatorio: %(type)s para %(pet)s el %(date)s.") % {
                    "type": _(reminder.get_reminder_type_display()),
                    "pet": reminder.pet.name,
                    "date": reminder.scheduled_date,
                }
            else:
                message = _("Tienes un recordatorio pendiente.")
        elif instance.notification_type == Notification.NotificationType.MESSAGE:
            shelter_name = instance.message.partition(
                "Nuevo mensaje en una conversación sobre "
            )[2].rstrip(".")
            message = _("Nuevo mensaje en una conversación sobre %(shelter)s.") % {
                "shelter": shelter_name
            } if shelter_name else _("Tienes un mensaje nuevo.")
        elif instance.notification_type == Notification.NotificationType.SYSTEM:
            message = _(instance.message)
        if message is not None:
            representation["message"] = str(message)
        return representation
