terraform {
  required_version = ">= 1.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

provider "azurerm" {
  features {}
}

# VNet Module
module "vnet" {
  source = "./modules/vnet"

  name                = "${var.cluster_name}-vnet"
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name
  address_space       = var.address_space
  subnet_cidr         = var.subnet_cidr

  tags = {
    environment = var.environment
    managed-by  = "terraform"
  }
}

# Resource Group
resource "azurerm_resource_group" "main" {
  name     = "${var.cluster_name}-rg"
  location = var.location

  tags = {
    environment = var.environment
    managed-by  = "terraform"
  }
}

# AKS Cluster Module
module "aks" {
  source = "./modules/aks"

  cluster_name       = var.cluster_name
  location           = var.location
  resource_group_name = azurerm_resource_group.main.name
  vnet_subnet_id     = module.vnet.subnet_id
  node_count         = var.node_count
  min_node_count     = var.min_node_count
  max_node_count     = var.max_node_count
  vm_size            = var.vm_size

  environment = var.environment

  depends_on = [
    azurerm_resource_group.main,
    module.vnet
  ]
}

# Storage Account for file uploads
resource "azurerm_storage_account" "file_upload" {
  name                     = replace("${var.cluster_name}storage", "-", "")
  resource_group_name      = azurerm_resource_group.main.name
  location                 = var.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  min_tls_version          = "TLS1_2"

  blob_properties {
    versioning_enabled = true
  }

  tags = {
    environment = var.environment
    managed-by  = "terraform"
  }
}

# Storage Container
resource "azurerm_storage_container" "file_upload" {
  name                  = "file-upload"
  storage_account_name  = azurerm_storage_account.file_upload.name
  container_access_type = "private"
}

# Container Registry for container images
resource "azurerm_container_registry" "file_upload" {
  name                = replace("${var.cluster_name}acr", "-", "")
  resource_group_name = azurerm_resource_group.main.name
  location            = var.location
  sku                 = "Basic"
  admin_enabled       = true

  tags = {
    environment = var.environment
    managed-by  = "terraform"
  }
}

# Managed Identity for file upload service
resource "azurerm_user_assigned_identity" "file_upload" {
  name                = "${var.cluster_name}-file-upload-identity"
  resource_group_name = azurerm_resource_group.main.name
  location            = var.location

  tags = {
    environment = var.environment
    managed-by  = "terraform"
  }
}

# Role assignment for Storage Blob Data Contributor
resource "azurerm_role_assignment" "file_upload_storage" {
  scope                = azurerm_storage_account.file_upload.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azurerm_user_assigned_identity.file_upload.principal_id
}

