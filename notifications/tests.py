from django.urls import reverse
from rest_framework.test import APITestCase

from users.models import User

from .models import Notification


class NotificationApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="user@example.com", password="SafePass!2026", name="Usuario"
        )
        self.other = User.objects.create_user(
            email="other@example.com", password="SafePass!2026", name="Otra persona"
        )
        self.notification = Notification.objects.create(
            user=self.user,
            notification_type=Notification.NotificationType.SYSTEM,
            message="Tu solicitud cambió de estado.",
        )
        Notification.objects.create(
            user=self.other,
            notification_type=Notification.NotificationType.SYSTEM,
            message="Mensaje privado.",
        )

    def test_user_only_reads_and_updates_own_notifications(self):
        self.client.force_authenticate(self.user)
        response = self.client.get(reverse("notification-list"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        updated = self.client.patch(
            reverse("notification-detail", args=(self.notification.pk,)),
            {"is_read": True},
            format="json",
        )
        self.assertEqual(updated.status_code, 200)
        self.notification.refresh_from_db()
        self.assertTrue(self.notification.is_read)
