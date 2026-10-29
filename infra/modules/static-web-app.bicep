param staticWebAppName string
param location string
param tags object

resource staticWebApp 'Microsoft.Web/staticSites@2025-05-01' = {
  name: staticWebAppName
  location: location
  tags: tags
  sku: {
    name: 'Standard'
    tier: 'Standard'
  }
  properties: {}
}

output defaultHostname string = staticWebApp.properties.defaultHostname
