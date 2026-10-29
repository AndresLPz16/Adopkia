from rest_framework import permissions, viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from django.utils.translation import gettext_lazy as _

from adoptions.models import Adoption
from myproject.permissions import RolePermissionRequired, user_can_manage_shelter
from users.models import Role

from .models import MedicalRecord, Reminder, Vaccine, Veterinarian
from .serializers import (
    MedicalRecordSerializer,
    ReminderSerializer,
    VaccineSerializer,
    VeterinarianSerializer,
)
from .services import medical_records_for_user, reminders_for_user


class VeterinarianViewSet(viewsets.ModelViewSet):
    rbac_resource = "veterinarians"
    permission_classes = (permissions.IsAuthenticated, RolePermissionRequired)
    serializer_class = VeterinarianSerializer
    ordering = ("id",)
    http_method_names = ("get", "post", "patch", "head", "options")
    filterset_fields = ("clinic", "specialty")
    search_fields = ("user__name", "professional_card", "clinic", "specialty")

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return Veterinarian.objects.none()
        if user.role.name == Role.Name.VETERINARIAN:
            return Veterinarian.objects.filter(user=user)
        if user.role.name in (Role.Name.ADMIN, Role.Name.SHELTER):
            return Veterinarian.objects.select_related("user").all()
        return Veterinarian.objects.none()

    def perform_create(self, serializer):
        user = self.request.user
        if user.role.name != Role.Name.VETERINARIAN:
            raise PermissionDenied(_("Solo una cuenta veterinaria puede crear este perfil."))
        serializer.save(user=user)

    def perform_update(self, serializer):
        if self.get_object().user_id != self.request.user.pk:
            raise PermissionDenied(_("Solo puedes editar tu propio perfil veterinario."))
        serializer.save()

    def perform_destroy(self, instance):
        raise PermissionDenied(_("El perfil veterinario no se puede eliminar desde la API."))


class MedicalRecordViewSet(viewsets.ModelViewSet):
    rbac_resource = "medicalRecords"
    permission_classes = (permissions.IsAuthenticated, RolePermissionRequired)
    serializer_class = MedicalRecordSerializer
    filterset_fields = ("pet", "record_type", "date", "vaccine")
    search_fields = ("description", "record_type", "pet__name")
    ordering_fields = ("date",)

    def get_queryset(self):
        queryset = MedicalRecord.objects.select_related(
            "pet", "pet__shelter", "veterinarian__user", "vaccine"
        )
        return medical_records_for_user(queryset, self.request.user)

    def _check_pet_access(self, pet):
        user = self.request.user
        if user.role.name == Role.Name.VETERINARIAN:
            return
        if user.role.name in (Role.Name.ADMIN,):
            return
        if not user_can_manage_shelter(user, pet.shelter):
            raise PermissionDenied(_("No tienes permisos para gestionar el historial de esta mascota."))

    def perform_create(self, serializer):
        user = self.request.user
        pet = serializer.validated_data["pet"]
        self._check_pet_access(pet)
        if user.role.name == Role.Name.VETERINARIAN:
            veterinarian = Veterinarian.objects.filter(user=user).first()
            if veterinarian is None:
                raise ValidationError(
                    {"veterinarian": _("Registra primero tu perfil veterinario aliado.")}
                )
            serializer.save(veterinarian=veterinarian)
        else:
            serializer.save()

    def perform_update(self, serializer):
        self._check_pet_access(self.get_object().pet)
        pet = serializer.validated_data.get("pet", self.get_object().pet)
        self._check_pet_access(pet)
        serializer.save()

    def perform_destroy(self, instance):
        self._check_pet_access(instance.pet)
        instance.delete()


class VaccineViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Vaccine.objects.select_related("species").all()
    serializer_class = VaccineSerializer
    permission_classes = (permissions.AllowAny,)
    ordering = ("id",)
    filterset_fields = ("species",)
    search_fields = ("name", "species__name")


class ReminderViewSet(viewsets.ModelViewSet):
    rbac_resource = "reminders"
    permission_classes = (permissions.IsAuthenticated, RolePermissionRequired)
    serializer_class = ReminderSerializer
    filterset_fields = ("adoption", "vaccine", "medical_record", "reminder_type", "status")
    ordering_fields = ("scheduled_date",)

    def get_queryset(self):
        queryset = Reminder.objects.select_related(
            "adoption__request__applicant",
            "adoption__request__pet__shelter",
            "vaccine",
            "medical_record",
        )
        return reminders_for_user(queryset, self.request.user)

    def _check_adoption_access(self, adoption):
        user = self.request.user
        if user.role.name == Role.Name.ADMIN:
            return
        if user.role.name == Role.Name.ADOPTER and adoption.request.applicant_id == user.pk:
            return
        if user.role.name == Role.Name.SHELTER and user_can_manage_shelter(
            user, adoption.request.pet.shelter
        ):
            return
        raise PermissionDenied(_("No tienes permisos para gestionar este recordatorio."))

    def perform_create(self, serializer):
        adoption = serializer.validated_data["adoption"]
        if adoption.status != Adoption.Status.ACTIVE:
            raise ValidationError({"adoption": _("Los recordatorios requieren una adopción activa.")})
        self._check_adoption_access(adoption)
        serializer.save()

    def perform_update(self, serializer):
        reminder = self.get_object()
        self._check_adoption_access(reminder.adoption)
        if serializer.validated_data.get("adoption", reminder.adoption) != reminder.adoption:
            raise ValidationError({"adoption": _("No se puede cambiar la adopción del recordatorio.")})
        serializer.save()

    def perform_destroy(self, instance):
        self._check_adoption_access(instance.adoption)
        instance.delete()
