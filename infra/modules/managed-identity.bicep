param identityName string
param location string
param tags object

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2024-11-30' = {
  name: identityName
  location: location
  tags: tags
}

output identityResourceId string = identity.id
output principalId string = identity.properties.principalId
