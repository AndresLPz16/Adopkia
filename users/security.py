import secrets
import smtplib
from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from django.utils.crypto import salted_hmac
from rest_framework.exceptions import APIException

from .models import EmailVerificationCode, LoginMathChallenge, User


class EmailDeliveryUnavailable(APIException):
    status_code = 503
    default_detail = "No se pudo enviar el correo de verificación. Inténtalo más tarde."
    default_code = "email_delivery_unavailable"


@transaction.atomic
def issue_email_verification_code(user: User) -> None:
    code = f"{secrets.randbelow(1_000_000):06d}"
    EmailVerificationCode.objects.update_or_create(
        user=user,
        defaults={
            "code_hash": salted_hmac(
                f"adopkia.email-verification:user:{user.pk}",
                code,
            ).hexdigest(),
            "expires_at": timezone.now() + timedelta(minutes=10),
            "failed_attempts": 0,
            "sent_at": timezone.now(),
        },
    )
    try:
        sent = send_mail(
            "Verifica tu correo de Adopkia",
            (
                f"Tu código de verificación es: {code}\n\n"
                "Vence en 10 minutos. Si no solicitaste esta cuenta, ignora este mensaje."
            ),
            settings.DEFAULT_FROM_EMAIL,
            [user.email],
            fail_silently=False,
        )
    except (OSError, smtplib.SMTPException) as exc:
        raise EmailDeliveryUnavailable() from exc
    if sent != 1:
        raise EmailDeliveryUnavailable()


def create_login_math_challenge() -> tuple[LoginMathChallenge, str]:
    left = secrets.randbelow(20) + 1
    right = secrets.randbelow(20) + 1
    question = f"{left} + {right} = ?"
    challenge = LoginMathChallenge.objects.create(
        answer_hash="",
        expires_at=timezone.now() + timedelta(minutes=3),
    )
    challenge.answer_hash = salted_hmac(
        f"adopkia.login-math-challenge:challenge:{challenge.pk}",
        str(left + right),
    ).hexdigest()
    challenge.save(update_fields=("answer_hash",))
    return challenge, question


def consume_login_math_challenge(challenge_id: str, answer: str) -> bool:
    from django.db import transaction
    from django.utils.crypto import constant_time_compare

    with transaction.atomic():
        challenge = (
            LoginMathChallenge.objects.select_for_update()
            .filter(pk=challenge_id)
            .first()
        )
        if challenge is None:
            return False
        expected_hash = salted_hmac(
            f"adopkia.login-math-challenge:challenge:{challenge.pk}",
            answer,
        ).hexdigest()
        valid = (
            challenge.expires_at > timezone.now()
            and constant_time_compare(challenge.answer_hash, expected_hash)
        )
        challenge.delete()
        return valid
