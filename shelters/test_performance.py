import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from users.models import Role, User

from .models import Shelter, ShelterMember


@pytest.mark.django_db
def test_shelter_list_avoids_per_row_membership_queries(
    django_assert_max_num_queries,
):
    administrator = User.objects.create_user(
        email="admin-query@example.com",
        password="test-password",
        name="Admin",
        role=Role.Name.ADMIN,
    )
    shelter_user = User.objects.create_user(
        email="member-query@example.com",
        password="test-password",
        name="Shelter member",
        role=Role.Name.SHELTER,
    )
    shelters = [
        Shelter.objects.create(
            name=f"Verified {index}",
            address="Address",
            city="City",
            verification_status=Shelter.VerificationStatus.VERIFIED,
            verification_date=timezone.now(),
            verified_by=administrator,
            contact_email=f"contact{index}@example.com",
        )
        for index in range(4)
    ]
    member_shelter = Shelter.objects.create(
        name="Member shelter",
        address="Member address",
        city="Member city",
    )
    ShelterMember.objects.create(
        shelter=member_shelter,
        user=shelter_user,
        position=ShelterMember.Position.MANAGER,
    )
    client = APIClient()
    client.force_authenticate(shelter_user)

    with django_assert_max_num_queries(6):
        response = client.get(reverse("shelter-list"))

    assert response.status_code == 200
    results = response.data["results"]
    assert len(results) == len(shelters) + 1
    by_name = {item["name"]: item for item in results}
    assert by_name["Member shelter"]["address"] == "Member address"
    for index in range(len(shelters)):
        assert by_name[f"Verified {index}"]["description"] is None
        assert "address" not in by_name[f"Verified {index}"]
