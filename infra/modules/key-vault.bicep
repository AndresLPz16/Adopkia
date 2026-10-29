param vaultName string
param location string
param tags object
@secure()
param djangoSecretKey string
@secure()
param mysqlAdministratorLoginPassword string
@secure()
param mysqlApplicationLoginPassword string

resource vault 'Microsoft.KeyVault/vaults@2026-05-15' = {
  name: vaultName
  location: location
  tags: tags
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
  }
}

resource djangoSecret 'Microsoft.KeyVault/vaults/secrets@2026-05-15' = {
  parent: vault
  name: 'django-secret-key'
  properties: {
    value: djangoSecretKey
  }
}

resource mysqlPasswordSecret 'Microsoft.KeyVault/vaults/secrets@2026-05-15' = {
  parent: vault
  name: 'mysql-admin-password'
  properties: {
    value: mysqlAdministratorLoginPassword
  }
}

resource mysqlApplicationPasswordSecret 'Microsoft.KeyVault/vaults/secrets@2026-05-15' = {
  parent: vault
  name: 'mysql-app-password'
  properties: {
    value: mysqlApplicationLoginPassword
  }
}

output vaultId string = vault.id
output vaultUri string = vault.properties.vaultUri
