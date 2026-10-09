from rest_framework.routers import DefaultRouter

from .views import NotificationViewSet

router = DefaultRouter()
router.include_root_view = False
router.register("notifications", NotificationViewSet, basename="notification")
urlpatterns = router.urls
