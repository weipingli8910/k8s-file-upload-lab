terraform {
  required_version = ">= 1.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Enable required APIs
resource "google_project_service" "required_apis" {
  for_each = toset([
    "container.googleapis.com",
    "compute.googleapis.com",
    "storage-api.googleapis.com",
    "artifactregistry.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com"
  ])

  project = var.project_id
  service = each.value

  disable_on_destroy = false
}

# VPC Module
module "vpc" {
  source = "./modules/vpc"

  name        = "${var.cluster_name}-vpc"
  project_id  = var.project_id
  region      = var.region
  subnet_cidr = var.subnet_cidr

  tags = {
    environment = var.environment
    managed-by  = "terraform"
  }
}

# GKE Cluster Module
module "gke" {
  source = "./modules/gke"

  cluster_name    = var.cluster_name
  project_id      = var.project_id
  region          = var.region
  vpc_name        = module.vpc.vpc_name
  subnet_name     = module.vpc.subnet_name

  node_count     = var.node_count
  min_node_count = var.min_node_count
  max_node_count = var.max_node_count
  machine_type   = var.machine_type
  disk_size_gb   = var.disk_size_gb

  environment = var.environment

  depends_on = [
    google_project_service.required_apis,
    module.vpc
  ]
}

# GCS Bucket for file storage
resource "google_storage_bucket" "file_upload" {
  name          = var.gcs_bucket_name
  location      = var.region
  force_destroy = false

  uniform_bucket_level_access {
    enabled = true
  }

  versioning {
    enabled = true
  }

  encryption {
    default_kms_key_name = null
  }

  labels = {
    environment = var.environment
    managed-by  = "terraform"
  }

  depends_on = [google_project_service.required_apis]
}

# Artifact Registry for container images
resource "google_artifact_registry_repository" "file_upload" {
  location      = var.region
  repository_id = "file-upload-service"
  description   = "Docker repository for file upload service"
  format        = "DOCKER"

  depends_on = [google_project_service.required_apis]
}

# IAM Service Account for file upload service
resource "google_service_account" "file_upload" {
  account_id   = "file-upload-service"
  display_name = "File Upload Service Account"
  description  = "Service account for file upload service"
}

# Grant Storage Object Admin role to service account
resource "google_project_iam_member" "file_upload_storage" {
  project = var.project_id
  role    = "roles/storage.objectAdmin"
  member  = "serviceAccount:${google_service_account.file_upload.email}"
}

# Workload Identity binding
resource "google_service_account_iam_member" "workload_identity" {
  service_account_id = google_service_account.file_upload.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[file-upload/file-upload-service]"
}
