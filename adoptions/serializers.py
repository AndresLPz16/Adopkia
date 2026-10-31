from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from myproject.i18n import LocalizedModelSerializer
from pets.serializers import PetReadSerializer
from .models import Adoption, AdoptionRequest, FormAnswer, FormQuestion, FollowUp
from .services import create_adoption_request, update_adoption_request


class FormQuestionSerializer(LocalizedModelSerializer):
    catalog_fields = ("prompt",)
    choice_fields = ("answer_type",)

    class Meta:
        model = FormQuestion
        fields = ("id", "prompt", "answer_type", "required", "order", "active")
        read_only_fields = fields


class FormAnswerSerializer(LocalizedModelSerializer):
    question_prompt = serializers.CharField(source="question.prompt", read_only=True)

    class Meta:
        model = FormAnswer
        fields = ("request", "question", "question_prompt", "value")


class AdoptionRequestReadSerializer(LocalizedModelSerializer):
    choice_fields = ("status",)
    status_code = serializers.CharField(source="status", read_only=True)
    answers = FormAnswerSerializer(many=True, read_only=True)
    applicant_name = serializers.CharField(source="applicant.name", read_only=True)
    pet_name = serializers.CharField(source="pet.name", read_only=True)
    pet_details = PetReadSerializer(source="pet", read_only=True)

    class Meta:
        model = AdoptionRequest
        fields = (
            "id",
            "applicant",
            "applicant_name",
            "pet",
            "pet_name",
            "pet_details",
            "requested_at",
            "status",
            "status_code",
            "responded_at",
            "shelter_notes",
            "pending_unique",
            "answers",
        )
        read_only_fields = fields


class AnswerInputSerializer(serializers.Serializer):
    question = serializers.PrimaryKeyRelatedField(
        queryset=FormQuestion.objects.filter(active=True)
    )
    value = serializers.CharField(allow_blank=True, trim_whitespace=False)


class AdoptionRequestWriteSerializer(LocalizedModelSerializer):
    answers = AnswerInputSerializer(many=True, required=False, write_only=True)

    class Meta:
        model = AdoptionRequest
        fields = ("id", "pet", "answers")
        read_only_fields = ("id",)

    def validate_answers(self, answers):
        ids = [answer["question"].id for answer in answers]
        if len(ids) != len(set(ids)):
            raise serializers.ValidationError(_("No puedes responder dos veces la misma pregunta."))
        return answers

    def validate(self, attrs):
        if self.instance is not None and "answers" not in attrs:
            return attrs
        answered = {answer["question"].id for answer in attrs.get("answers", [])}
        required = set(
            FormQuestion.objects.filter(active=True, required=True).values_list("id", flat=True)
        )
        if required - answered:
            raise serializers.ValidationError(
                {"answers": _("Debes responder todas las preguntas obligatorias del formulario.")}
            )
        return attrs

    def create(self, validated_data):
        answers = validated_data.pop("answers", [])
        return create_adoption_request(
            applicant=self.context["request"].user,
            pet_id=validated_data["pet"].pk,
            answers=answers,
        )

    def update(self, instance, validated_data):
        return update_adoption_request(
            adoption_request=instance,
            validated_data=validated_data,
        )


class AdoptionSerializer(LocalizedModelSerializer):
    choice_fields = ("status",)
    status_code = serializers.CharField(source="status", read_only=True)
    applicant = serializers.CharField(source="request.applicant.name", read_only=True)
    pet = serializers.IntegerField(source="request.pet_id", read_only=True)
    pet_name = serializers.CharField(source="request.pet.name", read_only=True)

    class Meta:
        model = Adoption
        fields = (
            "id",
            "request",
            "applicant",
            "pet",
            "pet_name",
            "adoption_date",
            "status",
            "status_code",
            "return_date",
            "return_reason",
        )
        read_only_fields = fields


class FollowUpSerializer(LocalizedModelSerializer):
    choice_fields = ("wellbeing",)
    class Meta:
        model = FollowUp
        fields = ("id", "adoption", "registered_by", "date", "wellbeing", "observations")
        read_only_fields = ("id", "registered_by")
