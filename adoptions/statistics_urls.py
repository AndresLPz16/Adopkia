from django.urls import path

from .statistics import AdoptionStatisticsView

urlpatterns = [
    path("statistics/adoptions/", AdoptionStatisticsView.as_view(), name="adoption-statistics"),
]
