targetScope = 'subscription'

@minLength(1)
@maxLength(64)
param environmentName string

@minLength(1)
param location string

// Sufijo corto de los nombres de recursos; varios deben ser únicos en Azure.
@minLength(2)
@maxLength(6)
param resourceSuffix string

param deployedBy string
param createdAt string
param deployerObjectId string

@secure()
param mysqlAdministratorLoginPassword string

@secure()
param mysqlApplicationLoginPassword string

@secure()
param djangoSecretKey string

param mysqlAdministratorLogin string = 'adopkiaadmin'
param mysqlApplicationLogin string = 'adopkia_app'
param containerImage string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

// Sin servidor SMTP el registro respondería 503. Con el backend de consola el
// código de verificación queda en los registros del contenedor.
param emailBackend string = 'django.core.mail.backends.console.EmailBackend'

var tags = {
  project: 'adopkia'
  'created-at': createdAt
  environment: environmentName
  'deployed-by': deployedBy
}

var resourceNames = {
  resourceGroup: 'rg-adopkia-prod-${resourceSuffix}'
  containerApp: 'ca-adopkia-prod-${resourceSuffix}'
  containerAppEnvironment: 'cae-adopkia-prod-${resourceSuffix}'
  mysql: 'mysql-adopkia-prod-${resourceSuffix}'
  containerRegistry: 'cradopkiaprod${resourceSuffix}'
  keyVault: 'kv-adopkia-prod-${resourceSuffix}'
  logAnalytics: 'log-adopkia-prod-${resourceSuffix}'
  managedIdentity: 'id-adopkia-prod-${resourceSuffix}'
  mediaStorage: 'stadopkiaprod${resourceSuffix}'
}

resource rg 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: resourceNames.resourceGroup
  location: location
  tags: tags
}

module logAnalytics './modules/log-analytics.bicep' = {
  name: 'log-analytics'
  scope: rg
  params: {
    workspaceName: resourceNames.logAnalytics
    location: location
    tags: tags
  }
}

module keyVault './modules/key-vault.bicep' = {
  name: 'key-vault'
  scope: rg
  params: {
    vaultName: resourceNames.keyVault
    location: location
    djangoSecretKey: djangoSecretKey
    mysqlAdministratorLoginPassword: mysqlAdministratorLoginPassword
    mysqlApplicationLoginPassword: mysqlApplicationLoginPassword
    tags: tags
  }
}

module mysql './modules/mysql-flexible-server.bicep' = {
  name: 'mysql'
  scope: rg
  params: {
    mysqlName: resourceNames.mysql
    location: location
    administratorLogin: mysqlAdministratorLogin
    administratorLoginPassword: mysqlAdministratorLoginPassword
    appDbName: 'adopkia'
    tags: tags
  }
}

module containerRegistry './modules/container-registry.bicep' = {
  name: 'container-registry'
  scope: rg
  params: {
    registryName: resourceNames.containerRegistry
    location: location
    tags: tags
  }
}

module mediaStorage './modules/storage-account.bicep' = {
  name: 'media-storage'
  scope: rg
  params: {
    storageAccountName: resourceNames.mediaStorage
    location: location
    tags: tags
  }
}

module managedIdentity './modules/managed-identity.bicep' = {
  name: 'managed-identity'
  scope: rg
  params: {
    identityName: resourceNames.managedIdentity
    location: location
    tags: tags
  }
}

module containerAppEnvironment './modules/container-app-environment.bicep' = {
  name: 'container-app-environment'
  scope: rg
  params: {
    environmentResourceName: resourceNames.containerAppEnvironment
    location: location
    workspaceName: resourceNames.logAnalytics
    workspaceCustomerId: logAnalytics.outputs.workspaceCustomerId
    tags: tags
  }
}

// La identidad debe poder leer la imagen y los secretos antes de que arranque
// la aplicación; por eso la Container App depende de las asignaciones.
module roleAssignments './modules/role-assignments.bicep' = {
  name: 'role-assignments'
  scope: rg
  dependsOn: [
    keyVault
    containerRegistry
    mediaStorage
  ]
  params: {
    deployerObjectId: deployerObjectId
    appIdentityPrincipalId: managedIdentity.outputs.principalId
    keyVaultName: resourceNames.keyVault
    registryName: resourceNames.containerRegistry
    mediaStorageAccountName: resourceNames.mediaStorage
  }
}

module containerApp './modules/container-app.bicep' = {
  name: 'container-app'
  scope: rg
  dependsOn: [
    roleAssignments
  ]
  params: {
    containerAppName: resourceNames.containerApp
    location: location
    environmentResourceId: containerAppEnvironment.outputs.environmentResourceId
    environmentDefaultDomain: containerAppEnvironment.outputs.defaultDomain
    containerImage: containerImage
    appPort: 8000
    registryLoginServer: containerRegistry.outputs.loginServer
    registryIdentityResourceId: managedIdentity.outputs.identityResourceId
    keyVaultName: resourceNames.keyVault
    keyVaultIdentityResourceId: managedIdentity.outputs.identityResourceId
    mysqlServerFqdn: mysql.outputs.fullyQualifiedDomainName
    mysqlApplicationLogin: mysqlApplicationLogin
    appIdentityClientId: managedIdentity.outputs.clientId
    mediaStorageAccountName: mediaStorage.outputs.storageAccountName
    mediaStorageContainerName: mediaStorage.outputs.containerName
    emailBackend: emailBackend
    tags: tags
  }
}

output resourceGroupName string = rg.name
output containerAppName string = resourceNames.containerApp
output containerAppFqdn string = containerApp.outputs.fqdn
output containerRegistryName string = resourceNames.containerRegistry
output containerRegistryLoginServer string = containerRegistry.outputs.loginServer
output keyVaultName string = resourceNames.keyVault
output mysqlServerName string = resourceNames.mysql
output mysqlServerFqdn string = mysql.outputs.fullyQualifiedDomainName
