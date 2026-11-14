from datetime import date
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from PIL import Image
from rest_framework.test import APITestCase

from adoptions.models import Adoption, AdoptionRequest
from shelters.models import Shelter, ShelterMember
from users.models import Role, User

from .models import Breed, Pet, PetPhoto, Species


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
            health="Está en tratamiento veterinario.",
        )

    def test_public_pet_search_returns_calculated_age_and_catalog_filters(self):
        response = self.client.get(
            reverse("pet-list"),
            {"species": self.species.pk, "breed": self.breed.pk, "city": "Riohacha"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertIsInstance(response.data["results"][0]["age"], int)
        self.assertEqual(response.data["results"][0]["shelter_name"], "Huellas")
        self.assertEqual(response.data["results"][0]["breed_name"], "Mestizo")
        self.assertEqual(
            response.data["results"][0]["health"],
            "Está en tratamiento veterinario.",
        )

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

    def test_shelter_can_relist_returned_pet_without_active_adoption(self):
        self.pet.status = Pet.Status.RETURNED
        self.pet.save(update_fields=("status",))
        self.client.force_authenticate(self.owner)

        response = self.client.post(reverse("pet-relist", args=(self.pet.pk,)))

        self.assertEqual(response.status_code, 200)
        self.pet.refresh_from_db()
        self.assertEqual(self.pet.status, Pet.Status.AVAILABLE)

    def test_shelter_cannot_relist_pet_with_active_adoption(self):
        request = AdoptionRequest.objects.create(
            applicant=User.objects.create_user(
                email="adopter@example.com",
                password="test-password",
                name="Adoptante",
            ),
            pet=self.pet,
            status=AdoptionRequest.Status.APPROVED,
        )
        Adoption.objects.create(
            request=request,
            adoption_date=date.today(),
            status=Adoption.Status.ACTIVE,
        )
        self.pet.status = Pet.Status.RETURNED
        self.pet.save(update_fields=("status",))
        self.client.force_authenticate(self.owner)

        response = self.client.post(reverse("pet-relist", args=(self.pet.pk,)))

        self.assertEqual(response.status_code, 400)
        self.pet.refresh_from_db()
        self.assertEqual(self.pet.status, Pet.Status.RETURNED)

    def test_shelter_can_add_photo_url_to_pet(self):
        self.client.force_authenticate(self.owner)
        response = self.client.post(
            reverse("pet-photo-list"),
            {
                "pet": self.pet.pk,
                "url": "https://example.com/luna.jpg",
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            PetPhoto.objects.get(pk=response.data["id"]).url,
            "https://example.com/luna.jpg",
        )

    def test_shelter_can_upload_photo_file_to_pet(self):
        self.client.force_authenticate(self.owner)
        image_buffer = BytesIO()
        Image.new("RGB", (1, 1), color="red").save(image_buffer, format="PNG")
        image = SimpleUploadedFile(
            "luna.png",
            image_buffer.getvalue(),
            content_type="image/png",
        )

        with TemporaryDirectory() as media_root, override_settings(MEDIA_ROOT=media_root):
            response = self.client.post(
                reverse("pet-photo-list"),
                {"pet": self.pet.pk, "image": image},
                format="multipart",
            )

            self.assertEqual(response.status_code, 201)
            photo = PetPhoto.objects.get(pk=response.data["id"])
            self.assertTrue(photo.url.startswith("/media/pets/"))
            self.assertTrue(
                Path(media_root, photo.url.removeprefix("/media/")).is_file()
            )

    def _upload_photo(self):
        image_buffer = BytesIO()
        Image.new("RGB", (1, 1), color="red").save(image_buffer, format="PNG")
        response = self.client.post(
            reverse("pet-photo-list"),
            {
                "pet": self.pet.pk,
                "image": SimpleUploadedFile(
                    "luna.png", image_buffer.getvalue(), content_type="image/png"
                ),
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, 201)
        return PetPhoto.objects.get(pk=response.data["id"])

    def test_deleting_an_uploaded_photo_removes_its_file(self):
        self.client.force_authenticate(self.owner)
        with TemporaryDirectory() as media_root, override_settings(MEDIA_ROOT=media_root):
            photo = self._upload_photo()
            stored_file = Path(media_root, photo.url.removeprefix("/media/"))
            self.assertTrue(stored_file.is_file())

            with self.captureOnCommitCallbacks(execute=True):
                response = self.client.delete(
                    reverse("pet-photo-detail", args=(photo.pk,))
                )

            self.assertEqual(response.status_code, 204)
            self.assertFalse(stored_file.exists())

    def test_deleting_a_pet_removes_the_files_of_its_uploaded_photos(self):
        self.client.force_authenticate(self.owner)
        with TemporaryDirectory() as media_root, override_settings(MEDIA_ROOT=media_root):
            photo = self._upload_photo()
            stored_file = Path(media_root, photo.url.removeprefix("/media/"))

            with self.captureOnCommitCallbacks(execute=True):
                self.pet.delete()

            self.assertFalse(PetPhoto.objects.filter(pk=photo.pk).exists())
            self.assertFalse(stored_file.exists())

    def test_file_is_kept_when_the_deletion_is_rolled_back(self):
        self.client.force_authenticate(self.owner)
        with TemporaryDirectory() as media_root, override_settings(MEDIA_ROOT=media_root):
            photo = self._upload_photo()
            stored_file = Path(media_root, photo.url.removeprefix("/media/"))

            with self.captureOnCommitCallbacks(execute=False) as callbacks:
                photo.delete()

            # Sin confirmar la transacción el archivo sigue en su sitio.
            self.assertEqual(len(callbacks), 1)
            self.assertTrue(stored_file.is_file())

    def test_photo_registered_by_link_never_touches_the_storage(self):
        from .signals import uploaded_photo_name

        for url in (
            "https://example.com/luna.jpg",
            "https://example.com/media/pets/0123456789abcdef0123456789abcdef.png",
            "/media/pets/../../settings.py",
            "/media/pets/luna.png",
            "/media/otros/0123456789abcdef0123456789abcdef.png",
            "",
        ):
            self.assertIsNone(uploaded_photo_name(url), url)
        self.assertEqual(
            uploaded_photo_name("/media/pets/0123456789abcdef0123456789abcdef.png"),
            "pets/0123456789abcdef0123456789abcdef.png",
        )

        # Azure Blob Storage devuelve URL absolutas y normaliza el nombre
        # pedido (quita la barra final de una carpeta).
        blob_base = "https://cuenta.blob.core.windows.net/media/"
        with patch(
            "pets.signals.default_storage.url",
            side_effect=lambda name: blob_base + name.rstrip("/"),
        ):
            self.assertEqual(
                uploaded_photo_name(
                    blob_base + "pets/0123456789abcdef0123456789abcdef.png"
                ),
                "pets/0123456789abcdef0123456789abcdef.png",
            )
            self.assertIsNone(
                uploaded_photo_name(
                    "https://otra.blob.core.windows.net/media/pets/"
                    "0123456789abcdef0123456789abcdef.png"
                )
            )

        photo = PetPhoto.objects.create(
            pet=self.pet, url="https://example.com/luna.jpg"
        )
        with self.captureOnCommitCallbacks(execute=True) as callbacks:
            photo.delete()
        self.assertEqual(callbacks, [])

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
