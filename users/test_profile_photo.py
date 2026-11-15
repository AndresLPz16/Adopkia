from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Role, RolePermission, User


def image_file(name="foto.png", image_format="PNG", size=(4, 4)):
    buffer = BytesIO()
    Image.new("RGB", size, color="purple").save(buffer, format=image_format)
    return SimpleUploadedFile(name, buffer.getvalue(), content_type="image/png")


class ProfilePhotoTests(APITestCase):
    def setUp(self):
        media = TemporaryDirectory()
        self.addCleanup(media.cleanup)
        self.media_root = Path(media.name)
        settings = override_settings(MEDIA_ROOT=media.name)
        settings.enable()
        self.addCleanup(settings.disable)

        self.user = User.objects.create_user(
            email="foto@example.com",
            password="SafePass!2026",
            name="Ana Foto",
        )
        self.client.force_authenticate(self.user)
        self.url = reverse("profile-photo")

    def stored_files(self):
        folder = self.media_root / "avatars"
        return sorted(path.name for path in folder.iterdir()) if folder.exists() else []

    def upload(self, **kwargs):
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post(
                self.url, {"image": image_file(**kwargs)}, format="multipart"
            )

    def test_upload_stores_the_file_and_returns_the_profile_with_its_url(self):
        response = self.upload()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertRegex(self.user.photo_url, r"^/media/avatars/[0-9a-f]{32}\.png$")
        self.assertEqual(response.data["photo_url"], self.user.photo_url)
        self.assertEqual(len(self.stored_files()), 1)
        profile = self.client.get(reverse("profile"))
        self.assertEqual(profile.data["photo_url"], self.user.photo_url)

    def test_replacing_the_photo_deletes_the_previous_file(self):
        self.upload()
        first = self.stored_files()

        response = self.upload(name="otra.jpg", image_format="JPEG")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(self.stored_files()), 1)
        self.assertNotEqual(self.stored_files(), first)
        self.assertTrue(response.data["photo_url"].endswith(".jpg"))

    def test_delete_clears_the_photo_and_its_file(self):
        self.upload()

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.delete(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data["photo_url"])
        self.user.refresh_from_db()
        self.assertIsNone(self.user.photo_url)
        self.assertEqual(self.stored_files(), [])

    def test_deleting_the_account_deletes_its_photo(self):
        self.upload()

        with self.captureOnCommitCallbacks(execute=True):
            self.user.delete()

        self.assertEqual(self.stored_files(), [])

    def test_rejects_files_that_are_not_an_accepted_image(self):
        not_an_image = SimpleUploadedFile(
            "foto.png", b"esto no es una imagen", content_type="image/png"
        )
        response = self.client.post(self.url, {"image": not_an_image}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("image", response.data)

        gif = self.upload(name="foto.gif", image_format="GIF")
        self.assertEqual(gif.status_code, status.HTTP_400_BAD_REQUEST)

        missing = self.client.post(self.url, {}, format="multipart")
        self.assertEqual(missing.status_code, status.HTTP_400_BAD_REQUEST)

        self.assertEqual(self.stored_files(), [])
        self.user.refresh_from_db()
        self.assertIsNone(self.user.photo_url)

    def test_rejects_images_over_the_size_limit(self):
        with override_settings():
            from . import serializers

            original = serializers.AVATAR_MAX_BYTES
            serializers.AVATAR_MAX_BYTES = 10
            self.addCleanup(setattr, serializers, "AVATAR_MAX_BYTES", original)
            response = self.upload()

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("image", response.data)
        self.assertEqual(self.stored_files(), [])

    def test_photo_url_cannot_be_set_through_the_profile_endpoint(self):
        response = self.client.patch(
            reverse("profile"), {"photo_url": "https://example.com/otra.png"}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("photo_url", response.data)

    def test_every_built_in_role_can_change_its_own_photo(self):
        for role_name in (
            Role.Name.ADOPTER,
            Role.Name.SHELTER,
            Role.Name.VETERINARIAN,
            Role.Name.ADMIN,
        ):
            with self.subTest(role=role_name):
                user = User.objects.create_user(
                    email=f"{role_name}@example.com",
                    password="SafePass!2026",
                    name=f"Cuenta {role_name}",
                    role=Role.objects.get(name=role_name),
                )
                self.client.force_authenticate(user)
                self.assertEqual(self.upload().status_code, status.HTTP_200_OK)

    def test_requires_sign_in_and_the_profile_update_permission(self):
        self.client.force_authenticate(None)
        anonymous = self.client.post(self.url, {"image": image_file()}, format="multipart")
        self.assertEqual(anonymous.status_code, status.HTTP_401_UNAUTHORIZED)

        RolePermission.objects.filter(
            role=self.user.role, resource="profile", action="update"
        ).delete()
        self.client.force_authenticate(User.objects.get(pk=self.user.pk))
        denied = self.client.post(self.url, {"image": image_file()}, format="multipart")
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.stored_files(), [])
