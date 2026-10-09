from datetime import date, timedelta
from io import StringIO

from django.core.management import call_command
from django.urls import reverse
from rest_framework.test import APITestCase

from adoptions.models import Adoption, AdoptionRequest
from notifications.models import Notification
from pets.models import Breed, Pet, Species
from shelters.models import Shelter
from users.models import Role, User

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
