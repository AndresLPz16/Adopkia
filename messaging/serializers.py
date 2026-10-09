from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from myproject.i18n import LocalizedModelSerializer

from .models import Conversation, Message


class ConversationReadSerializer(LocalizedModelSerializer):
    adopter_name = serializers.CharField(source="adopter.name", read_only=True)
    shelter_name = serializers.CharField(source="shelter.name", read_only=True)
    pet_name = serializers.CharField(source="pet.name", read_only=True, allow_null=True)

    class Meta:
        model = Conversation
        fields = (
            "id",
            "adopter",
            "adopter_name",
            "shelter",
            "shelter_name",
            "pet",
            "pet_name",
            "started_at",
        )
        read_only_fields = fields


class ConversationCreateSerializer(LocalizedModelSerializer):
    class Meta:
        model = Conversation
        fields = ("id", "shelter", "pet")
        read_only_fields = ("id",)

    def validate(self, attrs):
        pet = attrs.get("pet")
        shelter = attrs["shelter"]
        if pet and pet.shelter_id != shelter.id:
            raise serializers.ValidationError(
                {"pet": _("La mascota seleccionada no pertenece al refugio indicado.")}
            )
        if shelter.verification_status != "verificado":
            raise serializers.ValidationError(
                {"shelter": _("Solo se puede iniciar una conversación con un refugio verificado.")}
            )
        return attrs


class MessageReadSerializer(LocalizedModelSerializer):
    sender_name = serializers.CharField(source="sender.name", read_only=True)

    class Meta:
        model = Message
        fields = (
            "id",
            "conversation",
            "sender",
            "sender_name",
            "content",
            "sent_at",
            "is_read",
        )
        read_only_fields = fields


class MessageWriteSerializer(LocalizedModelSerializer):
    class Meta:
        model = Message
        fields = ("id", "conversation", "content")
        read_only_fields = ("id",)


class MessageUpdateSerializer(LocalizedModelSerializer):
    class Meta:
        model = Message
        fields = ("content",)
