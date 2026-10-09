from django.utils.translation import gettext
from rest_framework import serializers


def localized_text(value):
    if value is None:
        return None
    return gettext(str(value))


class LocalizedModelSerializer(serializers.ModelSerializer):
    catalog_fields = ()
    choice_fields = ()

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        for name in self.catalog_fields:
            if name in representation:
                representation[name] = localized_text(representation[name])
        for name in self.choice_fields:
            field = instance._meta.get_field(name)
            label = dict(field.flatchoices).get(getattr(instance, name))
            if name in representation and label is not None:
                representation[name] = localized_text(label)
        return representation


def trigger_message(message):
    translated = gettext(message)
    return translated if translated != message else message
