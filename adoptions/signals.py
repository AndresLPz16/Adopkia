from django.db.models.signals import post_save, pre_save
from django.db.models import Case, IntegerField, Value, When
from django.dispatch import receiver
from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import ValidationError

from notifications.models import Notification

from .models import AdoptionRequest


def _shelter_notification_recipient(adoption_request):
    shelter_members = adoption_request.pet.shelter.members.order_by(
        Case(
            When(position="responsable", then=Value(0)),
            default=Value(1),
            output_field=IntegerField(),
        ),
        "id",
    )
    user_id = shelter_members.values_list("user_id", flat=True).first()
    if user_id is None:
        raise ValidationError(
            {"pet": _("El refugio debe tener un integrante para recibir notificaciones.")}
        )
    return user_id


@receiver(pre_save, sender=AdoptionRequest, dispatch_uid="adoptions.remember_request_status")
def remember_previous_status(sender, instance, **kwargs):
    if not instance.pk:
        instance._previous_status = None
        return
    instance._previous_status = (
        sender.objects.filter(pk=instance.pk).values_list("status", flat=True).first()
    )


@receiver(post_save, sender=AdoptionRequest, dispatch_uid="adoptions.notify_request_changes")
def notify_request_changes(sender, instance, created, **kwargs):
    if created and instance.status == AdoptionRequest.Status.PENDING:
        Notification.objects.create(
            user_id=_shelter_notification_recipient(instance),
            request=instance,
            notification_type=Notification.NotificationType.NEW_REQUEST,
            message=f"Nueva solicitud de adopción para {instance.pet.name}.",
        )
    elif (
        instance._previous_status is not None
        and instance._previous_status != instance.status
    ):
        if instance.status == AdoptionRequest.Status.PENDING:
            recipient_id = _shelter_notification_recipient(instance)
            kind = Notification.NotificationType.NEW_REQUEST
            message = f"Nueva solicitud de adopción para {instance.pet.name}."
        elif instance.status == AdoptionRequest.Status.APPROVED:
            recipient_id = instance.applicant_id
            kind = Notification.NotificationType.APPROVAL
            message = "Tu solicitud de adopción fue aprobada."
        elif instance.status == AdoptionRequest.Status.REJECTED:
            recipient_id = instance.applicant_id
            kind = Notification.NotificationType.REJECTION
            message = "Tu solicitud de adopción fue rechazada."
        else:
            recipient_id = _shelter_notification_recipient(instance)
            kind = Notification.NotificationType.SYSTEM
            message = "Una solicitud de adopción fue cancelada."
        Notification.objects.create(
            user_id=recipient_id,
            request=instance,
            notification_type=kind,
            message=message,
        )
