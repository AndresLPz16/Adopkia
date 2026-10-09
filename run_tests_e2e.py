import os
import secrets
import subprocess
import sys
import tempfile
import time
import unittest
import json
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "myproject.settings")
os.environ["DJANGO_SECRET_KEY"] = secrets.token_urlsafe(48)
os.environ["DJANGO_DEBUG"] = "false"

import django
from django.conf import settings

django.setup()

from django.core.management import call_command
from django.db import transaction
from django.db.models import Q

from adoptions.models import Adoption, AdoptionRequest, FollowUp
from medical.models import MedicalRecord, Reminder, Veterinarian
from messaging.models import Conversation, Message
from notifications.models import Notification
from pets.models import Pet, PetPhoto
from shelters.models import Shelter, ShelterMember
from tests_e2e.common import STATE
from users.models import User


def verify_database_allowlist():
    database = settings.DATABASES["default"]
    allowed = (
        database["ENGINE"] == "django.db.backends.mysql"
        and database["NAME"] == "adopkia"
        and database["USER"] == "adopkia_dev"
        and database.get("TEST", {}).get("NAME") == "test_adopkia"
    )
    if not allowed:
        raise RuntimeError(
            "E2E detenido: solo se permiten MySQL adopkia/test_adopkia "
            "con el usuario adopkia_dev."
        )


def wait_until_ready(process, timeout=45):
    deadline = time.monotonic() + timeout
    url = "http://127.0.0.1:8000/api/v1/species/"
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError("runserver terminó antes de responder.")
        try:
            with urlopen(url, timeout=2) as response:
                if response.status == 200:
                    return
        except HTTPError as error:
            raise RuntimeError(f"runserver respondió HTTP {error.code} al iniciar.") from error
        except URLError:
            time.sleep(0.5)
    raise TimeoutError("runserver no respondió en 45 segundos.")


def cleanup_test_data(prefix, suffix):
    user_ids = list(
        User.objects.filter(email__startswith=prefix).values_list("pk", flat=True)
    )
    if not user_ids:
        return
    shelter_ids = list(
        Shelter.objects.filter(
            Q(
                name__in=(
                    f"[E2E] Refugio {suffix}",
                    f"[E2E] Refugio ajeno {suffix}",
                )
            )
            | Q(members__user_id__in=user_ids)
            | Q(verified_by_id__in=user_ids)
        ).values_list("pk", flat=True)
        .distinct()
    )
    pet_ids = list(Pet.objects.filter(shelter_id__in=shelter_ids).values_list("pk", flat=True))
    request_ids = list(
        AdoptionRequest.objects.filter(
            Q(applicant_id__in=user_ids) | Q(pet_id__in=pet_ids)
        ).values_list("pk", flat=True)
    )
    adoption_ids = list(
        Adoption.objects.filter(request_id__in=request_ids).values_list("pk", flat=True)
    )
    conversation_ids = list(
        Conversation.objects.filter(
            Q(adopter_id__in=user_ids) | Q(shelter_id__in=shelter_ids)
        ).values_list("pk", flat=True)
    )
    with transaction.atomic():
        Notification.objects.filter(
            Q(user_id__in=user_ids)
            | Q(request_id__in=request_ids)
            | Q(reminder__adoption_id__in=adoption_ids)
        ).delete()
        Message.objects.filter(conversation_id__in=conversation_ids).delete()
        Conversation.objects.filter(pk__in=conversation_ids).delete()
        Reminder.objects.filter(adoption_id__in=adoption_ids).delete()
        FollowUp.objects.filter(adoption_id__in=adoption_ids).delete()
        MedicalRecord.objects.filter(pet_id__in=pet_ids).delete()
        Adoption.objects.filter(pk__in=adoption_ids).delete()
        AdoptionRequest.objects.filter(pk__in=request_ids).delete()
        PetPhoto.objects.filter(pet_id__in=pet_ids).delete()
        Pet.objects.filter(pk__in=pet_ids).delete()
        Veterinarian.objects.filter(user_id__in=user_ids).delete()
        ShelterMember.objects.filter(
            Q(user_id__in=user_ids) | Q(shelter_id__in=shelter_ids)
        ).delete()
        Shelter.objects.filter(pk__in=shelter_ids).delete()
        User.objects.filter(pk__in=user_ids).delete()


def run():
    verify_database_allowlist()
    call_command("seed_data", verbosity=0)
    suffix = secrets.token_hex(5)
    prefix = f"e2e_{suffix}"
    STATE["suffix"] = suffix
    STATE["email_prefix"] = prefix
    STATE["city"] = f"E2E City {suffix}"

    log = tempfile.TemporaryFile(mode="w+t", encoding="utf-8")
    process = subprocess.Popen(
        [
            sys.executable,
            str(ROOT / "manage.py"),
            "runserver",
            "--noreload",
            "127.0.0.1:8000",
        ],
        cwd=ROOT,
        env=os.environ.copy(),
        stdout=log,
        stderr=subprocess.STDOUT,
        text=True,
    )
    exit_code = 1
    try:
        wait_until_ready(process)
        print("[PASS] startup runserver: GET /api/v1/species/ -> HTTP 200")
        with urlopen("http://127.0.0.1:8000/api/docs/", timeout=10) as response:
            if response.status != 200 or "text/html" not in response.headers.get(
                "Content-Type", ""
            ):
                raise RuntimeError("/api/docs/ no respondió HTML 200.")
            print("[PASS] /api/docs/: HTTP 200; text/html")
        with urlopen(
            "http://127.0.0.1:8000/api/schema/?format=json", timeout=10
        ) as response:
            schema = json.loads(response.read().decode("utf-8"))
            if response.status != 200 or not str(schema.get("openapi", "")).startswith("3."):
                raise RuntimeError("/api/schema/ no devolvió un esquema OpenAPI 3.")
            print("[PASS] /api/schema/: HTTP 200; OpenAPI 3 JSON parseable")
        modules = (
            "tests_e2e.e2e_01_authentication",
            "tests_e2e.e2e_02_adoption_flow",
            "tests_e2e.e2e_03_permissions",
            "tests_e2e.e2e_04_permission_matrix",
        )
        suite = unittest.TestSuite()
        loader = unittest.TestLoader()
        for module_name in modules:
            module = __import__(module_name, fromlist=["*"])
            suite.addTests(loader.loadTestsFromModule(module))
        result = unittest.TextTestRunner(verbosity=2).run(suite)
        exit_code = 0 if result.wasSuccessful() else 1
    except Exception as error:
        print(f"[FAIL] E2E no completado: {type(error).__name__}")
        log.seek(0)
        lines = log.readlines()[-40:]
        for line in lines:
            if "password" not in line.lower() and "token" not in line.lower():
                print(line.rstrip())
        return 1
    finally:
        try:
            cleanup_test_data(prefix, suffix)
            print("[INFO] Se eliminaron los registros E2E identificados por el prefijo único.")
        except Exception as error:
            code = error.args[0] if error.args and isinstance(error.args[0], int) else "N/D"
            print(
                f"[FAIL] Limpieza E2E incompleta: {type(error).__name__}; "
                f"código={code}"
            )
            exit_code = 1
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)
        log.close()
    return exit_code


if __name__ == "__main__":
    raise SystemExit(run())
