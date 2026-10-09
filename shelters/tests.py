from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from users.models import Role, User

from .models import Shelter, ShelterMember


class ShelterApiTests(APITestCase):
    def setUp(self):
        self.shelter_user = User.objects.create_user(
            email="shelter@example.com",
            password="SafePass!2026",
            name="Refugio Uno",
            role=Role.Name.SHELTER,
        )
        self.admin = User.objects.create_user(
            email="admin@example.com",
            password="SafePass!2026",
            name="Admin",
            role=Role.Name.ADMIN,
        )
        self.adopter = User.objects.create_user(
            email="adopter@example.com",
            password="SafePass!2026",
            name="Adopter",
            role=Role.Name.ADOPTER,
        )
        self.shelter = Shelter.objects.create(
            name="Huellas", address="Calle 1", city="Riohacha"
        )
        ShelterMember.objects.create(
            shelter=self.shelter,
            user=self.shelter_user,
            position=ShelterMember.Position.MANAGER,
        )

    def test_only_admin_can_verify_shelter(self):
        self.client.force_authenticate(self.shelter_user)
        response = self.client.post(
            reverse("shelter-verify", args=(self.shelter.pk,)),
            {"approved": True},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

        self.client.force_authenticate(self.admin)
        response = self.client.post(
            reverse("shelter-verify", args=(self.shelter.pk,)),
            {"approved": True},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.shelter.refresh_from_db()
        self.assertEqual(
            self.shelter.verification_status, Shelter.VerificationStatus.VERIFIED
        )
        self.assertEqual(self.shelter.verified_by, self.admin)
        self.assertIsNotNone(self.shelter.verification_date)

    def test_public_shelter_list_only_shows_verified(self):
        verified = Shelter.objects.create(
            name="Huellas Verificadas",
            address="Avenida Privada 123",
            city="Riohacha",
            contact_phone="555-0100",
            contact_email="private@example.com",
            verification_status=Shelter.VerificationStatus.VERIFIED,
            verification_date=timezone.now(),
            verified_by=self.admin,
        )
        response = self.client.get(reverse("shelter-list"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(
            response.data["results"][0],
            {
                "name": verified.name,
                "city": verified.city,
                "description": None,
            },
        )

        pending_response = self.client.get(
            reverse("shelter-detail", args=(self.shelter.pk,))
        )
        verified_response = self.client.get(
            reverse("shelter-detail", args=(verified.pk,))
        )
        self.assertEqual(pending_response.status_code, 404)
        self.assertEqual(verified_response.status_code, 200)
        self.assertEqual(
            set(verified_response.data), {"name", "city", "description"}
        )
        self.assertNotIn("contact_email", verified_response.data)
        self.assertNotIn("contact_phone", verified_response.data)
        self.assertNotIn("address", verified_response.data)

        self.client.force_authenticate(self.adopter)
        authenticated_public_response = self.client.get(
            reverse("shelter-detail", args=(verified.pk,))
        )
        self.assertEqual(authenticated_public_response.status_code, 200)
        self.assertEqual(
            set(authenticated_public_response.data),
            {"name", "city", "description"},
        )

    def test_shelter_members_and_admin_receive_full_shelter_details(self):
        self.client.force_authenticate(self.shelter_user)
        member_response = self.client.get(
            reverse("shelter-detail", args=(self.shelter.pk,))
        )
        self.assertEqual(member_response.status_code, 200)
        self.assertIn("address", member_response.data)
        self.assertIn("contact_phone", member_response.data)
        self.assertIn("contact_email", member_response.data)

        self.client.force_authenticate(self.admin)
        admin_response = self.client.get(
            reverse("shelter-detail", args=(self.shelter.pk,))
        )
        self.assertEqual(admin_response.status_code, 200)
        self.assertIn("address", admin_response.data)
        self.assertIn("contact_phone", admin_response.data)
        self.assertIn("contact_email", admin_response.data)
