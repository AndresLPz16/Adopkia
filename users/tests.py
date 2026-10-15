from io import StringIO

from django.contrib import admin
from django.core.management import call_command
from django.test import RequestFactory, TestCase
from django.utils import translation
from django.urls import reverse
from rest_framework.test import APITestCase

from adoptions.models import FormQuestion
from myproject.admin import ReadOnlyModelAdmin
from medical.models import Vaccine
from pets.models import Breed, Species
from users.models import Role, User


class DjangoAdminLoginTests(TestCase):
    def test_admin_logs_in_with_email_and_registered_models_are_read_only(self):
        admin_role, _ = Role.objects.get_or_create(name=Role.Name.ADMIN)
        email = "panel-admin@example.com"
        password = "TemporaryTestPassword!2026"
        user = User.objects.create_superuser(
            email=email,
            password=password,
            name="Panel Admin",
        )

        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_superuser)
        with translation.override("es"):
            self.assertEqual(str(User._meta.verbose_name_plural), "Usuarios")
        with translation.override("en"):
            self.assertEqual(str(User._meta.verbose_name_plural), "Users")
        with translation.override("es"):
            login_url = reverse("admin:login")
            index_url = reverse("admin:index")
            user_change_url = reverse("admin:users_user_change", args=(user.pk,))
        response = self.client.post(
            login_url,
            {"username": email, "password": password, "next": index_url},
        )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(self.client.get(index_url).status_code, 200)

        user_page = self.client.get(user_change_url)
        self.assertEqual(user_page.status_code, 200)
        self.assertNotContains(user_page, user.password)
        self.assertNotContains(user_page, "Password:")
        self.assertContains(user_page, "Correo electrónico:")

        english_index = self.client.get("/en/admin/")
        self.assertContains(english_index, "Users")
        self.assertContains(english_index, "Pets")
        with translation.override("en"):
            english_user_url = reverse("admin:users_user_change", args=(user.pk,))
        english_user_page = self.client.get(english_user_url)
        self.assertContains(english_user_page, "Email address:")

        self.assertTrue(admin_role.users.filter(pk=user.pk).exists())
        admin_request = RequestFactory().get("/admin/")
        admin_request.user = user
        for model, model_admin in admin.site._registry.items():
            if model._meta.app_label in {
                "users",
                "shelters",
                "pets",
                "adoptions",
                "medical",
                "messaging",
                "notifications",
            }:
                self.assertIsInstance(model_admin, ReadOnlyModelAdmin)
                self.assertTrue(model_admin.has_view_permission(admin_request))
                self.assertFalse(model_admin.has_add_permission(admin_request))
                self.assertFalse(model_admin.has_change_permission(admin_request))
                self.assertFalse(model_admin.has_delete_permission(admin_request))


class AuthenticationTests(APITestCase):
    def test_public_registration_creates_adopter(self):
        response = self.client.post(
            reverse("register"),
            {
                "email": "adopter@example.com",
                "password": "SafePass!2026",
                "name": "Ana Adoptante",
            },
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["role"], Role.Name.ADOPTER)
        self.assertTrue(User.objects.filter(email="adopter@example.com").exists())

    def test_public_registration_cannot_assign_privileged_role(self):
        response = self.client.post(
            reverse("register"),
            {
                "email": "admin@example.com",
                "password": "SafePass!2026",
                "name": "Admin",
                "role": Role.Name.ADMIN,
            },
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(User.objects.filter(email="admin@example.com").exists())

    def test_jwt_login_and_profile(self):
        User.objects.create_user(
            email="adopter@example.com",
            password="SafePass!2026",
            name="Ana Adoptante",
        )
        login = self.client.post(
            reverse("token_obtain_pair"),
            {"email": "adopter@example.com", "password": "SafePass!2026"},
        )
        self.assertEqual(login.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        profile = self.client.get(reverse("profile"))
        self.assertEqual(profile.status_code, 200)
        self.assertEqual(profile.data["email"], "adopter@example.com")


class SeedDataCommandTests(APITestCase):
    def test_seed_data_is_idempotent_and_matches_sql_catalog_counts(self):
        call_command("seed_data", stdout=StringIO())
        call_command("seed_data", stdout=StringIO())
        self.assertEqual(Role.objects.count(), 4)
        self.assertEqual(Species.objects.count(), 2)
        self.assertEqual(Breed.objects.count(), 13)
        self.assertEqual(Vaccine.objects.count(), 6)
        self.assertEqual(FormQuestion.objects.count(), 10)


class LoadDemoDataCommandTests(APITestCase):
    def test_loads_demo_data_only_when_database_has_no_users(self):
        call_command("seed_data", stdout=StringIO())

        call_command("load_demo_data", stdout=StringIO())
        self.assertEqual(User.objects.count(), 42)
        self.assertEqual(
            User.objects.filter(active=True, role__name=Role.Name.ADMIN).count(),
            8,
        )

        call_command("load_demo_data", stdout=StringIO())
        self.assertEqual(User.objects.count(), 42)
