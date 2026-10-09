from rest_framework.routers import DefaultRouter

from .views import MedicalRecordViewSet, ReminderViewSet, VaccineViewSet, VeterinarianViewSet

router = DefaultRouter()
router.include_root_view = False
router.register("veterinarians", VeterinarianViewSet, basename="veterinarian")
router.register("medical-records", MedicalRecordViewSet, basename="medical-record")
router.register("vaccines", VaccineViewSet, basename="vaccine")
router.register("reminders", ReminderViewSet, basename="reminder")
urlpatterns = router.urls
