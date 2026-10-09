from datetime import date

from django.db import IntegrityError, transaction
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import PermissionDenied, ValidationError

from myproject.permissions import user_can_manage_shelter
from pets.models import Pet

from .models import Adoption, AdoptionRequest, FormAnswer


def _is_pending_request_duplicate(error):
    message = str(error).lower()
    return "uq_solicitud_pendiente" in message or (
        "solicitud_adopcion.id_adoptante" in message
        and "solicitud_adopcion.id_mascota" in message
        and "pendiente_unica" in message
    )


@transaction.atomic
def create_adoption_request(*, applicant, pet_id, answers):
    pet = Pet.objects.select_for_update().select_related("shelter").get(pk=pet_id)
    if pet.status not in (Pet.Status.AVAILABLE, Pet.Status.IN_PROCESS):
        raise ValidationError({"pet": _("Esta mascota no está disponible para nuevas solicitudes.")})
    try:
        request = AdoptionRequest.objects.create(applicant=applicant, pet=pet)
    except IntegrityError as exc:
        if not _is_pending_request_duplicate(exc):
            raise
        raise ValidationError(
            {"pet": _("Ya tienes una solicitud pendiente para esta mascota.")}
        ) from exc
    FormAnswer.objects.bulk_create(
        [
            FormAnswer(request=request, question=answer["question"], value=answer["value"])
            for answer in answers
        ]
    )
    if pet.status == Pet.Status.AVAILABLE:
        pet.status = Pet.Status.IN_PROCESS
        pet.save(update_fields=("status",))
    return request


@transaction.atomic
def update_adoption_request(*, adoption_request, validated_data):
    answers = validated_data.pop("answers", None)
    target_pet = validated_data.get("pet", adoption_request.pet)
    old_pet_id = adoption_request.pet_id
    pet_ids = sorted({old_pet_id, target_pet.pk})
    pets = {
        pet.pk: pet
        for pet in Pet.objects.select_for_update()
        .filter(pk__in=pet_ids)
        .order_by("pk")
    }
    old_pet = pets[old_pet_id]
    new_pet = pets[target_pet.pk]

    if new_pet.pk != old_pet_id:
        if new_pet.status not in (Pet.Status.AVAILABLE, Pet.Status.IN_PROCESS):
            raise ValidationError(
                {"pet": _("Esta mascota no está disponible para nuevas solicitudes.")}
            )
        try:
            with transaction.atomic():
                adoption_request.pet = new_pet
                adoption_request.save(update_fields=("pet",))
        except IntegrityError as exc:
            if not _is_pending_request_duplicate(exc):
                raise
            raise ValidationError(
                {"pet": _("Ya tienes una solicitud pendiente para esta mascota.")}
            ) from exc

        if new_pet.status == Pet.Status.AVAILABLE:
            new_pet.status = Pet.Status.IN_PROCESS
            new_pet.save(update_fields=("status",))
        if (
            old_pet.status == Pet.Status.IN_PROCESS
            and not AdoptionRequest.objects.filter(
                pet=old_pet, status=AdoptionRequest.Status.PENDING
            ).exists()
        ):
            old_pet.status = Pet.Status.AVAILABLE
            old_pet.save(update_fields=("status",))

    if answers is not None:
        adoption_request.answers.all().delete()
        FormAnswer.objects.bulk_create(
            [
                FormAnswer(
                    request=adoption_request,
                    question=answer["question"],
                    value=answer["value"],
                )
                for answer in answers
            ]
        )
    return adoption_request


@transaction.atomic
def decide_adoption_request(*, adoption_request_id, actor, decision, message=""):
    pet_id = AdoptionRequest.objects.values_list("pet_id", flat=True).get(
        pk=adoption_request_id
    )
    pet = Pet.objects.select_for_update().select_related("shelter").get(pk=pet_id)
    adoption_request = AdoptionRequest.objects.select_for_update().get(pk=adoption_request_id)
    if not user_can_manage_shelter(actor, pet.shelter):
        raise PermissionDenied(_("Solo el refugio responsable puede decidir esta solicitud."))
    if adoption_request.status != AdoptionRequest.Status.PENDING:
        raise ValidationError({"status": _("Solo se pueden decidir solicitudes pendientes.")})

    now = timezone.now()
    adoption_request.responded_at = now
    adoption_request.shelter_notes = message or None
    if decision == "approve":
        if pet.status not in (Pet.Status.IN_PROCESS, Pet.Status.AVAILABLE):
            raise ValidationError({"pet": _("La mascota ya no está disponible para adopción.")})
        adoption_request.status = AdoptionRequest.Status.APPROVED
        adoption_request.save(update_fields=("status", "responded_at", "shelter_notes"))
        losing_requests = AdoptionRequest.objects.filter(
            pet=pet, status=AdoptionRequest.Status.PENDING
        ).exclude(pk=adoption_request.pk)
        for losing_request in losing_requests:
            losing_request.status = AdoptionRequest.Status.REJECTED
            losing_request.responded_at = now
            losing_request.shelter_notes = _("La mascota fue asignada a otra solicitud.")
            losing_request.save(
                update_fields=("status", "responded_at", "shelter_notes")
            )
        adoption = Adoption.objects.create(
            request=adoption_request, adoption_date=date.today()
        )
        pet.status = Pet.Status.ADOPTED
        pet.save(update_fields=("status",))
        return adoption

    adoption_request.status = AdoptionRequest.Status.REJECTED
    adoption_request.save(update_fields=("status", "responded_at", "shelter_notes"))
    if not AdoptionRequest.objects.filter(
        pet=pet, status=AdoptionRequest.Status.PENDING
    ).exists():
        pet.status = Pet.Status.AVAILABLE
        pet.save(update_fields=("status",))
    return adoption_request


@transaction.atomic
def cancel_adoption_request(*, adoption_request_id, actor):
    pet_id = AdoptionRequest.objects.values_list("pet_id", flat=True).get(
        pk=adoption_request_id
    )
    pet = Pet.objects.select_for_update().get(pk=pet_id)
    adoption_request = AdoptionRequest.objects.select_for_update().get(pk=adoption_request_id)
    if adoption_request.applicant_id != actor.pk:
        raise PermissionDenied(_("Solo puedes cancelar tus propias solicitudes."))
    if adoption_request.status != AdoptionRequest.Status.PENDING:
        raise ValidationError({"status": _("Solo puedes cancelar solicitudes pendientes.")})
    adoption_request.status = AdoptionRequest.Status.CANCELLED
    adoption_request.responded_at = timezone.now()
    adoption_request.save(update_fields=("status", "responded_at"))
    if not AdoptionRequest.objects.filter(
        pet=pet, status=AdoptionRequest.Status.PENDING
    ).exists():
        pet.status = Pet.Status.AVAILABLE
        pet.save(update_fields=("status",))
    return adoption_request


@transaction.atomic
def return_adoption(*, adoption_id, actor, reason, return_date=None):
    pet_id = Adoption.objects.values_list("request__pet_id", flat=True).get(pk=adoption_id)
    pet = Pet.objects.select_for_update().select_related("shelter").get(pk=pet_id)
    adoption = Adoption.objects.select_for_update().select_related("request").get(pk=adoption_id)
    if not user_can_manage_shelter(actor, pet.shelter):
        raise PermissionDenied(_("Solo el refugio responsable puede registrar la devolución."))
    if adoption.status != Adoption.Status.ACTIVE:
        raise ValidationError({"status": _("Esta adopción ya no está activa.")})
    reason = reason.strip()
    if not reason:
        raise ValidationError({"reason": _("Debes indicar el motivo de la devolución.")})
    effective_return_date = return_date or date.today()
    if effective_return_date < adoption.adoption_date:
        raise ValidationError(
            {"return_date": _("La fecha de devolución no puede ser anterior a la adopción.")}
        )
    adoption.status = Adoption.Status.RETURNED
    adoption.return_date = effective_return_date
    adoption.return_reason = reason
    adoption.save(update_fields=("status", "return_date", "return_reason"))
    pet.status = Pet.Status.RETURNED
    pet.save(update_fields=("status",))
    return adoption
