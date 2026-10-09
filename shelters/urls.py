from rest_framework.routers import DefaultRouter

from .views import ShelterMemberViewSet, ShelterViewSet

router = DefaultRouter()
router.include_root_view = False
router.register("shelters", ShelterViewSet, basename="shelter")
router.register("shelter-members", ShelterMemberViewSet, basename="shelter-member")
urlpatterns = router.urls
