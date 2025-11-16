resource "google_compute_network" "main" {
  name                    = var.name
  auto_create_subnetworks = false

  project = var.project_id

  tags = var.tags
}

resource "google_compute_subnetwork" "main" {
  name          = "${var.name}-subnet"
  ip_cidr_range = var.subnet_cidr
  region        = var.region
  network       = google_compute_network.main.id
  project       = var.project_id

  # Enable private Google access for nodes
  private_ip_google_access = true

  tags = var.tags
}

# Firewall rule for internal communication
resource "google_compute_firewall" "internal" {
  name    = "${var.name}-internal"
  network = google_compute_network.main.name
  project = var.project_id

  allow {
    protocol = "icmp"
  }

  allow {
    protocol = "tcp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "udp"
    ports    = ["0-65535"]
  }

  source_ranges = [var.subnet_cidr]

  tags = var.tags
}

# Firewall rule for SSH (optional, for debugging)
resource "google_compute_firewall" "ssh" {
  name    = "${var.name}-ssh"
  network = google_compute_network.main.name
  project = var.project_id

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags    = ["gke-node"]

  tags = var.tags
}

