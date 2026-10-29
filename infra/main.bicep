targetScope = 'subscription'

@minLength(1)
@maxLength(64)
param environmentName string

@minLength(1)
param location string

param sessionId string
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
param djangoAllowedHosts string = 'localhost'

var tags = {
  'app-onboard-skill': 'true'
  'app-onboard-session-id': sessionId
  'created-at': createdAt
  environment: environmentName
  'deployed-by': deployedBy
}

var resourceNames = {
  resourceGroup: 'rg-adopkia-prod-0b3d'
  staticWebApp: 'swa-adopkia-prod-0b3d'
  containerApp: 'ca-adopkia-prod-0b3d'
  mysql: 'mysql-adopkia-prod-0b3d'
  containerRegistry: 'cradopkiaprod0b3d'
  keyVault: 'kv-adopkia-prod-0b3d'
  logAnalytics: 'log-adopkia-prod-0b3d'
  appInsights: 'appi-adopkia-prod-0b3d'
  managedIdentity: 'id-adopkia-prod-0b3d'
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

module appInsights './modules/app-insights.bicep' = {
  name: 'app-insights'
  scope: rg
  params: {
    componentName: resourceNames.appInsights
    location: location
    workspaceResourceId: logAnalytics.outputs.workspaceId
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
    environmentResourceName: 'cae-adopkia-prod-0b3d'
    location: location
    workspaceName: resourceNames.logAnalytics
    workspaceCustomerId: logAnalytics.outputs.workspaceCustomerId
    tags: tags
  }
}

module staticWebApp './modules/static-web-app.bicep' = {
  name: 'static-web-app'
  scope: rg
  params: {
    staticWebAppName: resourceNames.staticWebApp
    location: location
    tags: tags
  }
}

module containerApp './modules/container-app.bicep' = {
  name: 'container-app'
  scope: rg
  params: {
    containerAppName: resourceNames.containerApp
    location: location
    environmentResourceId: containerAppEnvironment.outputs.environmentResourceId
    containerImage: containerImage
    appPort: 8000
    registryLoginServer: containerRegistry.outputs.loginServer
    registryIdentityResourceId: managedIdentity.outputs.identityResourceId
    keyVaultName: resourceNames.keyVault
    keyVaultIdentityResourceId: managedIdentity.outputs.identityResourceId
    mysqlServerFqdn: mysql.outputs.fullyQualifiedDomainName
    mysqlApplicationLogin: mysqlApplicationLogin
    djangoAllowedHosts: djangoAllowedHosts
    corsAllowedOrigins: 'https://${staticWebApp.outputs.defaultHostname}'
    appInsightsConnectionString: appInsights.outputs.connectionString
    tags: tags
  }
}

module staticWebAppBackend './modules/static-web-app-backend.bicep' = {
  name: 'static-web-app-backend'
  scope: rg
  dependsOn: [
    staticWebApp
    containerApp
  ]
  params: {
    staticWebAppName: resourceNames.staticWebApp
    containerAppName: resourceNames.containerApp
    location: location
  }
}

module roleAssignments './modules/role-assignments.bicep' = {
  name: 'role-assignments'
  scope: rg
  dependsOn: [
    keyVault
    containerRegistry
  ]
  params: {
    deployerObjectId: deployerObjectId
    appIdentityPrincipalId: managedIdentity.outputs.principalId
    keyVaultName: resourceNames.keyVault
    registryName: resourceNames.containerRegistry
  }
}

output resourceGroupName string = rg.name
output staticWebAppDefaultHostname string = staticWebApp.outputs.defaultHostname
output containerAppFqdn string = containerApp.outputs.fqdn
output mysqlServerFqdn string = mysql.outputs.fullyQualifiedDomainName
