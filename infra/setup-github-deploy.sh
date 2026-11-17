#!/usr/bin/env bash
# Prepara el despliegue automático desde GitHub Actions (se ejecuta una vez).
#
# Crea una identidad administrada que GitHub puede usar SOLO desde la rama main
# de este repositorio (credencial federada OIDC, sin contraseñas), le da los
# permisos mínimos y guarda sus identificadores como variables del repositorio.
#
# Uso: bash infra/setup-github-deploy.sh <id-de-suscripción>
# Requiere: az (con sesión iniciada y rol Owner) y gh (con acceso al repositorio).
set -euo pipefail

SUBSCRIPTION="${1:?Indica el id de la suscripción de Azure}"
REPO="AndresLPz16/Adopkia"
RESOURCE_GROUP="rg-adopkia-prod-spc"
LOCATION="spaincentral"
IDENTITY="id-adopkia-github-spc"
REGISTRY="cradopkiaprodspc"
CONTAINER_APP="ca-adopkia-prod-spc"
ENVIRONMENT="cae-adopkia-prod-spc"

az identity create --subscription "$SUBSCRIPTION" --resource-group "$RESOURCE_GROUP" \
  --name "$IDENTITY" --location "$LOCATION" --tags purpose=github-actions-deploy --output none
CLIENT_ID=$(az identity show --subscription "$SUBSCRIPTION" --resource-group "$RESOURCE_GROUP" --name "$IDENTITY" --query clientId --output tsv)
PRINCIPAL_ID=$(az identity show --subscription "$SUBSCRIPTION" --resource-group "$RESOURCE_GROUP" --name "$IDENTITY" --query principalId --output tsv)
TENANT_ID=$(az account show --subscription "$SUBSCRIPTION" --query tenantId --output tsv)

# Solo los flujos que corren sobre main pueden obtener un token.
az identity federated-credential create --subscription "$SUBSCRIPTION" --resource-group "$RESOURCE_GROUP" \
  --identity-name "$IDENTITY" --name github-main \
  --issuer https://token.actions.githubusercontent.com \
  --subject "repo:$REPO:ref:refs/heads/main" \
  --audiences api://AzureADTokenExchange --output none

assign() {  # rol, recurso; reintenta mientras la identidad se propaga
  for attempt in 1 2 3 4 5 6; do
    if az role assignment create --subscription "$SUBSCRIPTION" --assignee-object-id "$PRINCIPAL_ID" \
      --assignee-principal-type ServicePrincipal --role "$1" --scope "$2" --output none 2>/dev/null; then
      echo "  $1 -> ${2##*/}"
      return 0
    fi
    sleep 10
  done
  echo "No se pudo asignar $1 sobre $2" >&2
  return 1
}

echo "Permisos:"
assign AcrPush "$(az acr show --subscription "$SUBSCRIPTION" --name "$REGISTRY" --query id --output tsv)"
assign Contributor "$(az containerapp show --subscription "$SUBSCRIPTION" --resource-group "$RESOURCE_GROUP" --name "$CONTAINER_APP" --query id --output tsv)"
assign Reader "$(az containerapp env show --subscription "$SUBSCRIPTION" --resource-group "$RESOURCE_GROUP" --name "$ENVIRONMENT" --query id --output tsv)"

# Son identificadores, no credenciales: sin la credencial federada no sirven.
gh variable set AZURE_CLIENT_ID --repo "$REPO" --body "$CLIENT_ID"
gh variable set AZURE_TENANT_ID --repo "$REPO" --body "$TENANT_ID"
gh variable set AZURE_SUBSCRIPTION_ID --repo "$REPO" --body "$SUBSCRIPTION"

echo "Listo: el próximo cambio que llegue a main se desplegará solo."
