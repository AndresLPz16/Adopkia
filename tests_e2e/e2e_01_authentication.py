import unittest
import re

from django.contrib.auth import get_user_model

from users.models import Role

from .common import (
    STATE,
    assert_response,
    login_account,
    new_password,
    record_account,
    request,
)


class E2EAuthenticationHttpFlowTests(unittest.TestCase):
    def test_registration_jwt_refresh_profile_and_sensitive_data(self):
        User = get_user_model()
        prefix = STATE["email_prefix"]

        for alias, role in (
            ("adopter", Role.Name.ADOPTER),
            ("other_adopter", Role.Name.ADOPTER),
            ("shelter", Role.Name.SHELTER),
            ("other_shelter", Role.Name.SHELTER),
        ):
            email = f"{prefix}_{alias}@example.test"
            password = new_password()
            response = request(
                "POST",
                "auth/register/",
                data={
                    "email": email,
                    "username": f"{prefix[:15]}_{alias}",
                    "password": password,
                    "name": f"[E2E] {alias}",
                    "role": role,
                },
            )
            payload = assert_response(self, f"registro/{alias}", response, 201)
            User.objects.filter(pk=payload["id"]).update(email_verified=True)
            record_account(
                alias,
                email=email,
                password=password,
                role=role,
                user_id=payload["id"],
            )

        for alias, role, active in (
            ("admin", Role.Name.ADMIN, True),
            ("veterinarian", Role.Name.VETERINARIAN, True),
            ("inactive", Role.Name.ADOPTER, False),
        ):
            email = f"{prefix}_{alias}@example.test"
            password = new_password()
            user = User.objects.create_user(
                email=email,
                password=password,
                name=f"[E2E] {alias}",
                role=role,
                active=active,
            )
            record_account(
                alias,
                email=email,
                password=password,
                role=role,
                user_id=user.pk,
            )

        for alias in ("adopter", "shelter", "admin", "veterinarian"):
            account = login_account(self, alias)
            refresh = request(
                "POST",
                "auth/refresh/",
                data={"refresh": account["refresh"]},
            )
            refreshed = assert_response(self, f"refresh/{alias}", refresh, 200)
            account["access"] = refreshed["access"]

            profile = request("GET", "auth/me/", token=account["access"])
            data = assert_response(self, f"perfil/{alias}", profile, 200)
            self.assertEqual(data["role"], account["role"])
            self.assertNotIn("password", data)
            self.assertNotIn("contrasena_hash", data)

        login_account(self, "other_adopter")
        login_account(self, "other_shelter")

        api_root = request(
            "GET", "", token=STATE["accounts"]["admin"]["access"]
        )
        api_root_data = assert_response(self, "api-root", api_root, 200)
        self.assertEqual(
            set(api_root_data),
            {
                "register",
                "profile",
                "login",
                "refresh",
                "shelters",
                "shelter-members",
                "species",
                "breeds",
                "pets",
                "pet-photos",
                "form-questions",
                "adoption-requests",
                "adoptions",
                "follow-ups",
                "veterinarians",
                "medical-records",
                "vaccines",
                "reminders",
                "conversations",
                "messages",
                "notifications",
                "statistics",
            },
        )

        inactive = STATE["accounts"]["inactive"]
        inactive_challenge = request("GET", "auth/login-challenge/")
        inactive_challenge_data = assert_response(
            self, "reto-login/inactive", inactive_challenge, 200
        )
        left, right = map(
            int,
            re.findall(r"\d+", inactive_challenge_data["question"]),
        )
        inactive_login = request(
            "POST",
            "auth/login/",
            data={
                "email": inactive["email"],
                "password": inactive["password"],
                "challenge_id": inactive_challenge_data["challenge_id"],
                "challenge_answer": str(left + right),
            },
        )
        assert_response(self, "login-usuario-inactivo", inactive_login, 401)

        duplicate = request(
            "POST",
            "auth/register/",
            data={
                "email": STATE["accounts"]["adopter"]["email"],
                "password": new_password(),
                "name": "[E2E] correo duplicado",
            },
        )
        duplicate_payload = assert_response(self, "registro-correo-duplicado", duplicate, 400)
        self.assertIn("correo", str(duplicate_payload).lower())

        empty = request(
            "POST",
            "auth/register/",
            data={"email": "", "password": "", "name": ""},
        )
        assert_response(self, "registro-campos-obligatorios-vacios", empty, 400)

        privileged_role = request(
            "POST",
            "auth/register/",
            data={
                "email": f'{STATE["email_prefix"]}_privilege@example.test',
                "username": f'{STATE["email_prefix"][:15]}_privilege',
                "password": new_password(),
                "name": "[E2E] rol privilegiado",
                "role": "administrador",
            },
        )
        assert_response(self, "registro-no-asigna-rol-privilegiado", privileged_role, 400)

        STATE["auth_ready"] = True
