import smtplib
from io import StringIO
from unittest import mock

from django.core import mail
from django.core.management import CommandError, call_command
from django.test import SimpleTestCase, override_settings


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    DEFAULT_FROM_EMAIL="Adopkia <proyecto@gmail.com>",
)
class SendTestEmailCommandTests(SimpleTestCase):
    def test_sends_a_test_message_to_the_given_address(self):
        output = StringIO()

        call_command("send_test_email", "persona@example.com", stdout=output)

        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["persona@example.com"])
        self.assertEqual(mail.outbox[0].from_email, "Adopkia <proyecto@gmail.com>")
        self.assertIn("Correo de prueba enviado", output.getvalue())

    def test_rejects_an_invalid_address(self):
        with self.assertRaisesMessage(CommandError, "no es un correo válido"):
            call_command("send_test_email", "no-es-correo", stdout=StringIO())

    def test_explains_a_rejected_gmail_password(self):
        failure = smtplib.SMTPAuthenticationError(535, b"Username and Password not accepted")
        with mock.patch(
            "users.management.commands.send_test_email.send_mail", side_effect=failure
        ):
            with self.assertRaisesMessage(CommandError, "contraseña de aplicación"):
                call_command("send_test_email", "persona@example.com", stdout=StringIO())
