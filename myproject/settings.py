import os
import ssl
import sys
import warnings
from pathlib import Path

from dotenv import load_dotenv
from django.core.exceptions import ImproperlyConfigured
from django.utils.translation import gettext_lazy as _

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

DEBUG = os.getenv("DJANGO_DEBUG", "false").lower() in {"1", "true", "yes"}
TESTING = "test" in sys.argv[1:] or "pytest" in sys.modules
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "")
if not SECRET_KEY:
    if TESTING:
        SECRET_KEY = "test-only-insecure-secret-key"
    else:
        raise ImproperlyConfigured(
            "Falta DJANGO_SECRET_KEY. Copia .env.example a .env y define una clave local."
        )
ALLOWED_HOSTS = [
    host.strip()
    for host in os.getenv("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")
    if host.strip()
]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt",
    "django_filters",
    "corsheaders",
    "drf_spectacular",
    "users.apps.UsersConfig",
    "shelters.apps.SheltersConfig",
    "pets.apps.PetsConfig",
    "adoptions.apps.AdoptionsConfig",
    "medical.apps.MedicalConfig",
    "messaging.apps.MessagingConfig",
    "notifications.apps.NotificationsConfig",
]
DATABASE_ROUTERS = ["myproject.database_router.FrameworkTablesRouter"]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.locale.LocaleMiddleware",
    "myproject.middleware.QueryLanguageMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "myproject.throttling.SessionLoginRateLimitMiddleware",
]

# Con HTTPS obligatorio (por defecto fuera de debug) las cookies de sesión y
# CSRF solo viajan cifradas, se envía HSTS y se confía en X-Forwarded-Proto del
# proxy que termina TLS. La redirección HTTP->HTTPS queda en el proxy/ingress
# para no romper las sondas de salud internas, que llegan por HTTP.
HTTPS_ONLY = os.getenv(
    "DJANGO_HTTPS_ONLY", "false" if DEBUG or TESTING else "true"
).lower() in {"1", "true", "yes"}
if HTTPS_ONLY:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = int(os.getenv("DJANGO_HSTS_SECONDS", "31536000"))
CSRF_TRUSTED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("DJANGO_CSRF_TRUSTED_ORIGINS", "").split(",")
    if origin.strip()
]

ROOT_URLCONF = "myproject.urls"
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "myproject" / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
                "django.template.context_processors.i18n",
            ],
        },
    },
]
WSGI_APPLICATION = "myproject.wsgi.application"
SESSION_ENGINE = "django.contrib.sessions.backends.db"

DB_ENGINE = os.getenv("DB_ENGINE", "sqlite").lower()
if DB_ENGINE == "mysql":
    import pymysql

    pymysql.install_as_MySQLdb()
    mysql_password = os.getenv("DB_PASSWORD", "")
    if not mysql_password:
        raise ImproperlyConfigured(
            "Falta DB_PASSWORD para DB_ENGINE=mysql. Define la contraseña de MySQL en .env."
        )
    mysql_database_name = os.getenv("DB_NAME", "adopkia")
    if mysql_database_name != "adopkia":
        raise ImproperlyConfigured(
            "DB_NAME debe ser exactamente 'adopkia'; las pruebas usan 'test_adopkia' "
            "y compare_schema usa 'adopkia_cmp'."
        )
    mysql_ssl_mode = os.getenv(
        "DB_SSL_MODE", "disabled" if DEBUG else "verify_identity"
    ).strip().lower()
    if mysql_ssl_mode not in {"disabled", "verify_identity"}:
        raise ImproperlyConfigured(
            "DB_SSL_MODE debe ser 'disabled' o 'verify_identity'."
        )
    mysql_host = os.getenv("DB_HOST", "127.0.0.1")
    # Una conexión a loopback no sale del equipo; es el caso del runner E2E,
    # que arranca sin debug contra el MySQL local.
    mysql_host_is_local = mysql_host.strip().lower() in {"127.0.0.1", "localhost", "::1"}
    if mysql_ssl_mode == "disabled" and not (DEBUG or mysql_host_is_local):
        raise ImproperlyConfigured(
            "DB_SSL_MODE=disabled solo se permite con DJANGO_DEBUG=true o con "
            "un DB_HOST local (127.0.0.1, localhost o ::1)."
        )
    mysql_options = {"charset": "utf8mb4"}
    if mysql_ssl_mode == "verify_identity":
        mysql_ssl_ca = os.getenv("DB_SSL_CA", "").strip() or None
        mysql_ssl_context = ssl.create_default_context(cafile=mysql_ssl_ca)
        mysql_ssl_context.check_hostname = True
        mysql_ssl_context.verify_mode = ssl.CERT_REQUIRED
        mysql_options["ssl"] = mysql_ssl_context
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.mysql",
            "NAME": mysql_database_name,
            "USER": os.getenv("DB_USER", "adopkia"),
            "PASSWORD": mysql_password,
            "HOST": mysql_host,
            "PORT": os.getenv("DB_PORT", "3306"),
            "OPTIONS": mysql_options,
            "TEST": {"NAME": "test_adopkia"},
        }
    }
elif DB_ENGINE == "sqlite":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            # DB_NAME es el nombre de la base MySQL; no se usa como ruta de
            # archivo para no crear un archivo "adopkia" en la raíz.
            "NAME": str(BASE_DIR / "db.sqlite3"),
        }
    }
else:
    raise ImproperlyConfigured("DB_ENGINE debe ser 'sqlite' o 'mysql'.")

AUTH_USER_MODEL = "users.User"
LOGIN_REDIRECT_URL = "/"
LOGOUT_REDIRECT_URL = "/"
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "es"
LANGUAGES = [
    ("es", _("Español")),
    ("en", _("English")),
]
LOCALE_PATHS = [BASE_DIR / "locale"]
USE_I18N = True
TIME_ZONE = "America/Bogota"
USE_TZ = True
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
# WhiteNoise sirve los estáticos recopilados por collectstatic; con debug los
# toma directamente de las apps, sin necesidad de recopilarlos.
WHITENOISE_USE_FINDERS = DEBUG
if DEBUG or TESTING:
    # Sin collectstatic no existe STATIC_ROOT; el aviso solo importa en producción.
    warnings.filterwarnings("ignore", message="No directory at", category=UserWarning)
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedStaticFilesStorage"},
}
# Con AZURE_STORAGE_ACCOUNT_NAME las fotos subidas se guardan en Azure Blob
# Storage mediante identidad administrada; sin ella se usa MEDIA_ROOT, que solo
# es adecuado para desarrollo porque el disco de un contenedor es efímero.
AZURE_STORAGE_ACCOUNT_NAME = os.getenv("AZURE_STORAGE_ACCOUNT_NAME", "").strip()
if AZURE_STORAGE_ACCOUNT_NAME:
    from azure.identity import DefaultAzureCredential

    STORAGES["default"] = {
        "BACKEND": "storages.backends.azure_storage.AzureStorage",
        "OPTIONS": {
            "account_name": AZURE_STORAGE_ACCOUNT_NAME,
            "azure_container": os.getenv("AZURE_STORAGE_CONTAINER", "media").strip(),
            "token_credential": DefaultAzureCredential(
                managed_identity_client_id=os.getenv("AZURE_CLIENT_ID") or None
            ),
            "overwrite_files": False,
        },
    }
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

EMAIL_BACKEND = os.getenv(
    "EMAIL_BACKEND",
    "django.core.mail.backends.console.EmailBackend"
    if DEBUG
    else "django.core.mail.backends.smtp.EmailBackend",
)
EMAIL_HOST = os.getenv("EMAIL_HOST", "")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = os.getenv("EMAIL_USE_TLS", "true").lower() in {"1", "true", "yes"}
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "no-reply@adopkia.local")

CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "DJANGO_CORS_ALLOWED_ORIGINS",
        "http://localhost:3000,http://localhost:5173",
    ).split(",")
    if origin.strip()
]

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
        "myproject.renderers.RoleAwareBrowsableAPIRenderer",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "myproject.exceptions.api_exception_handler",
}

# Número de proxies de confianza delante de la aplicación. Sin este valor, DRF
# identifica al cliente con la cabecera X-Forwarded-For completa, que el propio
# cliente puede falsificar para esquivar los límites por IP.
_num_proxies = os.getenv("DJANGO_NUM_PROXIES", "").strip()
if _num_proxies:
    REST_FRAMEWORK["NUM_PROXIES"] = int(_num_proxies)

# Límites de los endpoints públicos de autenticación (myproject.throttling).
# Se desactivan en las suites de pruebas; DJANGO_AUTH_THROTTLE_ENABLED=false
# existe solo para el runner E2E local.
AUTH_THROTTLE_ENABLED = not TESTING and os.getenv(
    "DJANGO_AUTH_THROTTLE_ENABLED", "true"
).lower() in {"1", "true", "yes"}
AUTH_THROTTLE_RATES = (
    {
        "auth_login": "20/min",
        "auth_login_identifier": "10/min",
        "auth_login_challenge": "60/min",
        "auth_register": "20/hour",
        "auth_verify_email": "20/min",
        "auth_resend_verification": "10/hour",
    }
    if AUTH_THROTTLE_ENABLED
    else {}
)
SPECTACULAR_SETTINGS = {
    "TITLE": "Adopkia API",
    "DESCRIPTION": "API para adopción responsable y seguimiento post-adopción.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}
SIMPLE_JWT = {"AUTH_HEADER_TYPES": ("Bearer",)}
