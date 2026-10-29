param deployerObjectId string
param appIdentityPrincipalId string
param keyVaultName string
param registryName string

var keyVaultSecretsOfficerRoleId = 'b86a8fe4-44ce-4948-aee5-eccb2c155cd7'
var keyVaultSecretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6'
var acrPullRoleId = '7f951dda-4ed3-4680-a7ca-43fe172d538d'

resource keyVault 'Microsoft.KeyVault/vaults@2026-05-15' existing = {
  name: keyVaultName
}

resource djangoSecret 'Microsoft.KeyVault/vaults/secrets@2026-05-15' existing = {
  parent: keyVault
  name: 'django-secret-key'
}

resource mysqlApplicationPasswordSecret 'Microsoft.KeyVault/vaults/secrets@2026-05-15' existing = {
  parent: keyVault
  name: 'mysql-app-password'
}

resource registry 'Microsoft.ContainerRegistry/registries@2025-11-01' existing = {
  name: registryName
}

resource deployerSecretsOfficer 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, deployerObjectId, keyVaultSecretsOfficerRoleId)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsOfficerRoleId)
    principalId: deployerObjectId
    principalType: 'User'
  }
}

resource appDjangoSecretUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(djangoSecret.id, appIdentityPrincipalId, keyVaultSecretsUserRoleId)
  scope: djangoSecret
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleId)
    principalId: appIdentityPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource appMysqlPasswordUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(mysqlApplicationPasswordSecret.id, appIdentityPrincipalId, keyVaultSecretsUserRoleId)
  scope: mysqlApplicationPasswordSecret
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleId)
    principalId: appIdentityPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource appAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registry.id, appIdentityPrincipalId, acrPullRoleId)
  scope: registry
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleId)
    principalId: appIdentityPrincipalId
    principalType: 'ServicePrincipal'
  }
}
