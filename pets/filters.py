import calendar
from datetime import date

from django_filters import rest_framework as filters
from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import ValidationError

from .models import Pet


def birth_date_cutoff(years):
    today = date.today()
    year = today.year - years
    day = min(today.day, calendar.monthrange(year, today.month)[1])
    return date(year, today.month, day)


class PetFilter(filters.FilterSet):
    species = filters.NumberFilter(field_name="breed__species_id")
    city = filters.CharFilter(field_name="shelter__city", lookup_expr="iexact")
    min_age = filters.NumberFilter(method="filter_min_age")
    max_age = filters.NumberFilter(method="filter_max_age")

    class Meta:
        model = Pet
        fields = ("breed", "city", "status", "size")

    def _years(self, value, label):
        if value < 0 or value % 1:
            raise ValidationError(_("%(label)s debe ser un número entero no negativo.") % {
                "label": label
            })
        return int(value)

    def filter_min_age(self, queryset, name, value):
        years = self._years(value, _("La edad mínima"))
        return queryset.filter(approximate_birth_date__lte=birth_date_cutoff(years))

    def filter_max_age(self, queryset, name, value):
        years = self._years(value, _("La edad máxima"))
        return queryset.filter(approximate_birth_date__gt=birth_date_cutoff(years + 1))
