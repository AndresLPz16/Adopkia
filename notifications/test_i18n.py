from django.urls import reverse
from rest_framework.test import APITestCase

from notifications.models import Notification
from users.models import User


class NotificationLanguageTests(APITestCase):
    def test_system_notification_is_rendered_in_requested_language(self):
        user = User.objects.create_user(
            email="notice@example.com",
            password="SafePass!2026",
            name="Notice user",
        )
        Notification.objects.create(
            user=user,
            notification_type=Notification.NotificationType.SYSTEM,
            message="Tu solicitud cambió de estado.",
        )
        self.client.force_authenticate(user)
        english = self.client.get(
            reverse("notification-list") + "?lang=en",
            HTTP_ACCEPT_LANGUAGE="es",
        )
        spanish = self.client.get(reverse("notification-list") + "?lang=es")
        self.assertEqual(
            english.json()["results"][0]["message"],
            "Your request status changed.",
        )
        self.assertEqual(
            spanish.json()["results"][0]["message"],
            "Tu solicitud cambió de estado.",
        )
