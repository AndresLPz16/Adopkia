from datetime import date

from django.utils.translation import gettext_lazy as _
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.serializers import CharField, DateField, Serializer

from myproject.permissions import RolePermissionRequired, user_can_manage_shelter
from users.models import Role

from .models import Adoption, AdoptionRequest, FormQuestion, FollowUp
from .serializers import (
    AdoptionRequestReadSerializer,
    AdoptionRequestWriteSerializer,
    AdoptionSerializer,
    FormQuestionSerializer,
    FollowUpSerializer,
)
from .services import cancel_adoption_request, decide_adoption_request, return_adoption


class DecisionSerializer(Serializer):
    message = CharField(required=False, allow_blank=True, max_length=2000)


class ReturnSerializer(Serializer):
    reason = CharField(max_length=5000)
    return_date = DateField(required=False)


class FormQuestionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = FormQuestion.objects.filter(active=True)
    serializer_class = FormQuestionSerializer
    permission_classes = (permissions.AllowAny,)


class AdoptionRequestViewSet(viewsets.ModelViewSet):
    rbac_resource = "adoptionRequests"
    permission_classes = (permissions.IsAuthenticated, RolePermissionRequired)
    http_method_names = ("get", "post", "patch", "head", "options")
    filterset_fields = ("status", "pet")
    search_fields = ("pet__name", "applicant__name", "applicant__email")
    ordering_fields = ("requested_at", "responded_at", "status")

    def get_queryset(self):
        queryset = AdoptionRequest.objects.select_related(
            "applicant",
            "pet",
            "pet__shelter",
            "pet__breed",
            "pet__breed__species",
        ).prefetch_related("answers__question", "pet__photos")
        user = self.request.user
        if not user.is_authenticated:
            return queryset.none()
        if user.role.name == Role.Name.ADMIN:
            return queryset
        if user.role.name == Role.Name.SHELTER:
            return queryset.filter(pet__shelter__members__user=user).distinct()
        return queryset.filter(applicant=user)

    def get_serializer_class(self):
        if self.action in ("create", "partial_update", "update"):
            return AdoptionRequestWriteSerializer
        return AdoptionRequestReadSerializer

    def perform_create(self, serializer):
        serializer.save()

    def perform_update(self, serializer):
        adoption_request = self.get_object()
        if adoption_request.applicant_id != self.request.user.pk:
            raise PermissionDenied(_("Solo puedes editar tus propias solicitudes."))
        if adoption_request.status != AdoptionRequest.Status.PENDING:
            raise ValidationError({"status": _("Solo puedes editar solicitudes pendientes.")})
        serializer.save()

    @action(detail=True, methods=("post",))
    def approve(self, request, pk=None):
        decision = DecisionSerializer(data=request.data)
        decision.is_valid(raise_exception=True)
        adoption = decide_adoption_request(
            adoption_request_id=self.get_object().pk,
            actor=request.user,
            decision="approve",
            message=decision.validated_data.get("message", ""),
        )
        return Response(AdoptionSerializer(adoption).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=("post",))
    def reject(self, request, pk=None):
        decision = DecisionSerializer(data=request.data)
        decision.is_valid(raise_exception=True)
        adoption_request = decide_adoption_request(
            adoption_request_id=self.get_object().pk,
            actor=request.user,
            decision="reject",
            message=decision.validated_data.get("message", ""),
        )
        return Response(AdoptionRequestReadSerializer(adoption_request).data)

    @action(detail=True, methods=("post",))
    def cancel(self, request, pk=None):
        adoption_request = cancel_adoption_request(
            adoption_request_id=self.get_object().pk,
            actor=request.user,
        )
        return Response(AdoptionRequestReadSerializer(adoption_request).data)


class AdoptionViewSet(viewsets.ReadOnlyModelViewSet):
    rbac_resource = "adoptions"
    permission_classes = (permissions.IsAuthenticated, RolePermissionRequired)
    serializer_class = AdoptionSerializer
    filterset_fields = ("status",)
    ordering_fields = ("adoption_date", "return_date")

    def get_queryset(self):
        queryset = Adoption.objects.select_related(
            "request__applicant", "request__pet", "request__pet__shelter"
        )
        user = self.request.user
        if not user.is_authenticated:
            return queryset.none()
        if user.role.name == Role.Name.ADMIN:
            return queryset
        if user.role.name == Role.Name.SHELTER:
            return queryset.filter(request__pet__shelter__members__user=user).distinct()
        return queryset.filter(request__applicant=user)

    @action(detail=True, methods=("post",), url_path="return", url_name="return")
    def return_adoption(self, request, pk=None):
        serializer = ReturnSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        adoption = return_adoption(
            adoption_id=self.get_object().pk,
            actor=request.user,
            reason=serializer.validated_data["reason"],
            return_date=serializer.validated_data.get("return_date", date.today()),
        )
        return Response(self.get_serializer(adoption).data)


class FollowUpViewSet(viewsets.ModelViewSet):
    rbac_resource = "followUps"
    permission_classes = (permissions.IsAuthenticated, RolePermissionRequired)
    serializer_class = FollowUpSerializer
    filterset_fields = ("adoption",)
    ordering_fields = ("date",)
    http_method_names = ("get", "post", "patch", "delete", "head", "options")

    def get_queryset(self):
        queryset = FollowUp.objects.select_related(
            "adoption__request__applicant", "adoption__request__pet__shelter"
        )
        user = self.request.user
        if not user.is_authenticated:
            return queryset.none()
        if user.role.name == Role.Name.ADMIN:
            return queryset
        if user.role.name == Role.Name.SHELTER:
            return queryset.filter(adoption__request__pet__shelter__members__user=user).distinct()
        return queryset.filter(adoption__request__applicant=user)

    def perform_create(self, serializer):
        adoption = serializer.validated_data["adoption"]
        if not user_can_manage_shelter(self.request.user, adoption.request.pet.shelter):
            raise PermissionDenied(_("Solo el refugio responsable puede registrar seguimientos."))
        if adoption.status != Adoption.Status.ACTIVE:
            raise ValidationError(
                {"adoption": _("No se puede registrar seguimiento a una adopción devuelta.")}
            )
        serializer.save()

    def _check_edit_permission(self, follow_up):
        if not user_can_manage_shelter(
            self.request.user, follow_up.adoption.request.pet.shelter
        ):
            raise PermissionDenied(_("Solo el refugio responsable puede editar seguimientos."))

    def perform_update(self, serializer):
        self._check_edit_permission(self.get_object())
        serializer.save()

    def perform_destroy(self, instance):
        self._check_edit_permission(instance)
        instance.delete()
