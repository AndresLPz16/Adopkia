from users.models import Role


def user_can_record_medical_care(user):
    return bool(
        user
        and user.is_authenticated
        and user.role.name in (Role.Name.ADMIN, Role.Name.VETERINARIAN)
    )
