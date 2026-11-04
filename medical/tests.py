from datetime import date, timedelta
from io import StringIO

from django.core.management import call_command
from django.urls import reverse
from rest_framework.test import APITestCase

from adoptions.models import Adoption, AdoptionRequest
from notifications.models import Notification
from pets.models import Breed, Pet, Species
from shelters.models import Shelter
from users.models import Role, RolePermission, User

from .models import MedicalRecord, Reminder, Vaccine, Veterinarian


class MedicalApiTests(APITestCase):
    def setUp(self):
        self.vet_user = User.objects.create_user(
            email="vet@example.com",
            password="SafePass!2026",
            name="Veterinaria",
            role=Role.Name.VETERINARIAN,
        )
        self.adopter = User.objects.create_user(
            email="adopter@example.com",
            password="SafePass!2026",
            name="Adoptante",
        )
        self.shelter = Shelter.objects.create(
            name="Huellas", address="Calle 1", city="Riohacha"
        )
        self.species = Species.objects.create(name="Perro")
        breed = Breed.objects.create(species=self.species, name="Mestizo")
        self.pet = Pet.objects.create(
            shelter=self.shelter, breed=breed, name="Luna", size=Pet.Size.MEDIUM
        )
        self.vet = Veterinarian.objects.create(
            user=self.vet_user, professional_card="TP-001"
        )
        self.vaccine = Vaccine.objects.create(
            species=self.species,
            name="Antirrábica",
            booster_interval_days=365,
        )

    def test_veterinarian_can_register_consultation_and_vaccination_records(self):
        self.client.force_authenticate(self.vet_user)
        consultation = self.client.post(
            reverse("medical-record-list"),
            {
                "pet": self.pet.pk,
                "date": date.today().isoformat(),
                "record_type": MedicalRecord.RecordType.CONSULTATION,
                "description": "Control general",
            },
            format="json",
        )
        self.assertEqual(consultation.status_code, 201)
        self.assertEqual(MedicalRecord.objects.get().veterinarian, self.vet)

        vaccination = self.client.post(
            reverse("medical-record-list"),
            {
                "pet": self.pet.pk,
                "vaccine": self.vaccine.pk,
                "date": date.today().isoformat(),
                "record_type": MedicalRecord.RecordType.VACCINATION,
                "description": "Aplicación antirrábica",
            },
            format="json",
        )
        self.assertEqual(vaccination.status_code, 201)
        self.assertEqual(MedicalRecord.objects.count(), 2)
        self.assertEqual(
            MedicalRecord.objects.get(vaccine=self.vaccine).record_type,
            MedicalRecord.RecordType.VACCINATION,
        )

    def test_veterinarian_can_read_records_for_any_pet(self):
        record = MedicalRecord.objects.create(
            pet=self.pet,
            date=date.today(),
            record_type=MedicalRecord.RecordType.CONSULTATION,
        )
        self.client.force_authenticate(self.vet_user)
        response = self.client.get(reverse("medical-record-list"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], record.pk)
        self.assertEqual(response.data["results"][0]["pet_name"], self.pet.name)

    def test_vaccine_catalog_is_publicly_readable_and_role_managed(self):
        response = self.client.get(reverse("vaccine-list"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["results"][0]["name"], self.vaccine.name)

        self.client.force_authenticate(self.vet_user)
        denied = self.client.post(
            reverse("vaccine-list"),
            {"species": self.species.pk, "name": "Moquillo"},
            format="json",
        )
        self.assertEqual(denied.status_code, 403)

        RolePermission.objects.create(
            role=self.vet_user.role,
            resource="vaccines",
            action="manage",
        )
        created = self.client.post(
            reverse("vaccine-list"),
            {
                "species": self.species.pk,
                "name": "Moquillo",
                "description": "Vacuna anual",
                "booster_interval_days": 365,
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        vaccine_id = created.data["id"]
        self.assertEqual(created.data["species_name"], self.species.name)

        updated = self.client.patch(
            reverse("vaccine-detail", args=(vaccine_id,)),
            {"description": "Refuerzo anual"},
            format="json",
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.data["description"], "Refuerzo anual")

        deleted = self.client.delete(reverse("vaccine-detail", args=(vaccine_id,)))
        self.assertEqual(deleted.status_code, 204)

    def test_vaccine_cannot_be_deleted_when_used_in_medical_history(self):
        record = MedicalRecord.objects.create(
            pet=self.pet,
            vaccine=self.vaccine,
            date=date.today(),
            record_type=MedicalRecord.RecordType.VACCINATION,
        )
        RolePermission.objects.create(
            role=self.vet_user.role,
            resource="vaccines",
            action="manage",
        )
        self.client.force_authenticate(self.vet_user)

        response = self.client.delete(reverse("vaccine-detail", args=(self.vaccine.pk,)))

        self.assertEqual(response.status_code, 400)
        self.assertTrue(Vaccine.objects.filter(pk=self.vaccine.pk).exists())
        self.assertTrue(MedicalRecord.objects.filter(pk=record.pk).exists())

    def test_role_granted_veterinarian_read_permission_lists_profiles(self):
        self.vet.professional_card = "TP-READ"
        self.vet.clinic = "Clínica Huellas"
        self.vet.specialty = "Cirugía"
        self.vet.save(update_fields=("professional_card", "clinic", "specialty"))
        RolePermission.objects.create(
            role=self.adopter.role,
            resource="veterinarians",
            action="read",
        )
        self.client.force_authenticate(self.adopter)

        response = self.client.get(reverse("veterinarian-list"))

        self.assertEqual(response.status_code, 200)
        profile = response.data["results"][0]
        self.assertEqual(profile["user_name"], "Veterinaria")
        self.assertEqual(profile["professional_card"], "TP-READ")
        self.assertEqual(profile["clinic"], "Clínica Huellas")

    def test_upcoming_reminder_notifies_adopter_once(self):
        adoption_request = AdoptionRequest.objects.create(
            applicant=self.adopter,
            pet=self.pet,
            status=AdoptionRequest.Status.APPROVED,
        )
        adoption = Adoption.objects.create(
            request=adoption_request, adoption_date=date.today()
        )
        reminder = Reminder.objects.create(
            adoption=adoption,
            reminder_type=Reminder.ReminderType.VACCINE,
            vaccine=self.vaccine,
            scheduled_date=date.today() + timedelta(days=1),
        )
        out = StringIO()
        call_command("send_reminders", days=2, stdout=out)
        self.assertIn("Recordatorios enviados: 1", out.getvalue())
        notification = Notification.objects.get(reminder=reminder)
        self.assertEqual(notification.user, self.adopter)
        self.assertEqual(
            notification.notification_type, Notification.NotificationType.REMINDER
        )
        call_command("send_reminders", days=2, stdout=StringIO())
        self.assertEqual(Notification.objects.filter(reminder=reminder).count(), 1)
        reminder.refresh_from_db()
        self.assertEqual(reminder.status, Reminder.Status.NOTIFIED)

    def test_shelter_can_edit_reminder_notes_and_mark_it_completed(self):
        shelter_user = User.objects.create_user(
            email="shelter@example.com",
            password="test-password",
            name="Refugio",
            role=Role.Name.SHELTER,
        )
        from shelters.models import ShelterMember

        ShelterMember.objects.create(
            shelter=self.shelter,
            user=shelter_user,
            position=ShelterMember.Position.MANAGER,
        )
        adoption_request = AdoptionRequest.objects.create(
            applicant=self.adopter,
            pet=self.pet,
            status=AdoptionRequest.Status.APPROVED,
        )
        adoption = Adoption.objects.create(
            request=adoption_request, adoption_date=date.today()
        )
        reminder = Reminder.objects.create(
            adoption=adoption,
            reminder_type=Reminder.ReminderType.VETERINARY_CHECKUP,
            scheduled_date=date.today() + timedelta(days=1),
        )
        self.client.force_authenticate(shelter_user)

        response = self.client.patch(
            reverse("reminder-detail", args=(reminder.pk,)),
            {"notes": "Control realizado; sin novedades.", "status": Reminder.Status.COMPLETED},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        reminder.refresh_from_db()
        self.assertEqual(reminder.notes, "Control realizado; sin novedades.")
        self.assertEqual(reminder.status, Reminder.Status.COMPLETED)
