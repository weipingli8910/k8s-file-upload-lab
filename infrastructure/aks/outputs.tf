output "cluster_name" {
  description = "AKS cluster name"
  value       = module.aks.cluster_name
}

output "cluster_fqdn" {
  description = "AKS cluster FQDN"
  value       = module.aks.cluster_fqdn
}

output "resource_group_name" {
  description = "Resource group name"
  value       = azurerm_resource_group.main.name
}

output "storage_account_name" {
  description = "Storage account name"
  value       = azurerm_storage_account.file_upload.name
}

output "storage_container_name" {
  description = "Storage container name"
  value       = azurerm_storage_container.file_upload.name
}

output "container_registry_url" {
  description = "Container Registry URL"
  value       = azurerm_container_registry.file_upload.login_server
}

output "managed_identity_client_id" {
  description = "Managed Identity client ID"
  value       = azurerm_user_assigned_identity.file_upload.client_id
}

output "managed_identity_principal_id" {
  description = "Managed Identity principal ID"
  value       = azurerm_user_assigned_identity.file_upload.principal_id
}

output "configure_kubectl" {
  description = "Command to configure kubectl"
  value       = "az aks get-credentials --resource-group ${azurerm_resource_group.main.name} --name ${module.aks.cluster_name}"
}

