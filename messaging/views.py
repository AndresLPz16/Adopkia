from django.db.models import Q
from django.utils.translation import gettext_lazy as _
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from myproject.permissions import user_can_manage_shelter
from users.models import Role

from .models import Conversation, Message
from .permissions import conversations_for_user, user_can_access_conversation
from .serializers import (
    ConversationCreateSerializer,
    ConversationReadSerializer,
    MessageReadSerializer,
    MessageUpdateSerializer,
    MessageWriteSerializer,
)


class ConversationViewSet(viewsets.ModelViewSet):
    filterset_fields = ("shelter", "pet")
    search_fields = ("shelter__name", "pet__name", "adopter__name")
    ordering_fields = ("started_at",)

    def get_queryset(self):
        queryset = Conversation.objects.select_related("adopter", "shelter", "pet")
        return conversations_for_user(queryset, self.request.user)

    def get_serializer_class(self):
        if self.action == "create":
            return ConversationCreateSerializer
        return ConversationReadSerializer

    def perform_create(self, serializer):
        if self.request.user.role.name != Role.Name.ADOPTER:
            raise PermissionDenied(_("Solo un adoptante puede iniciar una conversación."))
        serializer.save(adopter=self.request.user)

    def perform_update(self, serializer):
        raise PermissionDenied(_("Los participantes de una conversación no se pueden cambiar."))

    def perform_destroy(self, instance):
        if not (
            instance.adopter_id == self.request.user.pk
            or user_can_manage_shelter(self.request.user, instance.shelter)
        ):
            raise PermissionDenied(_("No puedes eliminar esta conversación."))
        instance.delete()


class MessageViewSet(viewsets.ModelViewSet):
    filterset_fields = ("conversation", "is_read")
    search_fields = ("content", "sender__name")
    ordering_fields = ("sent_at",)
    http_method_names = ("get", "post", "patch", "delete", "head", "options")

    def get_queryset(self):
        queryset = Message.objects.select_related("conversation", "sender")
        user = self.request.user
        if not user.is_authenticated:
            return queryset.none()
        if user.role.name == Role.Name.ADMIN:
            return queryset
        return queryset.filter(
            Q(conversation__adopter=user) | Q(conversation__shelter__members__user=user)
        ).distinct()

    def get_serializer_class(self):
        if self.action == "create":
            return MessageWriteSerializer
        if self.action in ("partial_update", "update"):
            return MessageUpdateSerializer
        return MessageReadSerializer

    def perform_create(self, serializer):
        conversation = serializer.validated_data["conversation"]
        if not user_can_access_conversation(self.request.user, conversation):
            raise PermissionDenied(_("No puedes enviar mensajes en esta conversación."))
        serializer.save(sender=self.request.user)

    def perform_update(self, serializer):
        message = self.get_object()
        if message.sender_id != self.request.user.pk:
            raise PermissionDenied(_("Solo quien envió el mensaje puede editarlo."))
        if message.is_read:
            raise PermissionDenied(_("No puedes editar un mensaje que ya fue leído."))
        serializer.save()

    def perform_destroy(self, instance):
        if instance.sender_id != self.request.user.pk:
            raise PermissionDenied(_("Solo quien envió el mensaje puede eliminarlo."))
        instance.delete()

    @action(detail=True, methods=("post",), url_path="mark-read")
    def mark_read(self, request, pk=None):
        message = self.get_object()
        if message.sender_id == request.user.pk:
            raise PermissionDenied(_("No puedes marcar como leído tu propio mensaje."))
        message.is_read = True
        message.save(update_fields=("is_read",))
        return Response(MessageReadSerializer(message).data, status=status.HTTP_200_OK)
