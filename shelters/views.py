from django.db.models import Exists, OuterRef, Q
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema, extend_schema_view

from myproject.permissions import RolePermissionRequired, user_can_manage_shelter
from users.models import Role

from .models import Shelter, ShelterMember
from .serializers import (
    ShelterMemberCreateSerializer,
    ShelterMemberSerializer,
    PublicShelterSerializer,
    ShelterSerializer,
)


@extend_schema_view(
    list=extend_schema(responses=PublicShelterSerializer(many=True)),
    retrieve=extend_schema(responses=PublicShelterSerializer),
)
class ShelterViewSet(viewsets.ModelViewSet):
    rbac_resource = "shelters"
    rbac_action_resources = {"members": "shelterMembers"}
    rbac_allow_anonymous_read = True
    serializer_class = ShelterSerializer
    filterset_fields = ("city", "verification_status")
    search_fields = ("name", "city", "address")
    ordering_fields = ("name", "city", "registered_at")
    ordering = ("id",)

    def get_queryset(self):
        queryset = Shelter.objects.all()
        user = self.request.user
        if not user.is_authenticated:
            return queryset.filter(verification_status=Shelter.VerificationStatus.VERIFIED)
        memberships = ShelterMember.objects.filter(
            shelter_id=OuterRef("pk"),
            user_id=user.pk,
        )
        queryset = queryset.annotate(_user_is_member=Exists(memberships))
        if user.role.name == Role.Name.ADMIN:
            return queryset
        return queryset.filter(
            Q(verification_status=Shelter.VerificationStatus.VERIFIED)
            | Q(members__user=user)
        ).distinct()

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [RolePermissionRequired()]
        return [permissions.IsAuthenticated(), RolePermissionRequired()]

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        shelters = page if page is not None else queryset
        data = []
        for shelter in shelters:
            serializer_class = (
                ShelterSerializer
                if self._can_manage_shelter(request.user, shelter)
                else PublicShelterSerializer
            )
            data.append(
                serializer_class(
                    shelter, context=self.get_serializer_context()
                ).data
            )
        if page is not None:
            return self.get_paginated_response(data)
        return Response(data)

    @staticmethod
    def _can_manage_shelter(user, shelter):
        return bool(
            user.is_authenticated
            and (
                user.role.name == Role.Name.ADMIN
                or getattr(shelter, "_user_is_member", False)
            )
        )

    def retrieve(self, request, *args, **kwargs):
        shelter = self.get_object()
        serializer_class = (
            ShelterSerializer
            if self._can_manage_shelter(request.user, shelter)
            else PublicShelterSerializer
        )
        serializer = serializer_class(
            shelter, context=self.get_serializer_context()
        )
        return Response(serializer.data)

    def perform_create(self, serializer):
        user = self.request.user
        shelter = serializer.save()
        if user.role.name != Role.Name.ADMIN:
            ShelterMember.objects.create(
                shelter=shelter,
                user=user,
                position=ShelterMember.Position.MANAGER,
            )

    def perform_update(self, serializer):
        if not user_can_manage_shelter(self.request.user, self.get_object()):
            raise PermissionDenied(_("No tienes permisos para editar este refugio."))
        serializer.save()

    def perform_destroy(self, instance):
        if not user_can_manage_shelter(self.request.user, instance):
            raise PermissionDenied(_("No tienes permisos para eliminar este refugio."))
        instance.delete()

    @action(
        detail=True,
        methods=("post",),
        permission_classes=(permissions.IsAuthenticated, RolePermissionRequired),
    )
    def verify(self, request, pk=None):
        shelter = self.get_object()
        approved = request.data.get("approved")
        if not isinstance(approved, bool):
            raise ValidationError({"approved": _("Este campo debe ser verdadero o falso.")})
        shelter.verification_status = (
            Shelter.VerificationStatus.VERIFIED
            if approved
            else Shelter.VerificationStatus.REJECTED
        )
        shelter.verification_date = timezone.now() if approved else None
        shelter.verified_by = request.user if approved else None
        shelter.save(update_fields=("verification_status", "verification_date", "verified_by"))
        return Response(self.get_serializer(shelter).data)

    @action(
        detail=True,
        methods=("get", "post"),
        permission_classes=(permissions.IsAuthenticated, RolePermissionRequired),
    )
    def members(self, request, pk=None):
        shelter = self.get_object()
        if request.method == "POST":
            if not (
                user_can_manage_shelter(request.user, shelter)
                and shelter.members.filter(
                    user=request.user, position=ShelterMember.Position.MANAGER
                ).exists()
            ):
                raise PermissionDenied(_("Solo el responsable puede agregar integrantes."))
            serializer = ShelterMemberCreateSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            member = serializer.save(shelter=shelter)
            return Response(
                ShelterMemberSerializer(member).data, status=status.HTTP_201_CREATED
            )
        if not user_can_manage_shelter(request.user, shelter):
            raise PermissionDenied(_("No tienes permisos para ver los integrantes."))
        return Response(ShelterMemberSerializer(shelter.members.all(), many=True).data)


class ShelterMemberViewSet(viewsets.ModelViewSet):
    rbac_resource = "shelterMembers"
    permission_classes = (permissions.IsAuthenticated, RolePermissionRequired)
    serializer_class = ShelterMemberSerializer
    ordering = ("id",)
    http_method_names = ("get", "patch", "delete", "head", "options")

    def get_queryset(self):
        if not self.request.user.is_authenticated:
            return ShelterMember.objects.none()
        if self.request.user.role.name == Role.Name.ADMIN:
            return ShelterMember.objects.all()
        return ShelterMember.objects.filter(shelter__members__user=self.request.user).distinct()

    def perform_update(self, serializer):
        member = self.get_object()
        if not (
            user_can_manage_shelter(self.request.user, member.shelter)
            and member.shelter.members.filter(
                user=self.request.user, position=ShelterMember.Position.MANAGER
            ).exists()
        ):
            raise PermissionDenied(_("Solo el responsable puede actualizar integrantes."))
        serializer.save()

    def perform_destroy(self, instance):
        if not (
            user_can_manage_shelter(self.request.user, instance.shelter)
            and instance.shelter.members.filter(
                user=self.request.user, position=ShelterMember.Position.MANAGER
            ).exists()
        ):
            raise PermissionDenied(_("Solo el responsable puede eliminar integrantes."))
        instance.delete()
