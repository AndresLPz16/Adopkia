import unittest
from datetime import date

from django.contrib.auth import get_user_model

from adoptions.models import FormQuestion
from users.models import RolePermission

from .common import (
    STATE,
    assert_response,
    login_account,
    new_password,
    record_account,
    request,
    role_allows,
)


class E2EPermissionMatrixHttpTests(unittest.TestCase):
    def test_01_read_matrix_for_every_role_and_anonymous(self):
        accounts = STATE["accounts"]
        shelter_id = STATE["shelter_id"]
        member_email = f'{STATE["email_prefix"]}_member@example.test'
        member_password = new_password()
        member_response = request(
            "POST",
            "auth/register/",
            data={
                "email": member_email,
                "username": f'{STATE["email_prefix"][:15]}_member',
                "password": member_password,
                "name": "[E2E] integrante",
                "role": "refugio",
            },
        )
        member_payload = assert_response(
            self, "registro-integrante-refugio", member_response, 201
        )
        # El registro deja la cuenta sin verificar y aquí no se envía correo.
        get_user_model().objects.filter(pk=member_payload["id"]).update(
            email_verified=True
        )
        member_account = record_account(
            "shelter_member",
            email=member_email,
            password=member_password,
            role="refugio",
            user_id=member_payload["id"],
        )
        login_account(self, "shelter_member")
        member_response = request(
            "POST",
            f"shelters/{shelter_id}/members/",
            token=accounts["shelter"]["access"],
            data={"user": member_account["user_id"], "position": "colaborador"},
        )
        member_data = assert_response(
            self, "responsable-agrega-integrante", member_response, 201
        )
        STATE["shelter_member_id"] = member_data["id"]
        accounts = STATE["accounts"]
        public_collections = (
            "shelters/",
            "species/",
            "breeds/",
            "pets/",
            "form-questions/",
            "vaccines/",
        )
        # Ruta -> recurso de la matriz de permisos por rol (`permiso_rol`).
        # El perfil propio no depende de la matriz.
        protected_collections = {
            "auth/me/": None,
            "shelter-members/": "shelterMembers",
            "pet-photos/": "petPhotos",
            "adoption-requests/": "adoptionRequests",
            "adoptions/": "adoptions",
            "follow-ups/": "followUps",
            "veterinarians/": "veterinarians",
            "medical-records/": "medicalRecords",
            "reminders/": "reminders",
            "conversations/": "messaging",
            "messages/": "messaging",
            "notifications/": "notifications",
        }
        readable = {
            (role, resource)
            for role, resource in RolePermission.objects.filter(
                action__in=("read", "manage")
            ).values_list("role__name", "resource")
        }

        for path in public_collections:
            response = request("GET", path)
            assert_response(self, f"lectura-publica/{path}", response, 200)
        for path in protected_collections:
            response = request("GET", path)
            assert_response(self, f"lectura-anonima-denegada/{path}", response, 401)

        for alias in (
            "adopter",
            "other_adopter",
            "shelter",
            "other_shelter",
            "shelter_member",
            "admin",
            "veterinarian",
        ):
            account = accounts[alias]
            for path, resource in protected_collections.items():
                # La lectura debe coincidir con la matriz configurada: 200 si
                # el rol tiene `read` o `manage` sobre el recurso, 403 si no.
                allowed = resource is None or (account["role"], resource) in readable
                response = request("GET", path, token=account["access"])
                assert_response(
                    self,
                    f"lectura/{alias}/{path}",
                    response,
                    200 if allowed else 403,
                )

        for alias in ("adopter", "other_adopter", "shelter", "other_shelter", "veterinarian"):
            response = request(
                "GET", "statistics/adoptions/", token=accounts[alias]["access"]
            )
            assert_response(self, f"estadistica-solo-admin/{alias}", response, 403)
        assert_response(
            self,
            "estadistica-anonima-denegada",
            request("GET", "statistics/adoptions/"),
            401,
        )
        assert_response(
            self,
            "estadistica-admin",
            request("GET", "statistics/adoptions/", token=accounts["admin"]["access"]),
            200,
        )
        STATE["permission_read_matrix_ready"] = True

    def test_02_anonymous_and_forbidden_role_mutations(self):
        accounts = STATE["accounts"]
        shelter_id = STATE["shelter_id"]
        pet_id = STATE["pet_ids"][2]
        request_id = STATE["request_id"]
        adoption_id = STATE["adoption_id"]
        followup_id = STATE["followup_id"]
        photo_id = STATE["photo_id"]
        conversation_id = STATE["conversation_id"]
        message_id = STATE["message_ids"][0]
        reminder_id = STATE["reminder_id"]
        notification_id = STATE["approval_notification_id"]
        medical_record_id = STATE["medical_record_id"]
        veterinarian_id = STATE["veterinarian_id"]
        member_id = STATE["shelter_member_id"]

        mutation_paths = (
            ("POST", "shelters/"),
            ("PUT", f"shelters/{shelter_id}/"),
            ("PATCH", f"shelters/{shelter_id}/"),
            ("DELETE", f"shelters/{shelter_id}/"),
            ("POST", "pets/"),
            ("PUT", f"pets/{pet_id}/"),
            ("PATCH", f"pets/{pet_id}/"),
            ("DELETE", f"pets/{pet_id}/"),
            ("POST", "pet-photos/"),
            ("PUT", f"pet-photos/{photo_id}/"),
            ("PATCH", f"pet-photos/{photo_id}/"),
            ("DELETE", f"pet-photos/{photo_id}/"),
            ("POST", "adoption-requests/"),
            ("PUT", f"adoption-requests/{request_id}/"),
            ("PATCH", f"adoption-requests/{request_id}/"),
            ("DELETE", f"adoption-requests/{request_id}/"),
            ("POST", "adoptions/"),
            ("PUT", f"adoptions/{adoption_id}/"),
            ("PATCH", f"adoptions/{adoption_id}/"),
            ("DELETE", f"adoptions/{adoption_id}/"),
            ("POST", "follow-ups/"),
            ("PUT", f"follow-ups/{followup_id}/"),
            ("PATCH", f"follow-ups/{followup_id}/"),
            ("DELETE", f"follow-ups/{followup_id}/"),
            ("POST", "veterinarians/"),
            ("PUT", f"veterinarians/{veterinarian_id}/"),
            ("PATCH", f"veterinarians/{veterinarian_id}/"),
            ("DELETE", f"veterinarians/{veterinarian_id}/"),
            ("POST", "medical-records/"),
            ("PUT", f"medical-records/{medical_record_id}/"),
            ("PATCH", f"medical-records/{medical_record_id}/"),
            ("DELETE", f"medical-records/{medical_record_id}/"),
            ("POST", "reminders/"),
            ("PUT", f"reminders/{reminder_id}/"),
            ("PATCH", f"reminders/{reminder_id}/"),
            ("DELETE", f"reminders/{reminder_id}/"),
            ("POST", "conversations/"),
            ("PUT", f"conversations/{conversation_id}/"),
            ("PATCH", f"conversations/{conversation_id}/"),
            ("DELETE", f"conversations/{conversation_id}/"),
            ("POST", "messages/"),
            ("PUT", f"messages/{message_id}/"),
            ("PATCH", f"messages/{message_id}/"),
            ("DELETE", f"messages/{message_id}/"),
            ("POST", "notifications/"),
            ("PUT", f"notifications/{notification_id}/"),
            ("PATCH", f"notifications/{notification_id}/"),
            ("DELETE", f"notifications/{notification_id}/"),
            ("POST", "shelter-members/"),
            ("PUT", f"shelter-members/{member_id}/"),
            ("PATCH", f"shelter-members/{member_id}/"),
            ("DELETE", f"shelter-members/{member_id}/"),
        )
        for method, path in mutation_paths:
            response = request(method, path, data={})
            assert_response(self, f"anonimo-no-muta/{method}/{path}", response, 401)

        veterinarian = accounts["veterinarian"]
        valid_answers = [
            {"question": question.pk, "value": "Respuesta E2E"}
            for question in FormQuestion.objects.filter(active=True, required=True)
        ]
        payload = {
            "shelter": shelter_id,
            "breed": STATE["breed_id"],
            "name": "[E2E] mascota prohibida a veterinario",
            "size": "mediano",
        }
        assert_response(
            self,
            "veterinario-no-crea-mascota",
            request("POST", "pets/", token=veterinarian["access"], data=payload),
            403,
        )
        assert_response(
            self,
            "veterinario-no-crea-solicitud",
            request(
                "POST",
                "adoption-requests/",
                token=veterinarian["access"],
                data={"pet": pet_id, "answers": valid_answers},
            ),
            403,
        )
        assert_response(
            self,
            "veterinario-no-inicia-conversacion",
            request(
                "POST",
                "conversations/",
                token=veterinarian["access"],
                data={"shelter": shelter_id, "pet": pet_id},
            ),
            403,
        )
        for action in ("approve", "reject"):
            response = request(
                "POST",
                f"adoption-requests/{request_id}/{action}/",
                token=veterinarian["access"],
                data={},
            )
            # Sin permiso de rol responde 403; con él, la solicitud ajena
            # quedaría oculta (404).
            assert_response(
                self,
                f"veterinario-no-{action}",
                response,
                404
                if role_allows(veterinarian["role"], "adoptionRequests", action)
                else 403,
            )

        admin = accounts["admin"]
        assert_response(
            self,
            "administrador-no-crea-solicitud",
            request(
                "POST",
                "adoption-requests/",
                token=admin["access"],
                data={"pet": pet_id, "answers": valid_answers},
            ),
            # El administrador pasa el control por rol (`manage`) y lo
            # rechaza la regla de integridad: solo solicita un adoptante.
            400,
        )
        assert_response(
            self,
            "administrador-no-envia-mensaje-como-adoptante",
            request(
                "POST",
                "messages/",
                token=admin["access"],
                data={
                    "conversation": conversation_id,
                    "content": "[E2E] intento administrativo",
                },
            ),
            403,
        )
        assert_response(
            self,
            "veterinario-no-envia-mensaje",
            request(
                "POST",
                "messages/",
                token=veterinarian["access"],
                data={
                    "conversation": conversation_id,
                    "content": "[E2E] intento de mensaje veterinario",
                },
            ),
            403,
        )
        assert_response(
            self,
            "administrador-no-inicia-conversacion",
            request(
                "POST",
                "conversations/",
                token=admin["access"],
                data={"shelter": shelter_id, "pet": pet_id},
            ),
            # Pasa el control por rol (`manage`) y lo rechaza la regla de
            # integridad: solo un adoptante inicia la conversación.
            400,
        )
        assert_response(
            self,
            "administrador-no-borra-mensaje-de-otro",
            request(
                "DELETE",
                f'messages/{STATE["message_ids"][0]}/',
                token=admin["access"],
            ),
            403,
        )
        for method, data in (
            ("GET", None),
            ("PATCH", {"content": "No autorizado"}),
            ("DELETE", None),
        ):
            assert_response(
                self,
                f"adoptante-ajeno-no-accede-mensaje/{method}",
                request(
                    method,
                    f'messages/{STATE["message_ids"][0]}/',
                    token=accounts["other_adopter"]["access"],
                    data=data,
                ),
                404,
            )
        for method, data in (
            ("GET", None),
            ("PATCH", {"pet": pet_id}),
            ("DELETE", None),
        ):
            assert_response(
                self,
                f"adoptante-ajeno-no-accede-conversacion/{method}",
                request(
                    method,
                    f"conversations/{conversation_id}/",
                    token=accounts["other_adopter"]["access"],
                    data=data,
                ),
                404,
            )
        assert_response(
            self,
            "adoptante-ajeno-no-borra-notificacion",
            request(
                "DELETE",
                f"notifications/{notification_id}/",
                token=accounts["other_adopter"]["access"],
            ),
            404,
        )

        other_shelter = accounts["other_shelter"]
        foreign_shelter_detail = request(
            "GET",
            f"shelters/{shelter_id}/",
            token=other_shelter["access"],
        )
        foreign_shelter_data = assert_response(
            self, "refugio-ajeno-ve-refugio-verificado", foreign_shelter_detail, 200
        )
        # Quien no pertenece al refugio solo ve los campos públicos (sin
        # dirección), así que el PUT se completa con un cuerpo válido: la
        # pertenencia se comprueba después de validar los datos.
        self.assertNotIn("address", foreign_shelter_data)
        foreign_shelter_put_data = {
            "name": foreign_shelter_data["name"],
            "city": foreign_shelter_data["city"],
            "address": "Dirección enviada por un refugio ajeno",
        }
        for method, path, data, expected in (
            ("PUT", f"shelters/{shelter_id}/", foreign_shelter_put_data, 403),
            ("PATCH", f"shelters/{shelter_id}/", {"name": "Ajeno"}, 403),
            ("DELETE", f"shelters/{shelter_id}/", {}, 403),
            ("PUT", f"pets/{pet_id}/", {}, 403),
            ("PATCH", f"pets/{pet_id}/", {"name": "Ajena"}, 403),
            ("DELETE", f"pets/{pet_id}/", {}, 403),
            ("DELETE", f"pet-photos/{photo_id}/", {}, 403),
            # Con permiso de rol el objeto ajeno queda oculto (404); sin él,
            # el control por rol responde 403 antes de buscarlo.
            (
                "PATCH",
                f"adoption-requests/{request_id}/",
                {"pet": pet_id},
                404
                if role_allows(other_shelter["role"], "adoptionRequests", "update")
                else 403,
            ),
            (
                "DELETE",
                f"shelter-members/{member_id}/",
                {},
                404
                if role_allows(other_shelter["role"], "shelterMembers", "delete")
                else 403,
            ),
        ):
            response = request(
                method, path, token=other_shelter["access"], data=data
            )
            assert_response(
                self,
                f"refugio-ajeno-denegado/{method}/{path}",
                response,
                expected,
            )
        assert_response(
            self,
            "adoptante-no-edita-refugio",
            request(
                "PATCH",
                f"shelters/{shelter_id}/",
                token=accounts["adopter"]["access"],
                data={"address": "No autorizado"},
            ),
            403,
        )
        assert_response(
            self,
            "adoptante-no-borra-refugio",
            request(
                "DELETE",
                f"shelters/{shelter_id}/",
                token=accounts["adopter"]["access"],
            ),
            403,
        )
        assert_response(
            self,
            "integrante-no-responsable-no-agrega-integrante",
            request(
                "POST",
                f"shelters/{shelter_id}/members/",
                token=accounts["shelter_member"]["access"],
                data={
                    "user": accounts["veterinarian"]["user_id"],
                    "position": "colaborador",
                },
            ),
            403,
        )
        assert_response(
            self,
            "administrador-no-administra-integrantes-ajenos",
            request(
                "PATCH",
                f'shelter-members/{STATE["shelter_member_id"]}/',
                token=admin["access"],
                data={"position": "responsable"},
            ),
            403,
        )
        assert_response(
            self,
            "administrador-no-edita-perfil-veterinario-ajeno",
            request(
                "PATCH",
                f"veterinarians/{veterinarian_id}/",
                token=admin["access"],
                data={"clinic": "No autorizado"},
            ),
            403,
        )

        # El control por rol se evalúa antes que el método: un método no
        # expuesto responde 405 solo si el rol tiene la acción equivalente
        # sobre el recurso; si no, responde 403. En ningún caso se ejecuta.
        method_actions = {
            "POST": "create",
            "PUT": "update",
            "PATCH": "update",
            "DELETE": "delete",
        }
        shelter_role = accounts["shelter"]["role"]
        for method, path, resource in (
            ("PUT", f"pet-photos/{photo_id}/", "petPhotos"),
            ("PATCH", f"pet-photos/{photo_id}/", "petPhotos"),
            ("PUT", f"adoption-requests/{request_id}/", "adoptionRequests"),
            ("DELETE", f"adoption-requests/{request_id}/", "adoptionRequests"),
            ("PUT", f"adoptions/{adoption_id}/", "adoptions"),
            ("PATCH", f"adoptions/{adoption_id}/", "adoptions"),
            ("DELETE", f"adoptions/{adoption_id}/", "adoptions"),
            ("PUT", f"follow-ups/{followup_id}/", "followUps"),
            ("PUT", f"veterinarians/{veterinarian_id}/", "veterinarians"),
            ("DELETE", f"veterinarians/{veterinarian_id}/", "veterinarians"),
            ("POST", "notifications/", "notifications"),
            ("PUT", f"notifications/{notification_id}/", "notifications"),
            ("PUT", f"messages/{message_id}/", "messaging"),
            ("POST", "shelter-members/", "shelterMembers"),
            ("PUT", f"shelter-members/{member_id}/", "shelterMembers"),
        ):
            response = request(method, path, token=accounts["shelter"]["access"], data={})
            assert_response(
                self,
                f"metodo-no-disponible/{method}/{path}",
                response,
                405
                if role_allows(shelter_role, resource, method_actions[method])
                else 403,
            )

    def test_03_owner_mutations_and_object_isolation(self):
        accounts = STATE["accounts"]
        shelter = accounts["shelter"]
        adopter = accounts["adopter"]
        other_adopter = accounts["other_adopter"]
        veterinarian = accounts["veterinarian"]
        other_shelter = accounts["other_shelter"]
        pet_id = STATE["pet_ids"][2]
        shelter_id = STATE["shelter_id"]
        adoption_id = STATE["adoption_id"]

        pet_data = {
            "shelter": shelter_id,
            "breed": STATE["breed_id"],
            "name": "[E2E] mascota actualizada",
            "approximate_birth_date": "2022-01-10",
            "size": "mediano",
            "health": "Ficha E2E actualizada",
            "temperament": "Tranquila",
        }
        assert_response(
            self,
            "refugio-actualiza-mascota-put",
            request("PUT", f"pets/{pet_id}/", token=shelter["access"], data=pet_data),
            200,
        )
        assert_response(
            self,
            "refugio-actualiza-mascota-patch",
            request(
                "PATCH",
                f"pets/{pet_id}/",
                token=shelter["access"],
                data={"name": "[E2E] mascota patch"},
            ),
            200,
        )

        shelter_response = request("GET", f"shelters/{shelter_id}/", token=shelter["access"])
        current_shelter = assert_response(self, "leer-refugio-propio", shelter_response, 200)
        shelter_data = {
            key: current_shelter[key]
            for key in ("name", "address", "city", "contact_phone", "contact_email")
            if key in current_shelter
        }
        shelter_data["address"] = "Dirección E2E actualizada"
        assert_response(
            self,
            "refugio-actualiza-refugio-put",
            request(
                "PUT",
                f"shelters/{shelter_id}/",
                token=shelter["access"],
                data=shelter_data,
            ),
            200,
        )
        assert_response(
            self,
            "refugio-actualiza-refugio-patch",
            request(
                "PATCH",
                f"shelters/{shelter_id}/",
                token=shelter["access"],
                data={"address": "Dirección E2E actualizada"},
            ),
            200,
        )

        member_id = STATE["shelter_member_id"]
        STATE["shelter_member_id"] = member_id
        assert_response(
            self,
            "responsable-edita-integrante",
            request(
                "PATCH",
                f"shelter-members/{member_id}/",
                token=shelter["access"],
                data={"position": "responsable"},
            ),
            200,
        )
        assert_response(
            self,
            "responsable-elimina-integrante",
            request("DELETE", f"shelter-members/{member_id}/", token=shelter["access"]),
            204,
        )
        assert_response(
            self,
            "veterinario-edita-perfil-propio",
            request(
                "PATCH",
                f'veterinarians/{STATE["veterinarian_id"]}/',
                token=veterinarian["access"],
                data={"clinic": "Clínica actualizada E2E"},
            ),
            200,
        )

        required_answers = [
            {"question": question.pk, "value": "Respuesta E2E"}
            for question in FormQuestion.objects.filter(active=True, required=True)
        ]
        other_shelter_request = request(
            "POST",
            "adoption-requests/",
            token=other_adopter["access"],
            data={
                "pet": STATE["pet_ids"][3],
                "answers": required_answers,
            },
        )
        other_request = assert_response(
            self, "otro-adoptante-crea-solicitud-propia", other_shelter_request, 201
        )
        assert_response(
            self,
            "adoptante-edita-solicitud-pendiente",
            request(
                "PATCH",
                f'adoption-requests/{other_request["id"]}/',
                token=other_adopter["access"],
                data={"pet": STATE["pet_ids"][3], "answers": required_answers},
            ),
            200,
        )
        updated_request = assert_response(
            self,
            "adoptante-verifica-respuestas-actualizadas",
            request(
                "GET",
                f'adoption-requests/{other_request["id"]}/',
                token=other_adopter["access"],
            ),
            200,
        )
        self.assertEqual(
            {answer["question"] for answer in updated_request["answers"]},
            {answer["question"] for answer in required_answers},
        )
        assert_response(
            self,
            "adoptante-parchea-solicitud-sin-reenviar-respuestas",
            request(
                "PATCH",
                f'adoption-requests/{other_request["id"]}/',
                token=other_adopter["access"],
                data={"pet": STATE["pet_ids"][3]},
            ),
            200,
        )
        assert_response(
            self,
            "adoptante-no-edita-solicitud-ajena",
            request(
                "PATCH",
                f'adoption-requests/{other_request["id"]}/',
                token=adopter["access"],
                data={"pet": STATE["pet_ids"][3], "answers": required_answers},
            ),
            404,
        )
        assert_response(
            self,
            "adoptante-cancela-solicitud-propia-de-prueba",
            request(
                "POST",
                f'adoption-requests/{other_request["id"]}/cancel/',
                token=other_adopter["access"],
                data={},
            ),
            200,
        )

        assert_response(
            self,
            "adoptante-no-edita-seguimiento",
            request(
                "PATCH",
                f'follow-ups/{STATE["followup_id"]}/',
                token=adopter["access"],
                data={"wellbeing": "excelente"},
            ),
            403,
        )
        assert_response(
            self,
            "refugio-edita-seguimiento",
            request(
                "PATCH",
                f'follow-ups/{STATE["followup_id"]}/',
                token=shelter["access"],
                data={"wellbeing": "excelente"},
            ),
            200,
        )
        assert_response(
            self,
            "refugio-elimina-seguimiento",
            request(
                "DELETE",
                f'follow-ups/{STATE["followup_id"]}/',
                token=shelter["access"],
            ),
            204,
        )

        medical_payload = {
            "pet": STATE["pet_id"],
            "vaccine": None,
            "date": date.today().isoformat(),
            "record_type": "consulta",
            "description": "[E2E] registro para CRUD veterinario",
        }
        medical_response = request(
            "POST",
            "medical-records/",
            token=veterinarian["access"],
            data=medical_payload,
        )
        medical_data = assert_response(
            self, "veterinario-crea-historial-propio", medical_response, 201
        )
        medical_payload["veterinarian"] = STATE["veterinarian_id"]
        medical_payload["description"] = "[E2E] historial PUT veterinario"
        record_id = medical_data["id"]
        assert_response(
            self,
            "veterinario-actualiza-historial-put",
            request(
                "PUT",
                f"medical-records/{record_id}/",
                token=veterinarian["access"],
                data=medical_payload,
            ),
            200,
        )
        assert_response(
            self,
            "veterinario-actualiza-historial-patch",
            request(
                "PATCH",
                f"medical-records/{record_id}/",
                token=veterinarian["access"],
                data={"description": "[E2E] historial PATCH veterinario"},
            ),
            200,
        )
        assert_response(
            self,
            "adoptante-no-borra-historial-ajeno",
            request(
                "DELETE",
                f"medical-records/{record_id}/",
                token=adopter["access"],
            ),
            403,
        )
        assert_response(
            self,
            "veterinario-borra-historial-propio",
            request(
                "DELETE",
                f"medical-records/{record_id}/",
                token=veterinarian["access"],
            ),
            204,
        )

        reminder_payload = {
            "adoption": adoption_id,
            "vaccine": None,
            "medical_record": None,
            "reminder_type": "checkin",
            "scheduled_date": date.today().isoformat(),
            "status": "pendiente",
        }
        assert_response(
            self,
            "refugio-actualiza-recordatorio-put",
            request(
                "PUT",
                f'reminders/{STATE["reminder_id"]}/',
                token=shelter["access"],
                data=reminder_payload,
            ),
            200,
        )
        # El rol adoptante solo llega a sus recordatorios si la matriz le
        # concede el recurso `reminders`; sin él, el control por rol responde
        # 403 antes de evaluar la propiedad del objeto.
        assert_response(
            self,
            "adoptante-actualiza-recordatorio-propio",
            request(
                "PATCH",
                f'reminders/{STATE["reminder_id"]}/',
                token=adopter["access"],
                data={"status": "pendiente"},
            ),
            200 if role_allows(adopter["role"], "reminders", "update") else 403,
        )
        assert_response(
            self,
            "otro-adoptante-no-borra-recordatorio",
            request(
                "DELETE",
                f'reminders/{STATE["reminder_id"]}/',
                token=other_adopter["access"],
            ),
            404 if role_allows(other_adopter["role"], "reminders", "delete") else 403,
        )
        assert_response(
            self,
            "refugio-borra-recordatorio",
            request(
                "DELETE",
                f'reminders/{STATE["reminder_id"]}/',
                token=shelter["access"],
            ),
            204,
        )

        primary_message = request(
            "POST",
            "messages/",
            token=adopter["access"],
            data={
                "conversation": STATE["conversation_id"],
                "content": "[E2E] mensaje para verificar mutaciones",
            },
        )
        primary_message_data = assert_response(
            self, "adoptante-crea-mensaje-propio", primary_message, 201
        )
        message_id = primary_message_data["id"]
        assert_response(
            self,
            "adoptante-edita-mensaje-no-leido",
            request(
                "PATCH",
                f"messages/{message_id}/",
                token=adopter["access"],
                data={"content": "[E2E] mensaje editado"},
            ),
            200,
        )
        assert_response(
            self,
            "refugio-no-borra-mensaje-ajeno",
            request("DELETE", f"messages/{message_id}/", token=shelter["access"]),
            403,
        )
        assert_response(
            self,
            "refugio-marca-mensaje-ajeno-leido",
            request("POST", f"messages/{message_id}/mark-read/", token=shelter["access"]),
            200,
        )
        assert_response(
            self,
            "adoptante-no-edita-mensaje-leido",
            request(
                "PATCH",
                f"messages/{message_id}/",
                token=adopter["access"],
                data={"content": "No debe editarse"},
            ),
            403,
        )
        assert_response(
            self,
            "adoptante-borra-mensaje-propio",
            request("DELETE", f"messages/{message_id}/", token=adopter["access"]),
            204,
        )

        assert_response(
            self,
            "adoptante-marca-notificacion-propia",
            request(
                "PATCH",
                f'notifications/{STATE["approval_notification_id"]}/',
                token=adopter["access"],
                data={"is_read": True},
            ),
            200 if role_allows(adopter["role"], "notifications", "update") else 403,
        )
        assert_response(
            self,
            "adoptante-borra-notificacion-propia",
            request(
                "DELETE",
                f'notifications/{STATE["approval_notification_id"]}/',
                token=adopter["access"],
            ),
            204 if role_allows(adopter["role"], "notifications", "delete") else 403,
        )

        assert_response(
            self,
            "refugio-elimina-foto-propia",
            request(
                "DELETE",
                f'pet-photos/{STATE["photo_id"]}/',
                token=shelter["access"],
            ),
            204,
        )

        temp_conversation_response = request(
            "POST",
            "conversations/",
            token=adopter["access"],
            data={"shelter": shelter_id, "pet": STATE["pet_id"]},
        )
        temp_conversation = assert_response(
            self, "adoptante-crea-conversacion-prueba", temp_conversation_response, 201
        )
        for method in ("PUT", "PATCH"):
            assert_response(
                self,
                f"conversacion-inmutable/{method}",
                request(
                    method,
                    f'conversations/{temp_conversation["id"]}/',
                    token=adopter["access"],
                    data={"pet": STATE["pet_id"]},
                ),
                403,
            )
        assert_response(
            self,
            "refugio-elimina-conversacion-de-su-refugio",
            request(
                "DELETE",
                f'conversations/{temp_conversation["id"]}/',
                token=shelter["access"],
            ),
            204,
        )
        admin_conversation_response = request(
            "POST",
            "conversations/",
            token=adopter["access"],
            data={"shelter": shelter_id, "pet": STATE["pet_id"]},
        )
        admin_conversation = assert_response(
            self,
            "adoptante-crea-conversacion-para-admin",
            admin_conversation_response,
            201,
        )
        assert_response(
            self,
            "administrador-elimina-conversacion",
            request(
                "DELETE",
                f'conversations/{admin_conversation["id"]}/',
                token=accounts["admin"]["access"],
            ),
            204,
        )

        disposable_pet_id = STATE["pet_ids"][-1]
        assert_response(
            self,
            "refugio-elimina-mascota-propia",
            request("DELETE", f"pets/{disposable_pet_id}/", token=shelter["access"]),
            204,
        )
        assert_response(
            self,
            "administrador-elimina-mascota",
            request(
                "DELETE",
                f'pets/{STATE["pet_ids"][-2]}/',
                token=accounts["admin"]["access"],
            ),
            204,
        )
        assert_response(
            self,
            "refugio-no-elimina-objeto-de-otro-refugio-despues-de-mutaciones",
            request(
                "DELETE",
                f"pets/{pet_id}/",
                token=other_shelter["access"],
            ),
            403,
        )

        other_shelter_id = STATE["other_shelter_id"]
        other_shelter_detail = assert_response(
            self,
            "refugio-lee-su-propio-refugio",
            request(
                "GET",
                f"shelters/{other_shelter_id}/",
                token=other_shelter["access"],
            ),
            200,
        )
        other_shelter_payload = {
            key: other_shelter_detail[key]
            for key in ("name", "address", "city", "contact_phone", "contact_email")
            if key in other_shelter_detail
        }
        other_shelter_payload["address"] = "Dirección de refugio propio actualizada"
        assert_response(
            self,
            "refugio-actualiza-su-refugio-put",
            request(
                "PUT",
                f"shelters/{other_shelter_id}/",
                token=other_shelter["access"],
                data=other_shelter_payload,
            ),
            200,
        )
        assert_response(
            self,
            "refugio-actualiza-su-refugio-patch",
            request(
                "PATCH",
                f"shelters/{other_shelter_id}/",
                token=other_shelter["access"],
                data={"address": "Dirección de refugio propio por PATCH"},
            ),
            200,
        )
        assert_response(
            self,
            "administrador-actualiza-refugio",
            request(
                "PATCH",
                f"shelters/{other_shelter_id}/",
                token=accounts["admin"]["access"],
                data={"address": "Dirección corregida por administración"},
            ),
            200,
        )
        assert_response(
            self,
            "administrador-actualiza-mascota",
            request(
                "PATCH",
                f'pets/{STATE["pet_ids"][3]}/',
                token=accounts["admin"]["access"],
                data={"health": "Revisión administrativa E2E"},
            ),
            200,
        )
        assert_response(
            self,
            "refugio-elimina-su-refugio-propio",
            request(
                "DELETE",
                f"shelters/{other_shelter_id}/",
                token=other_shelter["access"],
            ),
            # Eliminar el refugio exige `shelters:delete` en la matriz del rol.
            204 if role_allows(other_shelter["role"], "shelters", "delete") else 403,
        )
        STATE["permission_mutation_matrix_ready"] = True
