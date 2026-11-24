from datetime import date

from django.urls import reverse
from rest_framework.test import APITestCase

from medical.models import Vaccine
from shelters.models import Shelter
from users.models import Role, User

from .models import Breed, Pet, Species
from .views import DEFAULT_BREED_NAME


class SpeciesCatalogTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email="admin@example.com",
            password="SafePass!2026",
            name="Admin",
            role=Role.Name.ADMIN,
        )
        self.shelter_user = User.objects.create_user(
            email="shelter@example.com",
            password="SafePass!2026",
            name="Refugio",
            role=Role.Name.SHELTER,
        )
        self.dog = Species.objects.create(name="Perro")
        self.mixed = Breed.objects.create(species=self.dog, name="Mestizo")

    def test_anyone_can_read_the_catalog_but_only_the_admin_can_edit_it(self):
        self.assertEqual(self.client.get(reverse("species-list")).status_code, 200)
        self.assertEqual(self.client.get(reverse("breed-list")).status_code, 200)

        self.client.force_authenticate(self.shelter_user)
        refused = self.client.post(reverse("species-list"), {"name": "Tortuga"}, format="json")
        self.assertEqual(refused.status_code, 403)

        self.client.force_authenticate(self.admin)
        created = self.client.post(reverse("species-list"), {"name": "  Tortuga  "}, format="json")
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.data["name"], "Tortuga")

    def test_new_species_comes_with_a_default_breed_so_shelters_can_publish(self):
        self.client.force_authenticate(self.admin)
        created = self.client.post(reverse("species-list"), {"name": "Conejo"}, format="json")

        breeds = Breed.objects.filter(species_id=created.data["id"])
        self.assertEqual([breed.name for breed in breeds], [DEFAULT_BREED_NAME])

    def test_names_are_unique_ignoring_case(self):
        self.client.force_authenticate(self.admin)

        species = self.client.post(reverse("species-list"), {"name": "perro"}, format="json")
        breed = self.client.post(
            reverse("breed-list"), {"species": self.dog.pk, "name": "MESTIZO"}, format="json"
        )
        other_species_same_breed = self.client.post(
            reverse("species-list"), {"name": "Gato"}, format="json"
        )
        cat_mixed = self.client.post(
            reverse("breed-list"),
            {"species": other_species_same_breed.data["id"], "name": "Mestizo"},
            format="json",
        )

        self.assertEqual(species.status_code, 400)
        self.assertIn("name", species.data)
        self.assertEqual(breed.status_code, 400)
        self.assertIn("name", breed.data)
        self.assertEqual(cat_mixed.status_code, 201)

    def test_admin_renames_and_adds_breeds(self):
        self.client.force_authenticate(self.admin)

        renamed = self.client.patch(
            reverse("breed-detail", args=(self.mixed.pk,)), {"name": "Criollo"}, format="json"
        )
        added = self.client.post(
            reverse("breed-list"), {"species": self.dog.pk, "name": "Labrador"}, format="json"
        )

        self.assertEqual(renamed.status_code, 200)
        self.assertEqual(added.status_code, 201)
        self.assertEqual(
            sorted(Breed.objects.filter(species=self.dog).values_list("name", flat=True)),
            ["Criollo", "Labrador"],
        )

    def test_catalog_entries_in_use_cannot_be_deleted(self):
        shelter = Shelter.objects.create(name="Huellas", address="Calle 1", city="Riohacha")
        Pet.objects.create(
            shelter=shelter,
            breed=self.mixed,
            name="Luna",
            approximate_birth_date=date(2023, 1, 1),
            size=Pet.Size.MEDIUM,
        )
        cat = Species.objects.create(name="Gato")
        Vaccine.objects.create(species=cat, name="Triple felina")
        self.client.force_authenticate(self.admin)

        breed_in_use = self.client.delete(reverse("breed-detail", args=(self.mixed.pk,)))
        species_with_pets = self.client.delete(reverse("species-detail", args=(self.dog.pk,)))
        species_with_vaccines = self.client.delete(reverse("species-detail", args=(cat.pk,)))

        self.assertEqual(breed_in_use.status_code, 400)
        self.assertEqual(species_with_pets.status_code, 400)
        self.assertEqual(species_with_vaccines.status_code, 400)
        self.assertTrue(Breed.objects.filter(pk=self.mixed.pk).exists())

    def test_unused_species_is_deleted_with_its_breeds(self):
        self.client.force_authenticate(self.admin)
        created = self.client.post(reverse("species-list"), {"name": "Tortuga"}, format="json")

        deleted = self.client.delete(reverse("species-detail", args=(created.data["id"],)))

        self.assertEqual(deleted.status_code, 204)
        self.assertFalse(Species.objects.filter(pk=created.data["id"]).exists())
        self.assertFalse(Breed.objects.filter(species_id=created.data["id"]).exists())
