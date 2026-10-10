from adoptions.models import Adoption
from users.models import Role


def medical_records_for_user(queryset, user):
    if not user.is_authenticated:
        return queryset.none()
    if user.role.name in (Role.Name.ADMIN, Role.Name.VETERINARIAN):
        return queryset
    if user.role.name == Role.Name.SHELTER:
        return queryset.filter(pet__shelter__members__user=user).distinct()
    if user.role.name == Role.Name.ADOPTER:
        return queryset.filter(
            pet__adoption_requests__applicant=user,
            pet__adoption_requests__adoption__status__in=Adoption.Status.values,
        ).distinct()
    return queryset.none()


def reminders_for_user(queryset, user):
    if not user.is_authenticated:
        return queryset.none()
    if user.role.name == Role.Name.ADMIN:
        return queryset
    if user.role.name == Role.Name.SHELTER:
        return queryset.filter(
            adoption__request__pet__shelter__members__user=user
        ).distinct()
    if user.role.name == Role.Name.VETERINARIAN:
        return queryset
    if user.role.name == Role.Name.ADOPTER:
        return queryset.filter(adoption__request__applicant=user)
    return queryset.none()
