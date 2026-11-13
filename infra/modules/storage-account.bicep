param storageAccountName string
param location string
param tags object
param containerName string = 'media'

// Las fotos de mascotas son contenido público del catálogo: el contenedor
// permite lectura anónima de blobs, pero no listar su contenido. La escritura
// queda reservada a la identidad administrada de la aplicación (sin claves).
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  tags: tags
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: true
    allowSharedKeyAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storageAccount
  name: 'default'
}

resource mediaContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: containerName
  properties: {
    publicAccess: 'Blob'
  }
}

output storageAccountName string = storageAccount.name
output containerName string = mediaContainer.name
