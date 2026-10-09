from django.contrib import admin

from myproject.admin import ReadOnlyModelAdmin

from .models import Conversation, Message


admin.site.register((Conversation, Message), ReadOnlyModelAdmin)
