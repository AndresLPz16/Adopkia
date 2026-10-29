param environmentResourceName string
param location string
param workspaceName string
param workspaceCustomerId string
param tags object

resource workspace 'Microsoft.OperationalInsights/workspaces@2026-03-01' existing = {
  name: workspaceName
}

resource environment 'Microsoft.App/managedEnvironments@2026-07-01' = {
  name: environmentResourceName
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: workspaceCustomerId
        sharedKey: workspace.listKeys().primarySharedKey
      }
    }
  }
}

output environmentResourceId string = environment.id
