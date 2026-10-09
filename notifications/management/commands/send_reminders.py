from datetime import timedelta

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from notifications.models import Notification
from medical.models import Reminder


class Command(BaseCommand):
    help = "Envía notificaciones de recordatorios de cuidado próximos."

    def add_arguments(self, parser):
        parser.add_argument(
            "--days",
            type=int,
            default=7,
            help="Anticipación en días para notificar (por defecto: 7).",
        )
        parser.add_argument(
            "--reminder-id",
            type=int,
            help="Procesa únicamente el recordatorio indicado.",
        )

    def handle(self, *args, **options):
        days = options["days"]
        if days < 0:
            raise CommandError("--days debe ser cero o un número positivo.")
        today = timezone.localdate()
        reminders = Reminder.objects.filter(
            status=Reminder.Status.PENDING,
            scheduled_date__gte=today,
            scheduled_date__lte=today + timedelta(days=days),
        )
        if options["reminder_id"] is not None:
            reminders = reminders.filter(pk=options["reminder_id"])
        reminder_ids = list(reminders.values_list("pk", flat=True))
        sent = 0
        for reminder_id in reminder_ids:
            with transaction.atomic():
                reminder = (
                    Reminder.objects.select_for_update()
                    .select_related("adoption__request__applicant", "adoption__request__pet", "vaccine")
                    .filter(
                        pk=reminder_id,
                        status=Reminder.Status.PENDING,
                    )
                    .first()
                )
                if reminder is None:
                    continue
                adopter = reminder.adoption.request.applicant
                pet = reminder.adoption.request.pet
                label = (
                    reminder.vaccine.name
                    if reminder.vaccine_id
                    else "cuidado de tu mascota"
                )
                Notification.objects.create(
                    user=adopter,
                    reminder=reminder,
                    notification_type=Notification.NotificationType.REMINDER,
                    message=(
                        f"Recordatorio: {label} para {pet.name} "
                        f"el {reminder.scheduled_date:%d/%m/%Y}."
                    ),
                )
                reminder.status = Reminder.Status.NOTIFIED
                reminder.save(update_fields=("status",))
                sent += 1
        self.stdout.write(self.style.SUCCESS(f"Recordatorios enviados: {sent}."))
