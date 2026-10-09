import unittest
from datetime import date, timedelta
from io import StringIO
from urllib.parse import urlencode

from django.core.management import call_command

from medical.models import Vaccine

from .common import (
    STATE,
    assert_response,
    count_notifications,
    require_state,
    request,
)


class E2EAdoptionHttpFlowTests(unittest.TestCase):
    def test_shelter_to_returned_adoption_full_flow(self):
        require_state(self, "auth_ready")
        adopter = STATE["accounts"]["adopter"]
        shelter_user = STATE["accounts"]["shelter"]
        admin = STATE["accounts"]["admin"]
        vet = STATE["accounts"]["veterinarian"]

        shelter_response = request(
            "POST",
            "shelters/",
            token=shelter_user["access"],
            data={
                "name": f'[E2E] Refugio {STATE["suffix"]}',
                "address": "Calle de prueba 123",
                "city": STATE["city"],
                "contact_phone": "3000000000",
                "contact_email": shelter_user["email"],
            },
        )
        shelter_data = assert_response(self, "crear-refugio", shelter_response, 201)
        STATE["shelter_id"] = shelter_data["id"]

        verify = request(
            "POST",
            f'shelters/{STATE["shelter_id"]}/verify/',
            token=admin["access"],
            data={"approved": True},
        )
        assert_response(self, "verificar-refugio-admin", verify, 200)

        members = request(
            "GET",
            f'shelters/{STATE["shelter_id"]}/members/',
            token=shelter_user["access"],
        )
        member_data = assert_response(self, "confirmar-miembro-refugio", members, 200)
        self.assertTrue(any(row["user"] == shelter_user["user_id"] for row in member_data))

        species_response = request("GET", "species/")
        species_data = assert_response(self, "listar-especies", species_response, 200)
        dog = next(row for row in species_data["results"] if row["name"] == "Perro")
        breeds_response = request("GET", f'breeds/?species={dog["id"]}')
        breeds_data = assert_response(self, "filtrar-razas", breeds_response, 200)
        breed = next(row for row in breeds_data["results"] if row["name"] == "Mestizo")
        STATE["species_id"] = dog["id"]
        STATE["breed_id"] = breed["id"]

        for index in range(21):
            pet_response = request(
                "POST",
                "pets/",
                token=shelter_user["access"],
                data={
                    "shelter": STATE["shelter_id"],
                    "breed": STATE["breed_id"],
                    "name": f'[E2E] Mascota {STATE["suffix"]}-{index:02d}',
                    "approximate_birth_date": "2022-01-10",
                    "size": "mediano",
                    "health": "Ficha de salud de prueba",
                    "temperament": "Tranquila",
                },
            )
            pet_data = assert_response(
                self, f"publicar-mascota-{index + 1}", pet_response, 201
            )
            STATE.setdefault("pet_ids", []).append(pet_data["id"])
        STATE["pet_id"] = STATE["pet_ids"][0]

        photo = request(
            "POST",
            "pet-photos/",
            token=shelter_user["access"],
            multipart={
                "pet": STATE["pet_id"],
                "url": f'https://example.invalid/e2e/{STATE["suffix"]}.jpg',
                "is_primary": "true",
            },
        )
        photo_data = assert_response(self, "registrar-foto-por-url", photo, 201)
        STATE["photo_id"] = photo_data["id"]

        filters = urlencode(
            {
                "species": STATE["species_id"],
                "breed": STATE["breed_id"],
                "city": STATE["city"],
                "status": "disponible",
            }
        )
        page_one = request("GET", f"pets/?{filters}&page=1")
        page_data = assert_response(self, "buscar-filtrar-mascotas-pagina-1", page_one, 200)
        self.assertEqual(page_data["count"], 21)
        self.assertTrue(page_data["next"])
        self.assertEqual(len(page_data["results"]), 20)
        page_two = request("GET", f"pets/?{filters}&page=2")
        page_two_data = assert_response(self, "paginacion-mascotas-pagina-2", page_two, 200)
        self.assertEqual(len(page_two_data["results"]), 1)

        questions_response = request("GET", "form-questions/")
        questions = assert_response(self, "listar-formulario-adopcion", questions_response, 200)
        answers = [
            {"question": question["id"], "value": "Respuesta de prueba"}
            for question in questions["results"]
            if question["required"]
        ]
        request_payload = {"pet": STATE["pet_id"], "answers": answers}
        application_response = request(
            "POST", "adoption-requests/", token=adopter["access"], data=request_payload
        )
        application = assert_response(
            self, "crear-solicitud-adopcion", application_response, 201
        )
        STATE["request_id"] = application["id"]

        duplicate = request(
            "POST", "adoption-requests/", token=adopter["access"], data=request_payload
        )
        duplicate_data = assert_response(
            self, "duplicar-solicitud-pendiente", duplicate, 400
        )
        self.assertIn("pendiente", str(duplicate_data).lower())

        non_adopter = request(
            "POST",
            "adoption-requests/",
            token=shelter_user["access"],
            data=request_payload,
        )
        assert_response(self, "solicitud-desde-rol-no-adoptante", non_adopter, 403)
        non_adopter_admin = request(
            "POST",
            "adoption-requests/",
            token=admin["access"],
            data=request_payload,
        )
        assert_response(self, "solicitud-desde-rol-administrador", non_adopter_admin, 403)

        cancelled_request = request(
            "POST",
            "adoption-requests/",
            token=adopter["access"],
            data={"pet": STATE["pet_ids"][1], "answers": answers},
        )
        cancelled_data = assert_response(
            self, "crear-solicitud-para-prueba-no-aprobada", cancelled_request, 201
        )
        cancel_response = request(
            "POST",
            f'adoption-requests/{cancelled_data["id"]}/cancel/',
            token=adopter["access"],
            data={},
        )
        assert_response(self, "cancelar-solicitud-pendiente", cancel_response, 200)
        approve_cancelled = request(
            "POST",
            f'adoption-requests/{cancelled_data["id"]}/approve/',
            token=shelter_user["access"],
            data={"message": "No debe crear una adopción"},
        )
        approve_cancelled_data = assert_response(
            self, "no-crear-adopcion-desde-solicitud-cancelada", approve_cancelled, 400
        )
        self.assertIn("pendientes", str(approve_cancelled_data).lower())

        unapproved_adoption = request(
            "POST",
            "adoptions/",
            token=admin["access"],
            data={"request": STATE["request_id"]},
        )
        assert_response(
            self, "crear-adopcion-sin-aprobacion-no-permitido", unapproved_adoption, 405
        )

        approval = request(
            "POST",
            f'adoption-requests/{STATE["request_id"]}/approve/',
            token=shelter_user["access"],
            data={"message": "Aprobada en prueba E2E"},
        )
        adoption_data = assert_response(self, "aprobar-solicitud", approval, 201)
        STATE["adoption_id"] = adoption_data["id"]

        pet_after_approval = request("GET", f'pets/{STATE["pet_id"]}/')
        pet_after_data = assert_response(
            self, "verificar-mascota-adoptada", pet_after_approval, 200
        )
        self.assertEqual(pet_after_data["status"], "adoptada")

        approval_count, approval_rows = count_notifications(
            self, "adopter", "aprobacion"
        )
        matching_approval = [
            row for row in approval_rows if row["request"] == STATE["request_id"]
        ]
        self.assertEqual(approval_count, 1)
        self.assertEqual(len(matching_approval), 1)
        STATE["approval_notification_id"] = matching_approval[0]["id"]

        followup = request(
            "POST",
            "follow-ups/",
            token=shelter_user["access"],
            data={
                "adoption": STATE["adoption_id"],
                "date": date.today().isoformat(),
                "wellbeing": "bueno",
                "observations": "[E2E] seguimiento realizado",
            },
        )
        followup_data = assert_response(self, "registrar-seguimiento", followup, 201)
        STATE["followup_id"] = followup_data["id"]

        vet_profile = request(
            "POST",
            "veterinarians/",
            token=vet["access"],
            data={
                "professional_card": f'E2E-{STATE["suffix"]}',
                "clinic": "Clínica de prueba",
                "specialty": "Medicina general",
            },
        )
        vet_profile_data = assert_response(
            self, "crear-perfil-veterinario", vet_profile, 201
        )
        STATE["veterinarian_id"] = vet_profile_data["id"]

        vaccine = Vaccine.objects.filter(species_id=STATE["species_id"]).first()
        self.assertIsNotNone(vaccine)
        medical_record = request(
            "POST",
            "medical-records/",
            token=vet["access"],
            data={
                "pet": STATE["pet_id"],
                "vaccine": vaccine.pk,
                "date": date.today().isoformat(),
                "record_type": "vacunacion",
                "description": "[E2E] aplicación de vacuna",
            },
        )
        medical_data = assert_response(
            self, "registrar-vacunacion-veterinario", medical_record, 201
        )
        STATE["medical_record_id"] = medical_data["id"]

        reminder = request(
            "POST",
            "reminders/",
            token=shelter_user["access"],
            data={
                "adoption": STATE["adoption_id"],
                "vaccine": vaccine.pk,
                "medical_record": STATE["medical_record_id"],
                "reminder_type": "vacuna",
                "scheduled_date": date.today().isoformat(),
            },
        )
        reminder_data = assert_response(self, "crear-recordatorio", reminder, 201)
        STATE["reminder_id"] = reminder_data["id"]

        command_output = StringIO()
        call_command(
            "send_reminders",
            "--days=7",
            f'--reminder-id={STATE["reminder_id"]}',
            stdout=command_output,
        )
        self.assertIn("Recordatorios enviados: 1.", command_output.getvalue())
        print("[PASS] comando send_reminders limitado al recordatorio E2E: 1 enviado")

        notified_reminder = request(
            "GET",
            f'reminders/{STATE["reminder_id"]}/',
            token=adopter["access"],
        )
        reminder_after_data = assert_response(
            self, "verificar-recordatorio-notificado", notified_reminder, 200
        )
        self.assertEqual(reminder_after_data["status"], "notificado")
        reminder_count, reminder_rows = count_notifications(
            self, "adopter", "recordatorio"
        )
        self.assertEqual(reminder_count, 1)
        self.assertEqual(
            sum(row["reminder"] == STATE["reminder_id"] for row in reminder_rows), 1
        )

        conversation = request(
            "POST",
            "conversations/",
            token=adopter["access"],
            data={"shelter": STATE["shelter_id"], "pet": STATE["pet_id"]},
        )
        conversation_data = assert_response(
            self, "iniciar-conversacion", conversation, 201
        )
        STATE["conversation_id"] = conversation_data["id"]

        shelter_before, _ = count_notifications(self, "shelter", "mensaje")
        adopter_before, _ = count_notifications(self, "adopter", "mensaje")
        first_message = request(
            "POST",
            "messages/",
            token=adopter["access"],
            data={
                "conversation": STATE["conversation_id"],
                "content": "[E2E] mensaje del adoptante",
            },
        )
        first_message_data = assert_response(
            self, "mensaje-adoptante-a-refugio", first_message, 201
        )
        STATE.setdefault("message_ids", []).append(first_message_data["id"])
        shelter_after, _ = count_notifications(self, "shelter", "mensaje")
        self.assertEqual(shelter_after, shelter_before + 1)

        second_message = request(
            "POST",
            "messages/",
            token=shelter_user["access"],
            data={
                "conversation": STATE["conversation_id"],
                "content": "[E2E] respuesta del refugio",
            },
        )
        second_message_data = assert_response(
            self, "mensaje-refugio-a-adoptante", second_message, 201
        )
        STATE["message_ids"].append(second_message_data["id"])
        adopter_after, _ = count_notifications(self, "adopter", "mensaje")
        self.assertEqual(adopter_after, adopter_before + 1)

        past_return = request(
            "POST",
            f'adoptions/{STATE["adoption_id"]}/return/',
            token=shelter_user["access"],
            data={
                "reason": "Fecha inválida de prueba",
                "return_date": (date.today() - timedelta(days=1)).isoformat(),
            },
        )
        past_return_data = assert_response(
            self, "rechazar-fecha-devolucion-anterior", past_return, 400
        )
        self.assertIn("anterior", str(past_return_data).lower())

        returned = request(
            "POST",
            f'adoptions/{STATE["adoption_id"]}/return/',
            token=shelter_user["access"],
            data={
                "reason": "La familia no pudo continuar con los cuidados.",
                "return_date": date.today().isoformat(),
            },
        )
        returned_data = assert_response(self, "registrar-devolucion", returned, 200)
        self.assertEqual(returned_data["status"], "devuelta")

        returned_pet = request("GET", f'pets/{STATE["pet_id"]}/')
        returned_pet_data = assert_response(
            self, "verificar-mascota-devuelta", returned_pet, 200
        )
        self.assertEqual(returned_pet_data["status"], "devuelta")

        statistics = request(
            "GET", "statistics/adoptions/", token=admin["access"]
        )
        stats = assert_response(self, "estadistica-devoluciones-admin", statistics, 200)
        self.assertGreaterEqual(stats["returned_adoptions"], 1)
        STATE["adoption_flow_ready"] = True
