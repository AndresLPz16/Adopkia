import unittest
import time
from datetime import date

from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import AccessToken

from .common import (
    STATE,
    assert_response,
    count_notifications,
    require_state,
    request,
)


class E2EAuthorizationHttpFlowTests(unittest.TestCase):
    def test_role_boundaries_object_isolation_tokens_and_cors(self):
        require_state(self, "auth_ready", "adoption_flow_ready")
        adopter = STATE["accounts"]["adopter"]
        other_adopter = STATE["accounts"]["other_adopter"]
        shelter = STATE["accounts"]["shelter"]
        other_shelter = STATE["accounts"]["other_shelter"]
        admin = STATE["accounts"]["admin"]
        anonymous_profile = request("GET", "auth/me/")
        assert_response(self, "perfil-sin-token", anonymous_profile, 401)
        invalid_token = request("GET", "auth/me/", token="invalid.token.value")
        assert_response(self, "perfil-token-invalido", invalid_token, 401)

        User = get_user_model()
        user = User.objects.get(pk=adopter["user_id"])
        expired = AccessToken.for_user(user)
        expired["exp"] = int(time.time()) - 60
        expired_token = str(expired)
        expired_response = request("GET", "auth/me/", token=expired_token)
        assert_response(self, "perfil-token-vencido", expired_response, 401)

        for alias in ("adopter", "shelter", "veterinarian"):
            account = STATE["accounts"][alias]
            response = request(
                "GET", "statistics/adoptions/", token=account["access"]
            )
            assert_response(self, f"estadistica-denegada-{alias}", response, 403)
        anonymous_statistics = request("GET", "statistics/adoptions/")
        assert_response(self, "estadistica-anonima", anonymous_statistics, 401)

        for alias in ("shelter", "veterinarian"):
            account = STATE["accounts"][alias]
            response = request(
                "PATCH",
                "auth/me/",
                token=account["access"],
                data={"role": "administrador"},
            )
            payload = assert_response(
                self, f"impedir-cambio-rol-{alias}", response, 400
            )
            self.assertIn("no se puede modificar", str(payload).lower())
            protected_user = User.objects.get(pk=account["user_id"])
            self.assertEqual(protected_user.role.name, account["role"])

        invalid_status = request(
            "PATCH",
            f'pets/{STATE["pet_id"]}/',
            token=shelter["access"],
            data={"status": "estado_inexistente"},
        )
        assert_response(self, "rechazar-estado-inexistente", invalid_status, 400)

        foreign_request_get = request(
            "GET",
            f'adoption-requests/{STATE["request_id"]}/',
            token=other_adopter["access"],
        )
        assert_response(self, "solicitud-ajena-oculta", foreign_request_get, 404)
        foreign_request_patch = request(
            "PATCH",
            f'adoption-requests/{STATE["request_id"]}/',
            token=other_adopter["access"],
            data={"pet": STATE["pet_id"]},
        )
        assert_response(self, "modificar-solicitud-ajena-oculta", foreign_request_patch, 404)

        foreign_conversation = request(
            "GET",
            f'conversations/{STATE["conversation_id"]}/',
            token=other_adopter["access"],
        )
        assert_response(self, "conversacion-ajena-oculta", foreign_conversation, 404)
        foreign_conversation_patch = request(
            "PATCH",
            f'conversations/{STATE["conversation_id"]}/',
            token=other_adopter["access"],
            data={"shelter": STATE["shelter_id"]},
        )
        assert_response(
            self, "modificar-conversacion-ajena-oculta", foreign_conversation_patch, 404
        )

        adopter_notifications, _ = count_notifications(self, "adopter", "aprobacion")
        self.assertGreaterEqual(adopter_notifications, 1)
        notification_id = STATE["approval_notification_id"]
        foreign_notification = request(
            "GET",
            f'notifications/{notification_id}/',
            token=other_adopter["access"],
        )
        assert_response(self, "notificacion-ajena-oculta", foreign_notification, 404)
        foreign_notification_patch = request(
            "PATCH",
            f'notifications/{notification_id}/',
            token=other_adopter["access"],
            data={"is_read": True},
        )
        assert_response(
            self, "modificar-notificacion-ajena-oculta", foreign_notification_patch, 404
        )

        second_shelter = request(
            "POST",
            "shelters/",
            token=other_shelter["access"],
            data={
                "name": f'[E2E] Refugio ajeno {STATE["suffix"]}',
                "address": "Carrera de prueba 456",
                "city": STATE["city"],
            },
        )
        second_shelter_data = assert_response(
            self, "crear-segundo-refugio", second_shelter, 201
        )
        STATE["other_shelter_id"] = second_shelter_data["id"]
        verify = request(
            "POST",
            f'shelters/{STATE["other_shelter_id"]}/verify/',
            token=admin["access"],
            data={"approved": True},
        )
        assert_response(self, "verificar-segundo-refugio", verify, 200)

        foreign_pet_update = request(
            "PATCH",
            f'pets/{STATE["pet_id"]}/',
            token=other_shelter["access"],
            data={"name": "[E2E] intento de edición ajena"},
        )
        assert_response(self, "refugio-no-edita-mascota-ajena", foreign_pet_update, 403)
        foreign_shelter_request = request(
            "GET",
            f'adoption-requests/{STATE["request_id"]}/',
            token=other_shelter["access"],
        )
        assert_response(self, "refugio-no-ve-solicitud-ajena", foreign_shelter_request, 404)

        adopter_pet_create = request(
            "POST",
            "pets/",
            token=adopter["access"],
            data={
                "shelter": STATE["shelter_id"],
                "breed": STATE["breed_id"],
                "name": "[E2E] intento de mascota por adoptante",
                "size": "mediano",
            },
        )
        assert_response(self, "adoptante-no-publica-mascotas", adopter_pet_create, 403)

        adopter_followup_create = request(
            "POST",
            "follow-ups/",
            token=adopter["access"],
            data={
                "adoption": STATE["adoption_id"],
                "date": date.today().isoformat(),
                "wellbeing": "bueno",
            },
        )
        assert_response(
            self, "adoptante-no-registra-seguimientos", adopter_followup_create, 403
        )

        adopter_medical_create = request(
            "POST",
            "medical-records/",
            token=adopter["access"],
            data={
                "pet": STATE["pet_id"],
                "date": date.today().isoformat(),
                "record_type": "consulta",
                "description": "Intento no autorizado",
            },
        )
        assert_response(
            self, "adoptante-no-modifica-historial-medico", adopter_medical_create, 403
        )

        shelter_conversation_create = request(
            "POST",
            "conversations/",
            token=shelter["access"],
            data={"shelter": STATE["shelter_id"], "pet": STATE["pet_id"]},
        )
        assert_response(
            self, "refugio-no-inicia-conversaciones", shelter_conversation_create, 403
        )

        outsider_message_create = request(
            "POST",
            "messages/",
            token=other_adopter["access"],
            data={
                "conversation": STATE["conversation_id"],
                "content": "Intento de mensaje ajeno",
            },
        )
        assert_response(
            self, "adoptante-no-escribe-en-conversacion-ajena", outsider_message_create, 403
        )

        for origin in ("http://localhost:3000", "http://localhost:5173"):
            cors_response = request(
                "OPTIONS",
                "auth/me/",
                headers={
                    "Origin": origin,
                    "Access-Control-Request-Method": "GET",
                },
            )
            allow_origin = cors_response.headers.get("Access-Control-Allow-Origin")
            self.assertEqual(allow_origin, origin)
            self.assertNotEqual(allow_origin, "*")
            print(f"[PASS] CORS preflight {origin}: allow-origin={allow_origin}")

        denied_origin = request(
            "OPTIONS",
            "auth/me/",
            headers={
                "Origin": "https://example.invalid",
                "Access-Control-Request-Method": "GET",
            },
        )
        self.assertIsNone(denied_origin.headers.get("Access-Control-Allow-Origin"))
        print("[PASS] CORS rechaza origen externo no configurado")

        STATE["security_flow_ready"] = True
