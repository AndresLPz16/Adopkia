from django.apps import apps
from django.core.exceptions import FieldDoesNotExist
from django.utils.translation import gettext_lazy as _


MODEL_LABELS = {
    "users.Role": ("Rol", "Roles", {"id": "Identificador", "name": "Nombre", "description": "Descripción"}),
    "users.User": ("Usuario", "Usuarios", {
        "id": "Identificador", "password": "Contraseña", "role": "Rol", "name": "Nombre",
        "username": "Nombre de usuario", "email": "Correo electrónico",
        "email_verified": "Correo verificado", "phone": "Teléfono", "active": "Activo",
        "registered_at": "Fecha de registro",
    }),
    "shelters.Shelter": ("Refugio", "Refugios", {
        "id": "Identificador", "name": "Nombre", "address": "Dirección", "city": "Ciudad",
        "contact_phone": "Teléfono de contacto", "contact_email": "Correo de contacto",
        "verification_status": "Estado de verificación", "verification_date": "Fecha de verificación",
        "verified_by": "Verificado por", "registered_at": "Fecha de registro",
    }),
    "shelters.ShelterMember": ("Integrante de refugio", "Integrantes de refugio", {
        "id": "Identificador", "shelter": "Refugio", "user": "Usuario", "position": "Cargo",
    }),
    "pets.Species": ("Especie", "Especies", {"id": "Identificador", "name": "Nombre"}),
    "pets.Breed": ("Raza", "Razas", {
        "id": "Identificador", "species": "Especie", "name": "Nombre",
    }),
    "pets.Pet": ("Mascota", "Mascotas", {
        "id": "Identificador", "shelter": "Refugio", "breed": "Raza", "name": "Nombre",
        "approximate_birth_date": "Fecha de nacimiento aproximada", "size": "Tamaño",
        "health": "Salud", "temperament": "Temperamento", "status": "Estado",
        "published_at": "Fecha de publicación",
    }),
    "pets.PetPhoto": ("Foto de mascota", "Fotos de mascotas", {
        "id": "Identificador", "pet": "Mascota", "url": "URL", "is_primary": "Principal",
        "uploaded_at": "Fecha de carga",
    }),
    "adoptions.FormQuestion": ("Pregunta del formulario", "Preguntas del formulario", {
        "id": "Identificador", "prompt": "Enunciado", "answer_type": "Tipo de respuesta",
        "required": "Obligatoria", "order": "Orden", "active": "Activa",
    }),
    "adoptions.AdoptionRequest": ("Solicitud de adopción", "Solicitudes de adopción", {
        "id": "Identificador", "applicant": "Adoptante", "pet": "Mascota",
        "requested_at": "Fecha de solicitud", "status": "Estado",
        "responded_at": "Fecha de respuesta", "shelter_notes": "Observaciones del refugio",
        "pending_unique": "Solicitud pendiente única",
    }),
    "adoptions.FormAnswer": ("Respuesta del formulario", "Respuestas del formulario", {
        "request": "Solicitud", "question": "Pregunta", "value": "Respuesta",
    }),
    "adoptions.Adoption": ("Adopción", "Adopciones", {
        "id": "Identificador", "request": "Solicitud", "adoption_date": "Fecha de adopción",
        "status": "Estado", "return_date": "Fecha de devolución", "return_reason": "Motivo de devolución",
    }),
    "adoptions.FollowUp": ("Seguimiento", "Seguimientos", {
        "id": "Identificador", "adoption": "Adopción", "registered_by": "Registrado por",
        "date": "Fecha", "wellbeing": "Bienestar", "observations": "Observaciones",
    }),
    "medical.Veterinarian": ("Veterinario", "Veterinarios", {
        "id": "Identificador", "user": "Usuario", "professional_card": "Tarjeta profesional",
        "clinic": "Clínica", "specialty": "Especialidad",
    }),
    "medical.Vaccine": ("Vacuna", "Vacunas", {
        "id": "Identificador", "species": "Especie", "name": "Nombre",
        "description": "Descripción", "booster_interval_days": "Intervalo de refuerzo (días)",
    }),
    "medical.MedicalRecord": ("Historial médico", "Historiales médicos", {
        "id": "Identificador", "pet": "Mascota", "veterinarian": "Veterinario",
        "vaccine": "Vacuna", "date": "Fecha", "record_type": "Tipo de registro",
        "description": "Descripción",
    }),
    "medical.Reminder": ("Recordatorio", "Recordatorios", {
        "id": "Identificador", "adoption": "Adopción", "vaccine": "Vacuna",
        "medical_record": "Historial médico", "reminder_type": "Tipo de recordatorio",
        "scheduled_date": "Fecha programada", "status": "Estado",
    }),
    "messaging.Conversation": ("Conversación", "Conversaciones", {
        "id": "Identificador", "adopter": "Adoptante", "shelter": "Refugio",
        "pet": "Mascota", "started_at": "Fecha de inicio",
    }),
    "messaging.Message": ("Mensaje", "Mensajes", {
        "id": "Identificador", "conversation": "Conversación", "sender": "Remitente",
        "content": "Contenido", "sent_at": "Fecha de envío", "is_read": "Leído",
    }),
    "notifications.Notification": ("Notificación", "Notificaciones", {
        "id": "Identificador", "user": "Usuario", "request": "Solicitud",
        "reminder": "Recordatorio", "notification_type": "Tipo de notificación",
        "message": "Mensaje", "sent_at": "Fecha de envío", "is_read": "Leída",
    }),
}


def apply_localized_model_labels():
    for model in apps.get_models():
        labels = MODEL_LABELS.get(model._meta.label)
        if labels is None:
            continue
        singular, plural, field_labels = labels
        model._meta.verbose_name = _(singular)
        model._meta.verbose_name_plural = _(plural)
        for field_name, label in field_labels.items():
            try:
                field = model._meta.get_field(field_name)
            except FieldDoesNotExist:
                continue
            field.verbose_name = _(label)
            if field.choices:
                field.choices = [(value, _(str(choice_label))) for value, choice_label in field.choices]
