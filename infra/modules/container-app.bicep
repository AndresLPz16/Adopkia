param containerAppName string
param location string
param environmentResourceId string
param containerImage string
param appPort int
param registryLoginServer string
param registryIdentityResourceId string
param keyVaultName string
param keyVaultIdentityResourceId string
param mysqlServerFqdn string
param mysqlApplicationLogin string
param djangoAllowedHosts string
param corsAllowedOrigins string
param appInsightsConnectionString string
param tags object

var placeholderImage = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
var isPlaceholder = containerImage == placeholderImage
var effectivePort = isPlaceholder ? 80 : appPort

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
        transport: 'auto'
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
              #disable-next-line no-hardcoded-env-urls
              keyVaultUrl: 'https://${keyVaultName}.vault.azure.net/secrets/django-secret-key'
              identity: keyVaultIdentityResourceId
            }
            {
              name: 'mysql-app-password'
              #disable-next-line no-hardcoded-env-urls
              keyVaultUrl: 'https://${keyVaultName}.vault.azure.net/secrets/mysql-app-password'
              identity: keyVaultIdentityResourceId
            }
          ]
    }
    template: {
      scale: {
        minReplicas: 0
        maxReplicas: 1
      }
      containers: [
        {
          name: 'adopkia-api'
          image: containerImage
          resources: {
            cpu: 1
            memory: '2Gi'
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
                value: djangoAllowedHosts
              }
              {
                name: 'DJANGO_CORS_ALLOWED_ORIGINS'
                value: corsAllowedOrigins
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
                name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
                value: appInsightsConnectionString
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
                  type: 'Startup'
                  httpGet: {
                    path: '/'
                    port: appPort
                    scheme: 'HTTP'
                  }
                  periodSeconds: 10
                  failureThreshold: 30
                }
                {
                  type: 'Readiness'
                  httpGet: {
                    path: '/'
                    port: appPort
                    scheme: 'HTTP'
                  }
                  periodSeconds: 10
                  failureThreshold: 3
                }
                {
                  type: 'Liveness'
                  httpGet: {
                    path: '/'
                    port: appPort
                    scheme: 'HTTP'
                  }
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
