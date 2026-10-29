param staticWebAppName string
param containerAppName string
param location string

resource staticWebApp 'Microsoft.Web/staticSites@2025-05-01' existing = {
  name: staticWebAppName
}

resource containerApp 'Microsoft.App/containerApps@2026-07-01' existing = {
  name: containerAppName
}

resource linkedBackend 'Microsoft.Web/staticSites/linkedBackends@2025-03-01' = {
  parent: staticWebApp
  name: 'api'
  properties: {
    backendResourceId: containerApp.id
    region: location
  }
}
