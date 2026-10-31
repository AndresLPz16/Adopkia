from django.db.models.signals import post_save, pre_save
from django.db.models import Case, IntegerField, Value, When
from django.dispatch import receiver
from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import ValidationError

from notifications.models import Notification

from .models import AdoptionRequest


def _shelter_notification_recipients(adoption_request):
    shelter_members = adoption_request.pet.shelter.members.order_by(
        Case(
            When(position="responsable", then=Value(0)),
            default=Value(1),
            output_field=IntegerField(),
        ),
        "id",
    )
    user_ids = list(shelter_members.values_list("user_id", flat=True))
    if not user_ids:
        raise ValidationError(
            {"pet": _("El refugio debe tener un integrante para recibir notificaciones.")}
        )
    return user_ids


def _notify_shelter_members(adoption_request, notification_type, message):
    Notification.objects.bulk_create(
        [
            Notification(
                user_id=user_id,
                request=adoption_request,
                notification_type=notification_type,
                message=message,
            )
            for user_id in _shelter_notification_recipients(adoption_request)
        ]
    )


@receiver(pre_save, sender=AdoptionRequest, dispatch_uid="adoptions.remember_request_status")
def remember_previous_status(sender, instance, raw=False, **kwargs):
    if raw:
        return
    if not instance.pk:
        instance._previous_status = None
        return
    instance._previous_status = (
        sender.objects.filter(pk=instance.pk).values_list("status", flat=True).first()
    )


@receiver(post_save, sender=AdoptionRequest, dispatch_uid="adoptions.notify_request_changes")
def notify_request_changes(sender, instance, created, raw=False, **kwargs):
    if raw:
        return
    if created and instance.status == AdoptionRequest.Status.PENDING:
        _notify_shelter_members(
            instance,
            Notification.NotificationType.NEW_REQUEST,
            f"Nueva solicitud de adopción para {instance.pet.name}.",
        )
    elif (
        instance._previous_status is not None
        and instance._previous_status != instance.status
    ):
        if instance.status == AdoptionRequest.Status.PENDING:
            kind = Notification.NotificationType.NEW_REQUEST
            message = f"Nueva solicitud de adopción para {instance.pet.name}."
            _notify_shelter_members(instance, kind, message)
        elif instance.status == AdoptionRequest.Status.APPROVED:
            recipient_id = instance.applicant_id
            kind = Notification.NotificationType.APPROVAL
            message = "Tu solicitud de adopción fue aprobada."
        elif instance.status == AdoptionRequest.Status.REJECTED:
            recipient_id = instance.applicant_id
            kind = Notification.NotificationType.REJECTION
            message = "Tu solicitud de adopción fue rechazada."
        else:
            kind = Notification.NotificationType.SYSTEM
            message = "Una solicitud de adopción fue cancelada."
            _notify_shelter_members(instance, kind, message)
            return
        Notification.objects.create(
            user_id=recipient_id,
            request=instance,
            notification_type=kind,
            message=message,
        )
