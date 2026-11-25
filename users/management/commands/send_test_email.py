import smtplib

from django.conf import settings
from django.core.mail import send_mail
from django.core.management.base import BaseCommand, CommandError
from django.core.validators import validate_email
from django.core.exceptions import ValidationError


class Command(BaseCommand):
    help = "Envía un correo de prueba para comprobar la configuración SMTP."

    def add_arguments(self, parser):
        parser.add_argument("destinatario", help="Correo que recibirá la prueba.")

    def handle(self, *args, destinatario, **options):
        try:
            validate_email(destinatario)
        except ValidationError as error:
            raise CommandError("El destinatario no es un correo válido.") from error

        backend = settings.EMAIL_BACKEND.rsplit(".", 2)[-2]
        self.stdout.write(f"Servidor: {settings.EMAIL_HOST or '(ninguno)'}:{settings.EMAIL_PORT}")
        self.stdout.write(f"Remitente: {settings.DEFAULT_FROM_EMAIL}")
        self.stdout.write(f"Modo: {backend}")
        if backend == "console":
            self.stdout.write(
                self.style.WARNING(
                    "No hay EMAIL_HOST: el correo se imprime aquí y no llega a ningún buzón."
                )
            )

        try:
            send_mail(
                "Prueba de correo de Adopkia",
                "Si lees esto, Adopkia ya puede enviar los códigos de verificación.",
                settings.DEFAULT_FROM_EMAIL,
                [destinatario],
                fail_silently=False,
            )
        except smtplib.SMTPAuthenticationError as error:
            raise CommandError(
                "El servidor rechazó el usuario o la contraseña. Con Gmail usa una "
                "contraseña de aplicación, no la contraseña de la cuenta."
            ) from error
        except (OSError, smtplib.SMTPException) as error:
            raise CommandError(f"No se pudo enviar el correo: {error}") from error

        self.stdout.write(self.style.SUCCESS(f"Correo de prueba enviado a {destinatario}."))
