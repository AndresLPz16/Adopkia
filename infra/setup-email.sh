#!/usr/bin/env bash
# Activa el envío real de correos (códigos de verificación) en Azure con Gmail.
#
# Antes de usarlo, en la cuenta de Gmail del proyecto:
#   1. Activa la verificación en dos pasos (myaccount.google.com/security).
#   2. Crea una "contraseña de aplicación" (myaccount.google.com/apppasswords).
#
# Uso: bash infra/setup-email.sh <id-de-suscripción> <cuenta@gmail.com>
# El script pide la contraseña de aplicación sin mostrarla; no queda en el
# historial de la terminal ni en el repositorio. Requiere az con sesión iniciada.
#
# Importante: si más adelante se vuelve a desplegar la infraestructura con
# main.bicep, pasa emailHost, emailHostUser y emailHostPassword, o el correo
# vuelve al modo de consola.
set -euo pipefail

SUBSCRIPTION="${1:?Indica el id de la suscripción de Azure}"
GMAIL_ACCOUNT="${2:?Indica la cuenta de Gmail que enviará los correos}"
RESOURCE_GROUP="rg-adopkia-prod-spc"
CONTAINER_APP="ca-adopkia-prod-spc"

read -r -s -p "Contraseña de aplicación de $GMAIL_ACCOUNT: " APP_PASSWORD
echo
APP_PASSWORD="${APP_PASSWORD// /}"
if [ "${#APP_PASSWORD}" -ne 16 ]; then
  echo "La contraseña de aplicación de Google tiene 16 letras; revisa que la copiaste completa." >&2
  exit 1
fi

# La contraseña se guarda como secreto de la aplicación, nunca como variable visible.
az containerapp secret set --subscription "$SUBSCRIPTION" \
  --resource-group "$RESOURCE_GROUP" --name "$CONTAINER_APP" \
  --secrets "email-host-password=$APP_PASSWORD" --output none
unset APP_PASSWORD

az containerapp update --subscription "$SUBSCRIPTION" \
  --resource-group "$RESOURCE_GROUP" --name "$CONTAINER_APP" \
  --set-env-vars \
    "EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend" \
    "EMAIL_HOST=smtp.gmail.com" \
    "EMAIL_PORT=587" \
    "EMAIL_USE_TLS=true" \
    "EMAIL_HOST_USER=$GMAIL_ACCOUNT" \
    "DEFAULT_FROM_EMAIL=Adopkia <$GMAIL_ACCOUNT>" \
    "EMAIL_HOST_PASSWORD=secretref:email-host-password" \
  --output none

echo "Listo. Adopkia enviará los correos desde $GMAIL_ACCOUNT."
echo "Para probarlo, registra una cuenta nueva en el sitio y revisa la bandeja de entrada (y spam)."
