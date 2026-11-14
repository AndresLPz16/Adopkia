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
    // La oferta gratuita cubre B1ms con 32 GB de datos y 32 GB de copias:
    // sin crecimiento automático ni copias georredundantes para no excederla.
    storage: {
      storageSizeGB: 32
      autoGrow: 'Disabled'
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
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

// Las migraciones crean funciones y triggers con un usuario sin SUPER; con el
// registro binario activo MySQL lo rechaza (error 1419) salvo con este ajuste.
resource mysqlTrustFunctionCreators 'Microsoft.DBforMySQL/flexibleServers/configurations@2025-12-30' = {
  parent: mysql
  name: 'log_bin_trust_function_creators'
  dependsOn: [
    mysqlTls
  ]
  properties: {
    value: 'ON'
    source: 'user-override'
  }
}

resource mysqlDatabase'Microsoft.DBforMySQL/flexibleServers/databases@2025-12-30' = {
  parent: mysql
  name: appDbName
}

output fullyQualifiedDomainName string = mysql.properties.fullyQualifiedDomainName
