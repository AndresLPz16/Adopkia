from datetime import date

from django.urls import reverse
from rest_framework.test import APITestCase

from shelters.models import Shelter, ShelterMember
from users.models import Role, User

from .models import Breed, Pet, Species


class PetApiTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="shelter@example.com",
            password="SafePass!2026",
            name="Refugio",
            role=Role.Name.SHELTER,
        )
        self.other = User.objects.create_user(
            email="other@example.com",
            password="SafePass!2026",
            name="Otro refugio",
            role=Role.Name.SHELTER,
        )
        self.admin = User.objects.create_user(
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
            verified_by=self.admin,
        )
        ShelterMember.objects.create(
            shelter=self.shelter,
            user=self.owner,
            position=ShelterMember.Position.MANAGER,
        )
        self.species = Species.objects.create(name="Perro")
        self.breed = Breed.objects.create(species=self.species, name="Mestizo")
        self.pet = Pet.objects.create(
            shelter=self.shelter,
            breed=self.breed,
            name="Luna",
            approximate_birth_date=date(2023, 1, 1),
            size=Pet.Size.MEDIUM,
        )

    def test_public_pet_search_returns_calculated_age_and_catalog_filters(self):
        response = self.client.get(
            reverse("pet-list"),
            {"species": self.species.pk, "breed": self.breed.pk, "city": "Riohacha"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertIsInstance(response.data["results"][0]["age"], int)

    def test_invalid_age_filter_returns_validation_error(self):
        response = self.client.get(reverse("pet-list"), {"min_age": "-1"})
        self.assertEqual(response.status_code, 400)

    def test_non_member_cannot_create_pet_in_another_shelter(self):
        self.client.force_authenticate(self.other)
        response = self.client.post(
            reverse("pet-list"),
            {
                "shelter": self.shelter.pk,
                "breed": self.breed.pk,
                "name": "Milo",
                "size": Pet.Size.SMALL,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(Pet.objects.count(), 1)

    def test_shelter_can_create_pet(self):
        self.client.force_authenticate(self.owner)
        response = self.client.post(
            reverse("pet-list"),
            {
                "shelter": self.shelter.pk,
                "breed": self.breed.pk,
                "name": "Milo",
                "approximate_birth_date": "2024-01-01",
                "size": Pet.Size.SMALL,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Pet.objects.get(name="Milo").status, Pet.Status.AVAILABLE)

    def test_future_birth_date_is_rejected(self):
        self.client.force_authenticate(self.owner)
        response = self.client.post(
            reverse("pet-list"),
            {
                "shelter": self.shelter.pk,
                "breed": self.breed.pk,
                "name": "Milo",
                "size": Pet.Size.SMALL,
                "approximate_birth_date": "2999-01-01",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("futuro", str(response.data).lower())
