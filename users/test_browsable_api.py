from django.test import Client, TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from myproject.api_index import RESOURCE_DEFINITIONS, ROLE_RESOURCES
from pets.models import Breed, Pet, Species
from shelters.models import Shelter, ShelterMember
from users.models import Role, User


class BrowsableApiAuthenticationTests(TestCase):
    password = "BrowsableTest!2026"

    def setUp(self):
        self.users = {}
        for role_name in (
            Role.Name.ADOPTER,
            Role.Name.SHELTER,
            Role.Name.ADMIN,
            Role.Name.VETERINARIAN,
        ):
            role, _ = Role.objects.get_or_create(name=role_name)
            self.users[role_name] = User.objects.create_user(
                email=f"browsable-{role_name}@example.com",
                password=self.password,
                name=f"Browsable {role_name}",
                role=role,
            )

    def test_anonymous_register_and_login_render_and_accept_html_forms(self):
        register_url = reverse("register")
        login_url = reverse("token_obtain_pair")

        for url, field_names in (
            (register_url, (b"email", b"password", b"name")),
            (login_url, (b"email", b"password")),
        ):
            with self.subTest(url=url):
                response = self.client.get(url, HTTP_ACCEPT="text/html")
                self.assertEqual(response.status_code, 405)
                self.assertIn("text/html", response["Content-Type"])
                for field_name in field_names:
                    self.assertIn(field_name, response.content)
                self.assertIn(b"HTML form", response.content)

        registration = self.client.post(
            register_url,
            {
                "email": "browsable-created@example.com",
                "password": self.password,
                "name": "Browsable Created",
            },
            HTTP_ACCEPT="text/html",
        )
        self.assertEqual(registration.status_code, 201)
        login = self.client.post(
            login_url,
            {"email": "browsable-created@example.com", "password": self.password},
            HTTP_ACCEPT="text/html",
        )
        self.assertEqual(login.status_code, 200)
        self.assertIn(b"access", login.content)
        self.assertIn(b"refresh", login.content)

    def test_api_auth_logs_in_with_email_and_exposes_role_aware_session(self):
        administrator = self.users[Role.Name.ADMIN]
        login = self.client.post(
            "/api-auth/login/",
            {
                "username": administrator.email,
                "password": self.password,
                "next": "/api/v1/",
            },
            follow=True,
        )
        self.assertEqual(login.status_code, 200)
        self.assertEqual(self.client.session.get("_auth_user_id"), str(administrator.pk))
        self.assertTrue(administrator.is_staff)
        self.assertTrue(administrator.is_superuser)
        response = self.client.get(
            "/api/v1/pets/", HTTP_ACCEPT="text/html"
        )
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "POST")
        self.assertContains(response, "HTML form")
        self.assertContains(response, "Log out")
        self.assertIn(b'id="post-object-form"', response.content)
        self.assertContains(response, "csrfmiddlewaretoken")

        self.client.post("/api-auth/logout/", {"next": "/api/v1/"})
        self.assertNotIn("_auth_user_id", self.client.session)

        adopter_client = Client()
        adopter = self.users[Role.Name.ADOPTER]
        adopter_client.post(
            "/api-auth/login/",
            {
                "username": adopter.email,
                "password": self.password,
                "next": "/api/v1/",
            },
            follow=True,
        )
        adopter_pet_page = adopter_client.get(
            "/api/v1/pets/", HTTP_ACCEPT="text/html"
        )
        self.assertEqual(adopter_pet_page.status_code, 200)
        self.assertNotIn(b'id="post-object-form"', adopter_pet_page.content)

        shelter_user = self.users[Role.Name.SHELTER]
        shelter = Shelter.objects.create(
            name="Browsable Shelter",
            address="10 Test Street",
            city="Bogota",
        )
        ShelterMember.objects.create(
            shelter=shelter,
            user=shelter_user,
            position=ShelterMember.Position.MANAGER,
        )
        shelter_client = Client()
        shelter_client.post(
            "/api-auth/login/",
            {
                "username": shelter_user.email,
                "password": self.password,
                "next": "/api/v1/",
            },
            follow=True,
        )
        shelter_pet_page = shelter_client.get(
            "/api/v1/pets/", HTTP_ACCEPT="text/html"
        )
        self.assertIn(b'id="post-object-form"', shelter_pet_page.content)

        veterinarian_client = Client()
        veterinarian = self.users[Role.Name.VETERINARIAN]
        veterinarian_client.post(
            "/api-auth/login/",
            {
                "username": veterinarian.email,
                "password": self.password,
                "next": "/api/v1/",
            },
            follow=True,
        )
        veterinarian_pet_page = veterinarian_client.get(
            "/api/v1/pets/", HTTP_ACCEPT="text/html"
        )
        self.assertNotIn(b'id="post-object-form"', veterinarian_pet_page.content)

    def test_csrf_is_required_for_session_authenticated_api_mutations(self):
        adopter = self.users[Role.Name.ADOPTER]
        csrf_client = Client(enforce_csrf_checks=True)
        csrf_client.force_login(adopter)

        response = csrf_client.post(
            "/api/v1/pets/",
            data="{}",
            content_type="application/json",
            HTTP_ACCEPT="application/json",
        )

        self.assertEqual(response.status_code, 403)

    def test_shelter_can_create_pet_with_session_and_other_roles_are_denied(self):
        shelter_user = self.users[Role.Name.SHELTER]
        shelter = Shelter.objects.create(
            name="Pet Form Shelter",
            address="10 Test Street",
            city="Bogota",
        )
        ShelterMember.objects.create(
            shelter=shelter,
            user=shelter_user,
            position=ShelterMember.Position.MANAGER,
        )
        species, _ = Species.objects.get_or_create(name="Browsable Species")
        breed, _ = Breed.objects.get_or_create(
            species=species, name="Browsable Breed"
        )
        pet_data = {
            "shelter": shelter.pk,
            "breed": breed.pk,
            "name": "Browsable Created Pet",
            "size": Pet.Size.MEDIUM,
        }

        shelter_client = Client(enforce_csrf_checks=True)
        shelter_client.force_login(shelter_user)
        shelter_client.get("/api/v1/pets/", HTTP_ACCEPT="text/html")
        csrf_token = shelter_client.cookies["csrftoken"].value
        created = shelter_client.post(
            "/api/v1/pets/",
            pet_data,
            HTTP_ACCEPT="text/html",
            HTTP_X_CSRFTOKEN=csrf_token,
        )
        self.assertEqual(created.status_code, 201)
        self.assertTrue(Pet.objects.filter(name="Browsable Created Pet").exists())

        for role_name in (Role.Name.ADOPTER, Role.Name.VETERINARIAN):
            user = self.users[role_name]
            session_client = Client(enforce_csrf_checks=True)
            session_client.force_login(user)
            session_client.get("/api/v1/pets/", HTTP_ACCEPT="text/html")
            denied = session_client.post(
                "/api/v1/pets/",
                pet_data | {"name": f"Denied {role_name}"},
                HTTP_X_CSRFTOKEN=session_client.cookies["csrftoken"].value,
            )
            self.assertEqual(denied.status_code, 403)

            jwt_client = APIClient()
            token = str(RefreshToken.for_user(user).access_token)
            jwt_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
            jwt_denied = jwt_client.post(
                "/api/v1/pets/", pet_data | {"name": f"Denied {role_name}"}
            )
            self.assertEqual(jwt_denied.status_code, 403)

    def test_browsable_session_and_jwt_keep_the_same_read_permissions(self):
        for role_name, user in self.users.items():
            with self.subTest(role=role_name):
                session_client = Client()
                login = session_client.post(
                    "/api-auth/login/",
                    {
                        "username": user.email,
                        "password": self.password,
                        "next": "/api/v1/",
                    },
                    follow=True,
                )
                self.assertEqual(login.status_code, 200)

                jwt_client = APIClient()
                access_token = str(RefreshToken.for_user(user).access_token)
                jwt_client.credentials(
                    HTTP_AUTHORIZATION=f"Bearer {access_token}"
                )

                for resource_key, (_, url) in RESOURCE_DEFINITIONS.items():
                    accept = (
                        "text/html"
                        if resource_key == "api_docs"
                        else "application/json"
                    )
                    with self.subTest(resource=resource_key):
                        session_response = session_client.get(
                            url, HTTP_ACCEPT=accept
                        )
                        jwt_response = jwt_client.get(url, HTTP_ACCEPT=accept)
                        self.assertEqual(
                            session_response.status_code,
                            jwt_response.status_code,
                        )

    def test_root_uses_the_standard_browsable_api_root(self):
        english = self.client.get("/?lang=en", HTTP_ACCEPT="text/html")
        spanish = self.client.get("/?lang=es", HTTP_ACCEPT="text/html")

        self.assertEqual(english.status_code, 200)
        self.assertEqual(spanish.status_code, 200)
        self.assertContains(english, "Log in")
        self.assertContains(english, "Api Root")
        self.assertContains(english, "Root endpoint for the Adopkia API.")
        self.assertContains(spanish, "Raíz de la API")
        self.assertContains(spanish, "Raíz de la API de Adopkia.")
        self.assertNotContains(english, "← Volver a Adopkia")

    def test_login_form_is_localized_in_spanish_and_english(self):
        spanish = self.client.get(
            "/api-auth/login/?lang=es", HTTP_ACCEPT="text/html"
        )
        english = self.client.get(
            "/api-auth/login/?lang=en", HTTP_ACCEPT="text/html"
        )
        english_header = self.client.get(
            "/api-auth/login/",
            HTTP_ACCEPT="text/html",
            HTTP_ACCEPT_LANGUAGE="en",
        )

        self.assertEqual(spanish.status_code, 200)
        self.assertEqual(english.status_code, 200)
        self.assertEqual(english_header.status_code, 200)
        self.assertContains(spanish, "Correo")
        self.assertContains(english, "Email")
        self.assertContains(english_header, "Email")
        self.assertEqual(reverse("rest_framework:login"), "/api-auth/login/")
        self.assertEqual(reverse("rest_framework:logout"), "/api-auth/logout/")

    def test_session_login_and_logout_redirect_to_root_by_default(self):
        administrator = self.users[Role.Name.ADMIN]
        login = self.client.post(
            "/api-auth/login/",
            {"username": administrator.email, "password": self.password},
        )

        self.assertEqual(login.status_code, 302)
        self.assertEqual(login["Location"], "/")

        logout = self.client.post("/api-auth/logout/")

        self.assertEqual(logout.status_code, 302)
        self.assertEqual(logout["Location"], "/")

    def test_authenticated_root_shows_role_and_its_resources(self):
        adopter = self.users[Role.Name.ADOPTER]
        self.client.force_login(adopter)

        response = self.client.get("/", HTTP_ACCEPT="application/json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["role_code"], Role.Name.ADOPTER)
        self.assertEqual(
            {resource["key"] for resource in response.json()["resources"]},
            set(ROLE_RESOURCES[Role.Name.ADOPTER]),
        )

    def test_jwt_still_authenticates_api_clients_without_a_session(self):
        adopter = self.users[Role.Name.ADOPTER]
        client = APIClient()
        access_token = str(RefreshToken.for_user(adopter).access_token)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")

        response = client.get("/api/v1/auth/me/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["email"], adopter.email)
        self.assertNotIn("sessionid", client.cookies)
