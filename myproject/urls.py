from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path
from django.conf.urls.i18n import i18n_patterns
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework_simplejwt.views import TokenRefreshView

from myproject.api_index import ApiIndexView
from myproject.authentication import LocalizedTokenObtainPairView
from myproject.frontend import SPA_ROUTE_PATTERN, spa_index

urlpatterns = [
    path("", ApiIndexView.as_view(), name="root"),
    path("api-auth/", include("rest_framework.urls")),
    path("api/v1/", ApiIndexView.as_view(), name="api-root"),
    path("api/v1/auth/", include("users.urls")),
    path("api/v1/", include("shelters.urls")),
    path("api/v1/", include("pets.urls")),
    path("api/v1/", include("adoptions.urls")),
    path("api/v1/", include("medical.urls")),
    path("api/v1/", include("messaging.urls")),
    path("api/v1/", include("notifications.urls")),
    path("api/v1/", include("adoptions.statistics_urls")),
    path("api/v1/auth/login/", LocalizedTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/v1/auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
]

if settings.FRONTEND_DIST_DIR:
    # Antes que el panel de Django: `/admin/permissions` es una ruta del portal.
    urlpatterns += [re_path(SPA_ROUTE_PATTERN, spa_index, name="spa-index")]

urlpatterns += i18n_patterns(
    path("admin/", admin.site.urls),
    prefix_default_language=False,
)

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
