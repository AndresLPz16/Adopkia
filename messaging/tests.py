from django.urls import reverse
from rest_framework.test import APITestCase

from notifications.models import Notification
from shelters.models import Shelter, ShelterMember
from users.models import Role, User

from .models import Message


class MessagingApiTests(APITestCase):
    def setUp(self):
        self.adopter = User.objects.create_user(
            email="adopter@example.com",
            password="SafePass!2026",
            name="Adoptante",
        )
        self.other = User.objects.create_user(
            email="other@example.com",
            password="SafePass!2026",
            name="Otro",
        )
        self.shelter_user = User.objects.create_user(
            email="shelter@example.com",
            password="SafePass!2026",
            name="Refugio",
            role=Role.Name.SHELTER,
        )
        self.shelter_colleague = User.objects.create_user(
            email="shelter-colleague@example.com",
            password="secure-password-123",
            name="Integrante",
            role=Role.Name.SHELTER,
        )
        admin = User.objects.create_user(
            email="admin@example.com",
            password="SafePass!2026",
            name="Admin",
            role=Role.Name.ADMIN,
        )
        self.shelter = Shelter.objects.create(
            name="Huellas",
            address="Calle 1",
            city="Riohacha",
            verification_status=Shelter.VerificationStatus.VERIFIED,
            verification_date="2025-01-01T00:00:00Z",
            verified_by=admin,
        )
        ShelterMember.objects.create(
            shelter=self.shelter,
            user=self.shelter_user,
            position=ShelterMember.Position.MANAGER,
        )
        ShelterMember.objects.create(
            shelter=self.shelter,
            user=self.shelter_colleague,
            position=ShelterMember.Position.COLLABORATOR,
        )

    def test_message_notifies_other_participant_once_and_restricts_access(self):
        self.client.force_authenticate(self.adopter)
        conversation_response = self.client.post(
            reverse("conversation-list"), {"shelter": self.shelter.pk}, format="json"
        )
        self.assertEqual(conversation_response.status_code, 201)
        conversation_id = conversation_response.data["id"]
        message_response = self.client.post(
            reverse("message-list"),
            {"conversation": conversation_id, "content": "¿Puedo conocer a la mascota?"},
            format="json",
        )
        self.assertEqual(message_response.status_code, 201)
        message_id = message_response.data["id"]
        first_notification = Notification.objects.get(user=self.shelter_user)
        self.assertEqual(
            first_notification.notification_type, Notification.NotificationType.MESSAGE
        )
        self.assertEqual(Notification.objects.filter(user=self.shelter_user).count(), 1)
        colleague_notification = Notification.objects.get(user=self.shelter_colleague)
        self.assertEqual(
            colleague_notification.notification_type,
            Notification.NotificationType.MESSAGE,
        )

        self.client.force_authenticate(self.shelter_colleague)
        colleague_conversations = self.client.get(reverse("conversation-list"))
        self.assertEqual(colleague_conversations.data["count"], 1)
        colleague_messages = self.client.get(
            reverse("message-list"), {"conversation": conversation_id}
        )
        self.assertEqual(colleague_messages.data["count"], 1)

        self.client.force_authenticate(self.other)
        messages = self.client.get(reverse("message-list"))
        self.assertEqual(messages.data["count"], 0)
        denied = self.client.post(
            reverse("message-list"),
            {"conversation": conversation_id, "content": "No autorizado"},
            format="json",
        )
        self.assertEqual(denied.status_code, 403)

        self.client.force_authenticate(self.shelter_user)
        reply = self.client.post(
            reverse("message-list"),
            {"conversation": conversation_id, "content": "Coordinemos una visita."},
            format="json",
        )
        self.assertEqual(reply.status_code, 201)
        adopter_notification = Notification.objects.get(user=self.adopter)
        self.assertEqual(
            adopter_notification.notification_type, Notification.NotificationType.MESSAGE
        )
        self.assertEqual(Notification.objects.filter(user=self.adopter).count(), 1)
        message = Message.objects.get(pk=message_id)
        marked = self.client.post(
            reverse("message-mark-read", args=(message.pk,)), {}, format="json"
        )
        self.assertEqual(marked.status_code, 200)
        message.refresh_from_db()
        self.assertTrue(message.is_read)
