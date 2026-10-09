from rest_framework.routers import DefaultRouter

from .views import (
    AdoptionRequestViewSet,
    AdoptionViewSet,
    FollowUpViewSet,
    FormQuestionViewSet,
)

router = DefaultRouter()
router.include_root_view = False
router.register("form-questions", FormQuestionViewSet, basename="form-question")
router.register("adoption-requests", AdoptionRequestViewSet, basename="adoption-request")
router.register("adoptions", AdoptionViewSet, basename="adoption")
router.register("follow-ups", FollowUpViewSet, basename="follow-up")
urlpatterns = router.urls
