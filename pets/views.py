from django.db import transaction
from django.db.models import Q
from django.utils.translation import gettext_lazy as _
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.parsers import FormParser, MultiPartParser

from myproject.permissions import RolePermissionRequired, user_can_manage_shelter
from shelters.models import Shelter
from users.models import Role

from .filters import PetFilter
from .models import Breed, Pet, PetPhoto, Species
from .permissions import PetAccessPermission
from .serializers import (
    BreedSerializer,
    PetPhotoSerializer,
    PetPhotoWriteSerializer,
    PetReadSerializer,
    PetWriteSerializer,
    SpeciesSerializer,
)


# Nombre de la raza que se crea con cada especie nueva, para que los refugios
# puedan publicar enseguida aunque nadie haya cargado razas todavía.
DEFAULT_BREED_NAME = "Sin raza definida"


class SpeciesViewSet(viewsets.ModelViewSet):
    """Catálogo de especies: lectura pública, edición con el permiso "species"."""

    rbac_resource = "species"
    rbac_allow_anonymous_read = True
    queryset = Species.objects.all()
    serializer_class = SpeciesSerializer
    permission_classes = (RolePermissionRequired,)

    @transaction.atomic
    def perform_create(self, serializer):
        species = serializer.save()
        Breed.objects.create(species=species, name=DEFAULT_BREED_NAME)

    @transaction.atomic
    def perform_destroy(self, instance):
        if Pet.objects.filter(breed__species=instance).exists():
            raise ValidationError(
                {"species": _("No se puede eliminar una especie que tiene mascotas registradas.")}
            )
        if instance.vaccines.exists():
            raise ValidationError(
                {"species": _("No se puede eliminar una especie que tiene vacunas en el catálogo.")}
            )
        instance.breeds.all().delete()
        instance.delete()


class BreedViewSet(viewsets.ModelViewSet):
    """Catálogo de razas: lectura pública, edición con el permiso "species"."""

    rbac_resource = "species"
    rbac_allow_anonymous_read = True
    queryset = Breed.objects.select_related("species").all()
    serializer_class = BreedSerializer
    permission_classes = (RolePermissionRequired,)
    filterset_fields = ("species",)
    search_fields = ("name", "species__name")

    def perform_destroy(self, instance):
        if instance.pets.exists():
            raise ValidationError(
                {"breed": _("No se puede eliminar una raza que tiene mascotas registradas.")}
            )
        instance.delete()


class PetViewSet(viewsets.ModelViewSet):
    rbac_resource = "pets"
    rbac_allow_anonymous_read = True
    filterset_class = PetFilter
    search_fields = ("name", "health", "temperament", "breed__name", "breed__species__name")
    ordering_fields = ("published_at", "name", "approximate_birth_date")
    ordering = ("-published_at", "-id")
    permission_classes = (
        permissions.IsAuthenticatedOrReadOnly,
        PetAccessPermission,
        RolePermissionRequired,
    )

    def get_queryset(self):
        queryset = Pet.objects.select_related(
            "shelter", "breed", "breed__species"
        ).prefetch_related("photos")
        user = self.request.user
        if not user.is_authenticated:
            return queryset.filter(shelter__verification_status=Shelter.VerificationStatus.VERIFIED)
        if user.role.name == Role.Name.ADMIN:
            return queryset
        return queryset.filter(
            Q(shelter__verification_status=Shelter.VerificationStatus.VERIFIED)
            | Q(shelter__members__user=user)
        ).distinct()

    def get_serializer_class(self):
        if self.action in ("list", "retrieve"):
            return PetReadSerializer
        return PetWriteSerializer

    def perform_create(self, serializer):
        shelter = serializer.validated_data["shelter"]
        if not user_can_manage_shelter(self.request.user, shelter):
            raise PermissionDenied(_("Solo integrantes del refugio pueden publicar mascotas."))
        serializer.save()

    def perform_update(self, serializer):
        pet = self.get_object()
        if not user_can_manage_shelter(self.request.user, pet.shelter):
            raise PermissionDenied(_("Solo integrantes del refugio pueden editar esta mascota."))
        target_shelter = serializer.validated_data.get("shelter", pet.shelter)
        if not user_can_manage_shelter(self.request.user, target_shelter):
            raise PermissionDenied(_("No puedes trasladar la mascota a un refugio ajeno."))
        serializer.save()

    def perform_destroy(self, instance):
        if not user_can_manage_shelter(self.request.user, instance.shelter):
            raise PermissionDenied(_("Solo integrantes del refugio pueden eliminar esta mascota."))
        instance.delete()

    @action(detail=True, methods=("post",))
    def relist(self, request, pk=None):
        pet = self.get_object()
        if not user_can_manage_shelter(request.user, pet.shelter):
            raise PermissionDenied(_("Solo integrantes del refugio pueden volver a publicar la mascota."))
        from adoptions.models import Adoption

        with transaction.atomic():
            pet = Pet.objects.select_for_update().get(pk=pet.pk)
            if pet.status != Pet.Status.RETURNED:
                raise ValidationError({"status": _("Solo se puede volver a publicar una mascota devuelta.")})
            if Adoption.objects.filter(
                request__pet=pet,
                status=Adoption.Status.ACTIVE,
            ).exists():
                raise ValidationError(
                    {
                        "status": _(
                            "No se puede volver a publicar una mascota con una adopción activa."
                        )
                    }
                )
            pet.status = Pet.Status.AVAILABLE
            pet.save(update_fields=("status",))
        return Response(PetReadSerializer(pet, context=self.get_serializer_context()).data)


class PetPhotoViewSet(viewsets.ModelViewSet):
    rbac_resource = "petPhotos"
    serializer_class = PetPhotoSerializer
    parser_classes = (MultiPartParser, FormParser)
    permission_classes = (
        permissions.IsAuthenticated,
        PetAccessPermission,
        RolePermissionRequired,
    )
    http_method_names = ("get", "post", "delete", "head", "options")

    def get_serializer_class(self):
        if self.action == "create":
            return PetPhotoWriteSerializer
        return PetPhotoSerializer

    def get_queryset(self):
        queryset = PetPhoto.objects.select_related("pet", "pet__shelter")
        pet_id = self.request.query_params.get("pet")
        if pet_id:
            queryset = queryset.filter(pet_id=pet_id)
        user = self.request.user
        if not user.is_authenticated:
            return queryset.none()
        if user.role.name == Role.Name.ADMIN:
            return queryset
        return queryset.filter(
            Q(pet__shelter__members__user=user)
            | Q(pet__shelter__verification_status=Shelter.VerificationStatus.VERIFIED)
        ).distinct()

    def perform_create(self, serializer):
        pet = serializer.validated_data["pet"]
        if not user_can_manage_shelter(self.request.user, pet.shelter):
            raise PermissionDenied(_("Solo integrantes del refugio pueden subir fotos."))
        serializer.save()

    def perform_destroy(self, instance):
        if not user_can_manage_shelter(self.request.user, instance.pet.shelter):
            raise PermissionDenied(_("Solo integrantes del refugio pueden eliminar fotos."))
        instance.delete()
