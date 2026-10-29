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
from notifications.models import Notification
from pets.models import Breed, Species
from users.models import Role, RolePermission, User


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
        self.assertFalse(profile.data["is_platform_superadmin"])


class RolePermissionApiTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            email="permission-admin@example.com",
            password="SafePass!2026",
            name="Permission Admin",
        )
        self.adopter_role = Role.objects.get(name=Role.Name.ADOPTER)

    def test_authenticated_user_can_read_role_permission_catalog(self):
        adopter = User.objects.create_user(
            email="permission-adopter@example.com",
            password="SafePass!2026",
            name="Permission Adopter",
        )
        self.client.force_authenticate(adopter)

        response = self.client.get(reverse("role-permissions"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            {resource["key"] for resource in response.data["resources"]},
            {
                "dashboard",
                "profile",
                "pets",
                "petPhotos",
                "shelters",
                "shelterMembers",
                "formQuestions",
                "adoptionRequests",
                "adoptions",
                "followUps",
                "veterinarians",
                "medicalRecords",
                "vaccines",
                "reminders",
                "conversations",
                "messages",
                "notifications",
                "users",
                "statistics",
            },
        )
        adopter_data = next(
            role for role in response.data["roles"] if role["name"] == "adoptante"
        )
        self.assertIn(
            {"resource": "pets", "action": "read"},
            adopter_data["permissions"],
        )

    def test_only_administrator_can_replace_role_permissions(self):
        self.client.force_authenticate(self.admin)
        payload = [
            {"resource": "pets", "action": "read"},
            {"resource": "pets", "action": "create"},
        ]

        response = self.client.put(
            reverse(
                "role-permissions-update",
                kwargs={"role_name": Role.Name.ADOPTER},
            ),
            payload,
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            set(
                RolePermission.objects.filter(role=self.adopter_role).values_list(
                    "resource", "action"
                )
            ),
            {("pets", "read"), ("pets", "create")},
        )

        adopter = User.objects.create_user(
            email="non-admin-editor@example.com",
            password="SafePass!2026",
            name="Non Admin",
        )
        self.client.force_authenticate(adopter)
        response = self.client.put(
            reverse(
                "role-permissions-update",
                kwargs={"role_name": Role.Name.ADOPTER},
            ),
            payload,
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_role_permission_update_rejects_invalid_and_duplicate_entries(self):
        self.client.force_authenticate(self.admin)
        url = reverse(
            "role-permissions-update",
            kwargs={"role_name": Role.Name.ADOPTER},
        )

        invalid = self.client.put(
            url,
            [{"resource": "secret-data", "action": "read"}],
            format="json",
        )
        duplicate = self.client.put(
            url,
            [
                {"resource": "pets", "action": "read"},
                {"resource": "pets", "action": "read"},
            ],
            format="json",
        )

        self.assertEqual(invalid.status_code, 400)
        self.assertEqual(duplicate.status_code, 400)

    def test_administrator_cannot_remove_its_role_management_permission(self):
        self.client.force_authenticate(self.admin)

        response = self.client.put(
            reverse(
                "role-permissions-update",
                kwargs={"role_name": Role.Name.ADMIN},
            ),
            [{"resource": "dashboard", "action": "read"}],
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertTrue(
            RolePermission.objects.filter(
                role=self.admin.role,
                resource="users",
                action="manage",
            ).exists()
        )

    def test_role_matrix_management_requires_users_manage_grant(self):
        RolePermission.objects.filter(
            role=self.admin.role,
            resource="users",
            action="manage",
        ).delete()
        self.client.force_authenticate(self.admin)
        response = self.client.put(
            reverse(
                "role-permissions-update",
                kwargs={"role_name": Role.Name.ADOPTER},
            ),
            [{"resource": "pets", "action": "read"}],
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_role_permission_changes_take_effect_on_api_access(self):
        adopter = User.objects.create_user(
            email="dynamic-permission-adopter@example.com",
            password="SafePass!2026",
            name="Dynamic Permission Adopter",
        )
        self.client.force_authenticate(adopter)

        allowed = self.client.get("/api/v1/messages/")
        self.assertEqual(allowed.status_code, 200)

        RolePermission.objects.filter(
            role=adopter.role,
            resource="messages",
            action="read",
        ).delete()
        denied = self.client.get("/api/v1/messages/")
        self.assertEqual(denied.status_code, 403)
        index = self.client.get(reverse("api-root"))
        self.assertNotIn(
            "messages",
            {resource["key"] for resource in index.data["resources"]},
        )

        RolePermission.objects.create(
            role=adopter.role,
            resource="messages",
            action="read",
        )
        restored = self.client.get("/api/v1/messages/")
        self.assertEqual(restored.status_code, 200)

    def test_user_management_is_role_gated_and_never_returns_password(self):
        adopter = User.objects.create_user(
            email="user-management-adopter@example.com",
            password="SafePass!2026",
            name="User Management Adopter",
        )
        self.client.force_authenticate(adopter)
        denied = self.client.get(reverse("user-list"))
        self.assertEqual(denied.status_code, 403)

        self.client.force_authenticate(self.admin)
        allowed = self.client.get(reverse("user-list"))
        self.assertEqual(allowed.status_code, 200)
        self.assertTrue(allowed.data)
        self.assertNotIn("password", allowed.data[0])
        self.assertNotIn("is_platform_superadmin", allowed.data[0])

        self.admin.is_platform_superadmin = True
        self.admin.save(update_fields=("is_platform_superadmin",))
        visible_to_superadmin = self.client.get(reverse("user-list"))
        self.assertIn("is_platform_superadmin", visible_to_superadmin.data[0])

    def test_users_with_manage_permission_can_create_and_update_accounts(self):
        self.client.force_authenticate(self.admin)
        created = self.client.post(
            reverse("user-list"),
            {
                "email": "managed-account@example.com",
                "password": "Very-Safe-Unique-Password!2026",
                "name": "Managed Account",
                "role": Role.Name.ADOPTER,
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        self.assertNotIn("password", created.data)

        user = User.objects.get(email="managed-account@example.com")
        self.assertTrue(user.check_password("Very-Safe-Unique-Password!2026"))
        updated = self.client.patch(
            reverse("user-detail", kwargs={"pk": user.pk}),
            {"active": False},
            format="json",
        )
        self.assertEqual(updated.status_code, 200)
        user.refresh_from_db()
        self.assertFalse(user.active)

    def test_custom_role_permissions_control_api_access_and_can_be_assigned(self):
        self.client.force_authenticate(self.admin)
        created_role = self.client.post(
            reverse("role-list"),
            {
                "name": "content_moderator",
                "label": "Moderador de contenido",
                "description": "Revisa contenido de la plataforma.",
            },
            format="json",
        )
        self.assertEqual(created_role.status_code, 201)
        role = Role.objects.get(name="content_moderator")

        updated_permissions = self.client.put(
            reverse("role-permissions-update", kwargs={"role_name": role.name}),
            [{"resource": "profile", "action": "read"}],
            format="json",
        )
        self.assertEqual(updated_permissions.status_code, 200)

        created_user = self.client.post(
            reverse("user-list"),
            {
                "email": "moderator@example.com",
                "password": "Very-Safe-Unique-Password!2026",
                "name": "Content Moderator",
                "role": role.name,
            },
            format="json",
        )
        self.assertEqual(created_user.status_code, 201)
        self.assertNotIn("password", created_user.data)

        moderator = User.objects.get(email="moderator@example.com")
        self.client.force_authenticate(moderator)
        self.assertEqual(self.client.get(reverse("profile")).status_code, 200)
        RolePermission.objects.filter(role=role, resource="profile").delete()
        self.assertEqual(self.client.get(reverse("profile")).status_code, 403)

        self.client.force_authenticate(self.admin)
        renamed = self.client.patch(
            reverse("role-detail", kwargs={"pk": role.pk}),
            {"label": "Moderación"},
            format="json",
        )
        self.assertEqual(renamed.status_code, 200)
        self.assertEqual(renamed.data["label"], "Moderación")
        blocked_delete = self.client.delete(
            reverse("role-detail", kwargs={"pk": role.pk})
        )
        self.assertEqual(blocked_delete.status_code, 400)

    def test_system_roles_are_immutable_and_custom_role_assignment_is_admin_only(self):
        self.client.force_authenticate(self.admin)
        custom_role_response = self.client.post(
            reverse("role-list"),
            {"name": "support_agent", "label": "Agente de soporte"},
            format="json",
        )
        self.assertEqual(custom_role_response.status_code, 201)
        custom_role = Role.objects.get(name="support_agent")

        system_role = Role.objects.get(name=Role.Name.ADOPTER)
        self.assertEqual(
            self.client.patch(
                reverse("role-detail", kwargs={"pk": system_role.pk}),
                {"label": "Nuevo nombre"},
                format="json",
            ).status_code,
            400,
        )
        self.assertEqual(
            self.client.delete(reverse("role-detail", kwargs={"pk": system_role.pk})).status_code,
            400,
        )

        manager = User.objects.create_user(
            email="custom-role-manager@example.com",
            password="Very-Safe-Unique-Password!2026",
            name="Custom Role Manager",
        )
        RolePermission.objects.create(
            role=manager.role,
            resource="users",
            action="manage",
        )
        self.client.force_authenticate(manager)
        denied = self.client.post(
            reverse("user-list"),
            {
                "email": "unauthorized-custom@example.com",
                "password": "Very-Safe-Unique-Password!2026",
                "name": "Unauthorized Custom",
                "role": custom_role.name,
            },
            format="json",
        )
        self.assertEqual(denied.status_code, 403)

    def test_only_platform_superadmin_can_manage_administrator_accounts(self):
        ordinary_admin = User.objects.create_user(
            email="ordinary-admin-target@example.com",
            password="Very-Safe-Unique-Password!2026",
            name="Ordinary Admin Target",
            role=Role.Name.ADMIN,
        )
        self.client.force_authenticate(self.admin)

        created = self.client.post(
            reverse("user-list"),
            {
                "email": "new-ordinary-admin@example.com",
                "password": "Very-Safe-Unique-Password!2026",
                "name": "New Ordinary Admin",
                "role": Role.Name.ADMIN,
            },
            format="json",
        )
        updated = self.client.patch(
            reverse("user-detail", kwargs={"pk": ordinary_admin.pk}),
            {"active": False},
            format="json",
        )
        deleted = self.client.delete(
            reverse("user-detail", kwargs={"pk": ordinary_admin.pk})
        )
        permission_update = self.client.put(
            reverse(
                "role-permissions-update",
                kwargs={"role_name": Role.Name.ADMIN},
            ),
            [{"resource": "dashboard", "action": "read"}],
            format="json",
        )

        self.assertEqual(created.status_code, 403)
        self.assertEqual(updated.status_code, 403)
        self.assertEqual(deleted.status_code, 403)
        self.assertEqual(permission_update.status_code, 403)
        ordinary_admin.refresh_from_db()
        self.assertTrue(ordinary_admin.active)

    def test_platform_superadmin_has_full_access_and_its_account_is_protected(self):
        platform_superadmin = User.objects.create_superuser(
            email="platform-superadmin@example.com",
            password="Very-Safe-Unique-Password!2026",
            name="Platform Superadmin",
        )
        platform_superadmin.is_platform_superadmin = True
        platform_superadmin.save(update_fields=("is_platform_superadmin",))
        RolePermission.objects.filter(role=platform_superadmin.role).delete()
        self.client.force_authenticate(platform_superadmin)
        profile = self.client.get(reverse("profile"))
        self.assertEqual(profile.status_code, 200)
        self.assertTrue(profile.data["is_platform_superadmin"])
        self.assertEqual(profile.data["role"], Role.Name.ADMIN)

        created_admin = self.client.post(
            reverse("user-list"),
            {
                "email": "created-by-superadmin@example.com",
                "password": "Very-Safe-Unique-Password!2026",
                "name": "Managed Administrator",
                "role": Role.Name.ADMIN,
            },
            format="json",
        )
        self.assertEqual(created_admin.status_code, 201)
        self.assertFalse(created_admin.data["is_platform_superadmin"])
        self.assertEqual(self.client.get("/api/v1/messages/").status_code, 200)
        admin_permissions = self.client.put(
            reverse(
                "role-permissions-update",
                kwargs={"role_name": Role.Name.ADMIN},
            ),
            [
                {"resource": "users", "action": "manage"},
                {"resource": "dashboard", "action": "read"},
            ],
            format="json",
        )
        self.assertEqual(admin_permissions.status_code, 200)

        managed_admin = User.objects.get(email="created-by-superadmin@example.com")
        demoted_admin = self.client.patch(
            reverse("user-detail", kwargs={"pk": managed_admin.pk}),
            {"role": Role.Name.ADOPTER},
            format="json",
        )
        self.assertEqual(demoted_admin.status_code, 200)
        self.assertEqual(demoted_admin.data["role"], Role.Name.ADOPTER)

        demoted = self.client.patch(
            reverse("user-detail", kwargs={"pk": platform_superadmin.pk}),
            {"role": Role.Name.ADOPTER},
            format="json",
        )
        deactivated = self.client.patch(
            reverse("user-detail", kwargs={"pk": platform_superadmin.pk}),
            {"active": False},
            format="json",
        )
        deleted = self.client.delete(
            reverse("user-detail", kwargs={"pk": platform_superadmin.pk})
        )
        self.assertEqual(demoted.status_code, 400)
        self.assertEqual(deactivated.status_code, 400)
        self.assertEqual(deleted.status_code, 400)
        platform_superadmin.refresh_from_db()
        self.assertTrue(platform_superadmin.active)
        self.assertTrue(platform_superadmin.is_platform_superadmin)

    def test_user_api_cannot_grant_platform_superadmin_flag(self):
        self.client.force_authenticate(self.admin)
        created = self.client.post(
            reverse("user-list"),
            {
                "email": "not-superadmin@example.com",
                "password": "Very-Safe-Unique-Password!2026",
                "name": "Not Superadmin",
                "role": Role.Name.ADOPTER,
                "is_platform_superadmin": True,
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        self.assertNotIn("is_platform_superadmin", created.data)
        account = User.objects.get(email="not-superadmin@example.com")
        self.assertFalse(account.is_platform_superadmin)

    def test_non_admin_cannot_assign_privileged_role_and_last_admin_is_protected(self):
        manager = User.objects.create_user(
            email="user-manager@example.com",
            password="SafePass!2026",
            name="User Manager",
        )
        RolePermission.objects.create(
            role=manager.role,
            resource="users",
            action="manage",
        )
        veterinarian_role = Role.objects.get(name=Role.Name.VETERINARIAN)
        self.client.force_authenticate(manager)
        denied = self.client.post(
            reverse("user-list"),
            {
                "email": "unapproved-vet@example.com",
                "password": "Very-Safe-Unique-Password!2026",
                "name": "Unapproved Vet",
                "role": veterinarian_role.name,
            },
            format="json",
        )
        self.assertEqual(denied.status_code, 403)

        RolePermission.objects.filter(role=self.admin.role).delete()
        RolePermission.objects.create(
            role=self.admin.role,
            resource="users",
            action="manage",
        )
        self.client.force_authenticate(self.admin)
        last_admin = self.client.patch(
            reverse("user-detail", kwargs={"pk": self.admin.pk}),
            {"active": False},
            format="json",
        )
        self.assertEqual(last_admin.status_code, 400)


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
        self.assertEqual(Notification.objects.count(), 39)
        self.assertEqual(
            User.objects.filter(active=True, role__name=Role.Name.ADMIN).count(),
            8,
        )

        call_command("load_demo_data", stdout=StringIO())
        self.assertEqual(User.objects.count(), 42)
