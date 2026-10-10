import json
import secrets
from dataclasses import dataclass
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

BASE_URL = "http://127.0.0.1:8000/api/v1/"
STATE = {}
PASSWORDS = set()


@dataclass
class ApiResponse:
    status: int
    headers: object
    body: bytes

    @property
    def text(self):
        return self.body.decode("utf-8", errors="replace")

    def json(self):
        return json.loads(self.body.decode("utf-8"))


def _multipart(fields):
    boundary = "----AdopkiaE2E" + secrets.token_hex(12)
    parts = []
    for name, value in fields.items():
        parts.extend(
            (
                f"--{boundary}\r\n",
                f'Content-Disposition: form-data; name="{name}"\r\n\r\n',
                f"{value}\r\n",
            )
        )
    parts.append(f"--{boundary}--\r\n")
    return boundary, "".join(parts).encode("utf-8")


def request(method, path, *, token=None, data=None, multipart=None, headers=None):
    request_headers = {"Accept": "application/json"}
    request_headers.update(headers or {})
    body = None
    if token:
        request_headers["Authorization"] = f"Bearer {token}"
    if data is not None:
        body = json.dumps(data).encode("utf-8")
        request_headers["Content-Type"] = "application/json"
    elif multipart is not None:
        boundary, body = _multipart(multipart)
        request_headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"

    http_request = Request(
        BASE_URL + path.lstrip("/"),
        data=body,
        headers=request_headers,
        method=method,
    )
    try:
        with urlopen(http_request, timeout=15) as response:
            return ApiResponse(response.status, response.headers, response.read())
    except HTTPError as error:
        return ApiResponse(error.code, error.headers, error.read())
    except URLError as error:
        raise AssertionError(f"Falló la llamada HTTP a {path}: {error.reason}") from error


def _contains_sensitive_key(value):
    if isinstance(value, dict):
        for key, nested in value.items():
            normalized = str(key).lower()
            if normalized in {"password_hash", "contrasena", "contrasena_hash", "hash"}:
                return True
            if normalized == "password" and not (
                isinstance(nested, list)
                and all(isinstance(message, str) for message in nested)
            ):
                return True
            if _contains_sensitive_key(nested):
                return True
    elif isinstance(value, list):
        return any(_contains_sensitive_key(item) for item in value)
    return False


def assert_response(testcase, name, response, expected, *, api_json=True):
    content_type = response.headers.get("Content-Type", "")
    testcase.assertEqual(
        response.status,
        expected,
        f"{name}: HTTP {response.status}; content-type={content_type}",
    )
    if api_json and response.status != 204:
        testcase.assertIn("application/json", content_type.lower(), name)
        payload = response.json()
        testcase.assertFalse(_contains_sensitive_key(payload), name)
        for password in PASSWORDS:
            testcase.assertNotIn(password, response.text, name)
        if response.status >= 400:
            lowered = response.text.lower()
            testcase.assertNotIn("traceback", lowered, name)
            testcase.assertNotIn("internal server error", lowered, name)
    print(f"[PASS] {name}: HTTP {response.status}; {content_type or 'sin Content-Type'}")
    return response.json() if api_json and response.body else None


def new_password():
    password = f"E2E-{secrets.token_urlsafe(24)}-Aa9!"
    PASSWORDS.add(password)
    return password


def record_account(alias, *, email, password, role, user_id=None):
    PASSWORDS.add(password)
    account = {
        "email": email,
        "password": password,
        "role": role,
        "user_id": user_id,
    }
    STATE.setdefault("accounts", {})[alias] = account
    return account


def login_account(testcase, alias):
    account = STATE["accounts"][alias]
    response = request(
        "POST",
        "auth/login/",
        data={"email": account["email"], "password": account["password"]},
    )
    payload = assert_response(testcase, f"login/{alias}", response, 200)
    account["access"] = payload["access"]
    account["refresh"] = payload["refresh"]
    return account


def require_state(testcase, *keys):
    if not all(key in STATE for key in keys):
        testcase.skipTest("No se completó el flujo previo necesario para esta prueba.")


def count_notifications(testcase, alias, notification_type):
    account = STATE["accounts"][alias]
    response = request(
        "GET",
        f"notifications/?notification_type={notification_type}",
        token=account["access"],
    )
    payload = assert_response(
        testcase, f"listar-notificaciones/{alias}/{notification_type}", response, 200
    )
    return payload["count"], payload.get("results", [])
