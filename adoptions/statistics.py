from django.db.models import Count, Q
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import serializers
from rest_framework.views import APIView

from myproject.permissions import IsAdminRole
from pets.models import Pet

from .models import Adoption


class AdoptionStatisticsSerializer(serializers.Serializer):
    total_adoptions = serializers.IntegerField()
    returned_adoptions = serializers.IntegerField()
    active_adoptions = serializers.IntegerField()
    adopted_pets = serializers.IntegerField()
    returned_pets = serializers.IntegerField()
    return_rate = serializers.FloatField()
    return_rate_unit = serializers.CharField()


class AdoptionStatisticsView(APIView):
    permission_classes = (IsAuthenticated, IsAdminRole)

    @extend_schema(responses=AdoptionStatisticsSerializer)
    def get(self, request):
        counts = Adoption.objects.aggregate(
            total=Count("id"),
            returned=Count("id", filter=Q(status=Adoption.Status.RETURNED)),
            active=Count("id", filter=Q(status=Adoption.Status.ACTIVE)),
        )
        return_rate = (
            round(counts["returned"] * 100 / counts["total"], 2)
            if counts["total"]
            else 0.0
        )
        return Response(
            {
                "total_adoptions": counts["total"],
                "returned_adoptions": counts["returned"],
                "active_adoptions": counts["active"],
                "adopted_pets": Pet.objects.filter(status=Pet.Status.ADOPTED).count(),
                "returned_pets": Pet.objects.filter(status=Pet.Status.RETURNED).count(),
                "return_rate": return_rate,
                "return_rate_unit": "percent",
            }
        )
