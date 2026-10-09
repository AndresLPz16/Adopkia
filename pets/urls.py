from rest_framework.routers import DefaultRouter

from .views import BreedViewSet, PetPhotoViewSet, PetViewSet, SpeciesViewSet

router = DefaultRouter()
router.include_root_view = False
router.register("species", SpeciesViewSet, basename="species")
router.register("breeds", BreedViewSet, basename="breed")
router.register("pets", PetViewSet, basename="pet")
router.register("pet-photos", PetPhotoViewSet, basename="pet-photo")
urlpatterns = router.urls
