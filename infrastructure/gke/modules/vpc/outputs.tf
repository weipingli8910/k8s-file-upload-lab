output "vpc_name" {
  description = "Name of the VPC"
  value       = google_compute_network.main.name
}

output "vpc_id" {
  description = "ID of the VPC"
  value       = google_compute_network.main.id
}

output "subnet_name" {
  description = "Name of the subnet"
  value       = google_compute_subnetwork.main.name
}

output "subnet_id" {
  description = "ID of the subnet"
  value       = google_compute_subnetwork.main.id
}

output "subnet_cidr" {
  description = "CIDR block of the subnet"
  value       = google_compute_subnetwork.main.ip_cidr_range
}

