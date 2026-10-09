from datetime import date
from unittest import skipUnless

from django.db import DatabaseError, connection, transaction
from django.test import TestCase

from adoptions.models import Adoption, AdoptionRequest
from messaging.models import Conversation
from medical.models import Veterinarian
from pets.models import Breed, Pet, Species
from shelters.models import Shelter, ShelterMember
from users.models import Role, User


@skipUnless(connection.vendor == "mysql", "Los triggers de adopkia_v3 requieren MySQL.")
class SqlV3CasesTests(TestCase):
    def setUp(self):
        self.adopter_role = Role.objects.get(name=Role.Name.ADOPTER)
        self.shelter_role = Role.objects.get(name=Role.Name.SHELTER)
        self.admin_role = Role.objects.get(name=Role.Name.ADMIN)
        self.vet_role = Role.objects.get(name=Role.Name.VETERINARIAN)
        self.adopter = self.make_user("ana", self.adopter_role)
        self.shelter_user = self.make_user("rita", self.shelter_role)
        self.admin = self.make_user("dani", self.admin_role)
        self.vet_user = self.make_user("vera", self.vet_role)
        self.other_adopter = self.make_user("beto", self.adopter_role)
        species, _ = Species.objects.get_or_create(name="Perro")
        self.mestizo, _ = Breed.objects.get_or_create(
            species=species, name="Mestizo"
        )

    def make_user(self, local_part, role):
        return User.objects.create_user(
            email=f"{local_part}@sql-v3.test",
            password="SafePass!2026",
            name=local_part,
            role=role,
        )

    def assert_mysql_error(self, callback):
        with self.assertRaises(DatabaseError):
            with transaction.atomic():
                callback()

    def test_t01_to_t25_match_adopkia_v3_pruebas(self):
        # T01 valid admin verifier.
        valid_shelter = Shelter.objects.create(
            name="Patitas",
            address="Cll 1",
            city="Riohacha",
            verification_status=Shelter.VerificationStatus.VERIFIED,
            verification_date="2026-01-01T00:00:00Z",
            verified_by=self.admin,
        )
        self.shelter = valid_shelter

        # T02 verifier must have the administrator role.
        self.assert_mysql_error(
            lambda: Shelter.objects.create(
                name="Refugio T02",
                address="Cll 3",
                city="Riohacha",
                verification_status=Shelter.VerificationStatus.VERIFIED,
                verification_date="2026-01-01T00:00:00Z",
                verified_by=self.adopter,
            )
        )

        # T03/T04 member role must be shelter, and that membership is valid.
        self.assert_mysql_error(
            lambda: ShelterMember.objects.create(
                shelter=valid_shelter,
                user=self.adopter,
                position=ShelterMember.Position.COLLABORATOR,
            )
        )
        ShelterMember.objects.create(
            shelter=valid_shelter,
            user=self.shelter_user,
            position=ShelterMember.Position.MANAGER,
        )

        # T05 veterinarian profile must reference a veterinarian-role user.
        Veterinarian.objects.create(
            user=self.vet_user, professional_card="TP-SQL-001"
        )
        self.available_pet = Pet.objects.create(
            shelter=valid_shelter,
            breed=self.mestizo,
            name="Firulais",
            size=Pet.Size.MEDIUM,
        )

        # T06-T09 validate request roles and uniqueness while allowing another adopter.
        self.assert_mysql_error(
            lambda: AdoptionRequest.objects.create(
                applicant=self.shelter_user, pet=self.available_pet
            )
        )
        request = AdoptionRequest.objects.create(
            applicant=self.adopter, pet=self.available_pet
        )
        self.assert_mysql_error(
            lambda: AdoptionRequest.objects.create(
                applicant=self.adopter, pet=self.available_pet
            )
        )
        AdoptionRequest.objects.create(
            applicant=self.other_adopter, pet=self.available_pet
        )

        # T10/T11 a pending request cannot create an adoption; after rejection it can reapply.
        self.assert_mysql_error(
            lambda: Adoption.objects.create(request=request, adoption_date=date.today())
        )
        request.status = AdoptionRequest.Status.REJECTED
        request.save(update_fields=("status",))
        replacement = AdoptionRequest.objects.create(
            applicant=self.adopter, pet=self.available_pet
        )

        # T12-T16 approved requests, immutable links, and return consistency.
        replacement.status = AdoptionRequest.Status.APPROVED
        replacement.save(update_fields=("status",))
        adoption = Adoption.objects.create(
            request=replacement, adoption_date=date.today()
        )
        replacement.status = AdoptionRequest.Status.PENDING
        self.assert_mysql_error(lambda: replacement.save(update_fields=("status",)))
        replacement.refresh_from_db()

        other_request = AdoptionRequest.objects.filter(
            applicant=self.other_adopter, pet=self.available_pet
        ).get()
        adoption.request = other_request
        self.assert_mysql_error(lambda: adoption.save(update_fields=("request",)))
        adoption.refresh_from_db()

        adoption.status = Adoption.Status.RETURNED
        adoption.return_date = date.today()
        self.assert_mysql_error(
            lambda: adoption.save(update_fields=("status", "return_date"))
        )
        adoption.return_reason = "Alergia"
        adoption.save(update_fields=("status", "return_date", "return_reason"))

        # T17/T18 conversational participants must have the adopter role.
        self.assert_mysql_error(
            lambda: Conversation.objects.create(
                adopter=self.shelter_user, shelter=valid_shelter
            )
        )
        Conversation.objects.create(adopter=self.adopter, shelter=valid_shelter)

        # T19-T23 role changes cannot invalidate an existing relationship.
        self.shelter_user.role = self.adopter_role
        self.assert_mysql_error(
            lambda: self.shelter_user.save(update_fields=("role",))
        )
        self.shelter_user.refresh_from_db()
        self.vet_user.role = self.adopter_role
        self.assert_mysql_error(lambda: self.vet_user.save(update_fields=("role",)))
        self.vet_user.refresh_from_db()
        self.admin.role = self.adopter_role
        self.assert_mysql_error(lambda: self.admin.save(update_fields=("role",)))
        self.admin.refresh_from_db()
        self.adopter.role = self.shelter_role
        self.assert_mysql_error(lambda: self.adopter.save(update_fields=("role",)))
        self.adopter.refresh_from_db()
        unlinked_user = self.make_user("libre", self.adopter_role)
        unlinked_user.role = self.shelter_role
        unlinked_user.save(update_fields=("role",))
        self.assertEqual(unlinked_user.role, self.shelter_role)

        # T24/T25 verify source views.
        with connection.cursor() as cursor:
            cursor.execute("SELECT total_adopciones, devueltas FROM vista_tasa_devolucion")
            totals = cursor.fetchone()
            cursor.execute(
                "SELECT nombre FROM vista_mascotas_disponibles WHERE id_mascota=%s",
                (self.available_pet.pk,),
            )
            available = cursor.fetchone()
        self.assertEqual(totals, (1, 1))
        self.assertEqual(available, ("Firulais",))
