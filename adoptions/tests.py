from datetime import date

from django.db import IntegrityError, transaction
from django.urls import reverse
from rest_framework.test import APITestCase

from notifications.models import Notification
from pets.models import Breed, Pet, Species
from shelters.models import Shelter, ShelterMember
from users.models import Role, User

from .models import Adoption, AdoptionRequest, FormAnswer, FormQuestion, FollowUp


class AdoptionFlowTests(APITestCase):
    def setUp(self):
        self.adopter = User.objects.create_user(
            email="adopter@example.com",
            password="SafePass!2026",
            name="Adoptante",
        )
        self.other_adopter = User.objects.create_user(
            email="other@example.com",
            password="SafePass!2026",
            name="Otro adoptante",
        )
        self.shelter_user = User.objects.create_user(
            email="shelter@example.com",
            password="SafePass!2026",
            name="Refugio",
            role=Role.Name.SHELTER,
        )
        self.second_shelter_user = User.objects.create_user(
            email="shelter-member@example.com",
            password="SafePass!2026",
            name="Integrante",
            role=Role.Name.SHELTER,
        )
        self.admin = User.objects.create_user(
            email="admin@example.com",
            password="SafePass!2026",
            name="Admin",
            role=Role.Name.ADMIN,
        )
        self.shelter = Shelter.objects.create(
            name="Huellas",
            address="Calle 1",
            city="Riohacha",
            verification_status=Shelter.VerificationStatus.VERIFIED,
            verification_date="2025-01-01T00:00:00Z",
            verified_by=self.admin,
        )
        ShelterMember.objects.create(
            shelter=self.shelter,
            user=self.shelter_user,
            position=ShelterMember.Position.MANAGER,
        )
        ShelterMember.objects.create(
            shelter=self.shelter,
            user=self.second_shelter_user,
            position=ShelterMember.Position.COLLABORATOR,
        )
        species = Species.objects.create(name="Perro")
        breed = Breed.objects.create(species=species, name="Mestizo")
        self.pet = Pet.objects.create(
            shelter=self.shelter,
            breed=breed,
            name="Luna",
            size=Pet.Size.MEDIUM,
        )
        self.question = FormQuestion.objects.create(
            prompt="¿Tienes experiencia con mascotas?",
            answer_type=FormQuestion.AnswerType.YES_NO,
            required=True,
            order=1,
        )

    def submit_request(self, user=None):
        self.client.force_authenticate(user or self.adopter)
        return self.client.post(
            reverse("adoption-request-list"),
            {
                "pet": self.pet.pk,
                "answers": [{"question": self.question.pk, "value": "Sí"}],
            },
            format="json",
        )

    def test_request_approval_follow_up_and_return_flow(self):
        created = self.submit_request()
        self.assertEqual(created.status_code, 201)
        request_id = created.data["id"]
        self.assertEqual(Notification.objects.filter(request_id=request_id).count(), 2)
        self.assertEqual(
            set(
                Notification.objects.filter(request_id=request_id).values_list(
                    "notification_type", flat=True
                )
            ),
            {Notification.NotificationType.NEW_REQUEST},
        )
        self.pet.refresh_from_db()
        self.assertEqual(self.pet.status, Pet.Status.IN_PROCESS)
        self.assertEqual(FormAnswer.objects.filter(request_id=request_id).count(), 1)

        duplicate = self.submit_request()
        self.assertEqual(duplicate.status_code, 400)
        self.assertEqual(AdoptionRequest.objects.count(), 1)

        self.client.force_authenticate(self.shelter_user)
        approved = self.client.post(
            reverse("adoption-request-approve", args=(request_id,)), {}, format="json"
        )
        self.assertEqual(approved.status_code, 201)
        self.assertEqual(approved.data["status_code"], Adoption.Status.ACTIVE)
        self.assertEqual(
            Notification.objects.filter(
                request_id=request_id,
                notification_type=Notification.NotificationType.APPROVAL,
            ).count(),
            1,
        )
        adoption = Adoption.objects.get(request_id=request_id)
        self.pet.refresh_from_db()
        self.assertEqual(self.pet.status, Pet.Status.ADOPTED)

        follow_up = self.client.post(
            reverse("follow-up-list"),
            {
                "adoption": adoption.pk,
                "date": date.today().isoformat(),
                "observations": "Come bien y está activa.",
            },
            format="json",
        )
        self.assertEqual(follow_up.status_code, 201)
        self.assertEqual(follow_up.data["observations"], "Come bien y está activa.")
        self.assertEqual(FollowUp.objects.filter(adoption=adoption).count(), 1)

        returned = self.client.post(
            reverse("adoption-return", args=(adoption.pk,)),
            {"reason": "La familia se traslada"},
            format="json",
        )
        self.assertEqual(returned.status_code, 200)
        self.assertEqual(returned.data["status_code"], Adoption.Status.RETURNED)
        adoption.refresh_from_db()
        self.pet.refresh_from_db()
        self.assertEqual(adoption.status, Adoption.Status.RETURNED)
        self.assertEqual(adoption.return_date, date.today())
        self.assertEqual(self.pet.status, Pet.Status.RETURNED)

    def test_request_list_includes_question_prompts_for_superadmin_review(self):
        self.submit_request()
        self.admin.is_platform_superadmin = True
        self.admin.save(update_fields=("is_platform_superadmin",))
        self.client.force_authenticate(self.admin)

        response = self.client.get(reverse("adoption-request-list"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data["results"][0]["answers"][0]["question_prompt"],
            "¿Tienes experiencia con mascotas?",
        )
        self.assertEqual(response.data["results"][0]["answers"][0]["value"], "Sí")
        self.assertEqual(response.data["results"][0]["pet_details"]["name"], "Luna")
        self.assertEqual(
            response.data["results"][0]["pet_details"]["status_code"],
            Pet.Status.IN_PROCESS,
        )
        self.assertEqual(
            response.data["results"][0]["status_code"],
            AdoptionRequest.Status.PENDING,
        )

    def test_request_and_notification_are_visible_to_every_shelter_member(self):
        created = self.submit_request()
        self.assertEqual(created.status_code, 201)
        request_id = created.data["id"]

        self.client.force_authenticate(self.second_shelter_user)
        response = self.client.get(reverse("adoption-request-list"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], request_id)
        self.assertEqual(response.data["results"][0]["answers"][0]["value"], "Sí")

        notifications = self.client.get(reverse("notification-list"))
        self.assertEqual(notifications.status_code, 200)
        self.assertEqual(
            notifications.data["results"][0]["notification_type"],
            "Nueva solicitud",
        )

    def test_each_request_state_change_creates_one_typed_notification(self):
        first = self.submit_request(self.adopter)
        second = self.submit_request(self.other_adopter)
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 201)
        self.assertEqual(Notification.objects.count(), 4)

        self.client.force_authenticate(self.shelter_user)
        approved = self.client.post(
            reverse("adoption-request-approve", args=(first.data["id"],)),
            {},
            format="json",
        )
        self.assertEqual(approved.status_code, 201)
        self.assertEqual(Notification.objects.count(), 6)
        self.assertEqual(
            Notification.objects.filter(
                request_id=first.data["id"],
                notification_type=Notification.NotificationType.APPROVAL,
            ).count(),
            1,
        )
        self.assertEqual(
            Notification.objects.filter(
                request_id=second.data["id"],
                notification_type=Notification.NotificationType.REJECTION,
            ).count(),
            1,
        )

        another_pet = Pet.objects.create(
            shelter=self.shelter,
            breed=self.pet.breed,
            name="Milo",
            size=Pet.Size.SMALL,
        )
        self.client.force_authenticate(self.adopter)
        cancelled = self.client.post(
            reverse("adoption-request-list"),
            {
                "pet": another_pet.pk,
                "answers": [{"question": self.question.pk, "value": "Sí"}],
            },
            format="json",
        )
        self.assertEqual(cancelled.status_code, 201)
        response = self.client.post(
            reverse("adoption-request-cancel", args=(cancelled.data["id"],)),
            {},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Notification.objects.count(), 10)
        self.assertEqual(
            Notification.objects.filter(
                request_id=cancelled.data["id"],
                notification_type=Notification.NotificationType.SYSTEM,
            ).count(),
            2,
        )
        self.assertEqual(
            set(Notification.objects.values_list("notification_type", flat=True)),
            {
                Notification.NotificationType.NEW_REQUEST,
                Notification.NotificationType.APPROVAL,
                Notification.NotificationType.REJECTION,
                Notification.NotificationType.SYSTEM,
            },
        )

    def test_only_adopter_can_submit_and_shelter_can_decide(self):
        response = self.submit_request(self.shelter_user)
        self.assertEqual(response.status_code, 403)

        created = self.submit_request(self.adopter)
        other_shelter_user = User.objects.create_user(
            email="unrelated@example.com",
            password="SafePass!2026",
            name="Otro",
            role=Role.Name.SHELTER,
        )
        self.client.force_authenticate(other_shelter_user)
        response = self.client.post(
            reverse("adoption-request-approve", args=(created.data["id"],)),
            {},
            format="json",
        )
        self.assertEqual(response.status_code, 404)

    def test_form_answer_question_pair_is_unique(self):
        adoption_request = AdoptionRequest.objects.create(
            applicant=self.adopter, pet=self.pet
        )
        FormAnswer.objects.create(
            request=adoption_request, question=self.question, value="Primera respuesta"
        )
        with self.assertRaises(IntegrityError), transaction.atomic():
            FormAnswer.objects.create(
                request=adoption_request, question=self.question, value="Duplicada"
            )

    def test_patch_pending_request_without_answers_preserves_existing_answers(self):
        created = self.submit_request()
        request_id = created.data["id"]

        detail = self.client.get(
            reverse("adoption-request-detail", args=(request_id,))
        )
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(
            detail.data["answers"][0]["question_prompt"],
            self.question.prompt,
        )

        response = self.client.patch(
            reverse("adoption-request-detail", args=(request_id,)),
            {"pet": self.pet.pk},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            FormAnswer.objects.get(request_id=request_id, question=self.question).value,
            "Sí",
        )

    def test_patch_pending_request_replaces_answers(self):
        created = self.submit_request()
        request_id = created.data["id"]

        response = self.client.patch(
            reverse("adoption-request-detail", args=(request_id,)),
            {"answers": [{"question": self.question.pk, "value": "No"}]},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            FormAnswer.objects.get(request_id=request_id, question=self.question).value,
            "No",
        )
        self.assertEqual(FormAnswer.objects.filter(request_id=request_id).count(), 1)

    def test_patch_pending_request_moves_pet_and_updates_both_statuses(self):
        created = self.submit_request()
        another_pet = Pet.objects.create(
            shelter=self.shelter,
            breed=self.pet.breed,
            name="Milo",
            size=Pet.Size.SMALL,
        )

        response = self.client.patch(
            reverse("adoption-request-detail", args=(created.data["id"],)),
            {"pet": another_pet.pk},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.pet.refresh_from_db()
        another_pet.refresh_from_db()
        self.assertEqual(self.pet.status, Pet.Status.AVAILABLE)
        self.assertEqual(another_pet.status, Pet.Status.IN_PROCESS)
        self.assertEqual(
            AdoptionRequest.objects.get(pk=created.data["id"]).pet_id,
            another_pet.pk,
        )
