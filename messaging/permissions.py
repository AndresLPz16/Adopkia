from django.db.models import Q

from rest_framework.permissions import BasePermission


def user_can_access_conversation(user, conversation):
    return bool(
        user
        and user.is_authenticated
        and (
            conversation.adopter_id == user.pk
            or conversation.shelter.members.filter(user_id=user.pk).exists()
        )
    )


def conversations_for_user(queryset, user):
    if not user.is_authenticated:
        return queryset.none()
    if user.role.name == "administrador":
        return queryset
    return queryset.filter(
        Q(adopter=user) | Q(shelter__members__user=user)
    ).distinct()
