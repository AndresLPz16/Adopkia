from django.contrib import admin
from myproject.admin import ReadOnlyModelAdmin

from .models import Notification


@admin.register(Notification)
class NotificationAdmin(ReadOnlyModelAdmin):
    list_display = ("user", "notification_type", "sent_at", "is_read")
    list_filter = ("notification_type", "is_read", "sent_at")
    search_fields = ("user__email", "message")
