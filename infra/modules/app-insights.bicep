param componentName string
param location string
param workspaceResourceId string
param tags object

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: componentName
  location: location
  kind: 'web'
  tags: tags
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: workspaceResourceId
  }
}

output connectionString string = appInsights.properties.ConnectionString
