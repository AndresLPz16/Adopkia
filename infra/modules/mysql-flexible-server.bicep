param mysqlName string
param location string
param tags object
param administratorLogin string
@secure()
param administratorLoginPassword string
param appDbName string

resource mysql 'Microsoft.DBforMySQL/flexibleServers@2025-12-30' = {
  name: mysqlName
  location: location
  tags: tags
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    version: '8.0.21'
    administratorLogin: administratorLogin
    administratorLoginPassword: administratorLoginPassword
    storage: {
      storageSizeGB: 32
    }
    publicNetworkAccess: 'Enabled'
  }
}

resource mysqlFirewall 'Microsoft.DBforMySQL/flexibleServers/firewallRules@2025-12-30' = {
  parent: mysql
  name: 'AllowAllAzureServicesAndResourcesWithinAzureIps'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

resource mysqlTls 'Microsoft.DBforMySQL/flexibleServers/configurations@2025-12-30' = {
  parent: mysql
  name: 'require_secure_transport'
  properties: {
    value: 'ON'
    source: 'user-override'
  }
}

resource mysqlDatabase 'Microsoft.DBforMySQL/flexibleServers/databases@2025-12-30' = {
  parent: mysql
  name: appDbName
}

output fullyQualifiedDomainName string = mysql.properties.fullyQualifiedDomainName
