param containerAppName string
param location string
param environmentResourceId string
param environmentDefaultDomain string
param containerImage string
param appPort int
param registryLoginServer string
param registryIdentityResourceId string
// El entorno express de Container Apps no admite referencias a Key Vault:
// los secretos se pasan como secretos propios de la aplicación.
@secure()
param djangoSecretKey string
@secure()
param mysqlApplicationLoginPassword string
param mysqlServerFqdn string
param mysqlApplicationLogin string
param appIdentityClientId string
param mediaStorageAccountName string
param mediaStorageContainerName string
param emailBackend string
param tags object

var placeholderImage = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
var isPlaceholder = containerImage == placeholderImage
var effectivePort = isPlaceholder ? 80 : appPort

// El portal y la API se sirven desde este mismo host, así que no hace falta
// CORS: basta con permitir el nombre público de la aplicación.
var publicHost = '${containerAppName}.${environmentDefaultDomain}'

// Las sondas llegan por la IP interna del contenedor; se envía la cabecera
// Host pública para que Django no las rechace por ALLOWED_HOSTS.
var probeHttpGet = {
  path: '/api/v1/'
  port: appPort
  scheme: 'HTTP'
  httpHeaders: [
    {
      name: 'Host'
      value: publicHost
    }
  ]
}

resource containerApp 'Microsoft.App/containerApps@2026-07-01' = {
  name: containerAppName
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${registryIdentityResourceId}': {}
    }
  }
  properties: {
    managedEnvironmentId: environmentResourceId
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: effectivePort
        allowInsecure: false
        transport: 'http'
      }
      registries: isPlaceholder
        ? []
        : [
            {
              server: registryLoginServer
              identity: registryIdentityResourceId
            }
          ]
      secrets: isPlaceholder
        ? []
        : [
            {
              name: 'django-secret-key'
              value: djangoSecretKey
            }
            {
              name: 'mysql-app-password'
              value: mysqlApplicationLoginPassword
            }
          ]
    }
    template: {
      // Se apaga sin tráfico y nunca pasa de una réplica, para mantenerse
      // dentro de la cuota gratuita mensual del plan de consumo.
      scale: {
        minReplicas: 0
        maxReplicas: 1
      }
      containers: [
        {
          name: 'adopkia-api'
          image: containerImage
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: concat(
            [
              {
                name: 'PORT'
                value: string(effectivePort)
              }
              {
                name: 'DJANGO_DEBUG'
                value: 'false'
              }
              {
                name: 'DJANGO_ALLOWED_HOSTS'
                value: publicHost
              }
              {
                name: 'DJANGO_CORS_ALLOWED_ORIGINS'
                value: 'https://${publicHost}'
              }
              {
                name: 'DJANGO_CSRF_TRUSTED_ORIGINS'
                value: 'https://${publicHost}'
              }
              {
                name: 'DB_ENGINE'
                value: 'mysql'
              }
              {
                name: 'DB_NAME'
                value: 'adopkia'
              }
              {
                name: 'DB_USER'
                value: mysqlApplicationLogin
              }
              {
                name: 'DB_HOST'
                value: mysqlServerFqdn
              }
              {
                name: 'DB_PORT'
                value: '3306'
              }
              {
                name: 'DB_SSL_MODE'
                value: 'verify_identity'
              }
              {
                name: 'AZURE_CLIENT_ID'
                value: appIdentityClientId
              }
              {
                name: 'AZURE_STORAGE_ACCOUNT_NAME'
                value: mediaStorageAccountName
              }
              {
                name: 'AZURE_STORAGE_CONTAINER'
                value: mediaStorageContainerName
              }
              {
                name: 'DJANGO_NUM_PROXIES'
                value: '1'
              }
              {
                name: 'EMAIL_BACKEND'
                value: emailBackend
              }
              {
                name: 'WEB_CONCURRENCY'
                value: '2'
              }
            ],
            isPlaceholder
              ? []
              : [
                  {
                    name: 'DJANGO_SECRET_KEY'
                    secretRef: 'django-secret-key'
                  }
                  {
                    name: 'DB_PASSWORD'
                    secretRef: 'mysql-app-password'
                  }
                ]
          )
          probes: isPlaceholder
            ? []
            : [
                {
                  // Las migraciones corren antes de Gunicorn: hasta 5 minutos.
                  type: 'Startup'
                  httpGet: probeHttpGet
                  periodSeconds: 10
                  failureThreshold: 30
                }
                {
                  type: 'Readiness'
                  httpGet: probeHttpGet
                  periodSeconds: 10
                  failureThreshold: 3
                }
                {
                  type: 'Liveness'
                  httpGet: probeHttpGet
                  periodSeconds: 30
                  failureThreshold: 3
                }
              ]
        }
      ]
    }
  }
}

output fqdn string = containerApp.properties.configuration.ingress.fqdn
