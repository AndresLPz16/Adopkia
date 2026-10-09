from datetime import date

from django.urls import reverse
from rest_framework.test import APITestCase

from adoptions.models import Adoption, AdoptionRequest
from pets.models import Breed, Pet, Species
from shelters.models import Shelter
from users.models import Role, User


class AdoptionStatisticsTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email="admin@example.com",
            password="SafePass!2026",
            name="Admin",
            role=Role.Name.ADMIN,
        )
        self.adopter = User.objects.create_user(
            email="adopter@example.com", password="SafePass!2026", name="Adoptante"
        )
        shelter = Shelter.objects.create(name="Huellas", address="Calle 1", city="Riohacha")
        species = Species.objects.create(name="Perro")
        breed = Breed.objects.create(species=species, name="Mestizo")
        for name in ("Luna", "Milo"):
            pet = Pet.objects.create(
                shelter=shelter,
                breed=breed,
                name=name,
                size=Pet.Size.SMALL,
            )
            adoption_request = AdoptionRequest.objects.create(
                applicant=self.adopter,
                pet=pet,
                status=AdoptionRequest.Status.APPROVED,
            )
            adoption_fields = {"request": adoption_request, "adoption_date": date.today()}
            if name == "Luna":
                adoption_fields.update(
                    status=Adoption.Status.RETURNED,
                    return_date=date.today(),
                    return_reason="Cambio de vivienda",
                )
            Adoption.objects.create(**adoption_fields)

    def test_return_rate_is_returned_over_all_adoptions(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(reverse("adoption-statistics"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total_adoptions"], 2)
        self.assertEqual(response.data["returned_adoptions"], 1)
        self.assertEqual(response.data["return_rate"], 50.0)
        self.assertEqual(response.data["return_rate_unit"], "percent")

    def test_statistics_are_admin_only(self):
        self.client.force_authenticate(self.adopter)
        response = self.client.get(reverse("adoption-statistics"))
        self.assertEqual(response.status_code, 403)
