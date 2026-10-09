from rest_framework import permissions, viewsets
from rest_framework.exceptions import PermissionDenied
from django.utils.translation import gettext_lazy as _

from .models import Notification
from .serializers import NotificationSerializer


class NotificationViewSet(viewsets.ModelViewSet):
    queryset = Notification.objects.none()
    serializer_class = NotificationSerializer
    permission_classes = (permissions.IsAuthenticated,)
    filterset_fields = ("is_read", "notification_type")
    ordering_fields = ("sent_at",)
    http_method_names = ("get", "patch", "delete", "head", "options")

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)

    def perform_update(self, serializer):
        if set(serializer.validated_data) != {"is_read"}:
            raise PermissionDenied(_("Solo puedes marcar una notificación como leída o no leída."))
        serializer.save()
