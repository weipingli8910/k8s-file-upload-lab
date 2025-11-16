# Multi-Cloud File Upload Service Lab

Complete lab setup for deploying a file upload service on **AWS (EKS)**, **GCP (GKE)**, and **Azure (AKS)** with full observability, monitoring, and CI/CD pipeline.

**Supports all three major cloud providers!** See [MULTI_CLOUD.md](./MULTI_CLOUD.md)

## Lab Overview - ch

This lab demonstrates:
- **EKS** cluster deployment (AWS)
- **GKE** cluster deployment (Google Cloud)
- **AKS** cluster deployment (Azure)
- File upload service with web UI
- Load Balancer integration (ALB/GCP LB/Azure LB)
- Monitoring with Prometheus, Grafana, and SLx
- Logging with Fluent Bit and cloud-native logging
- Complete CI/CD pipeline (GitHub Actions, Jenkins, ArgoCD)
- Artifact promotion and security scanning

## Prerequisites

### For EKS (AWS)
1. **AWS Account** with appropriate permissions
2. **AWS CLI** installed and configured (`aws configure`)
3. **kubectl** installed
4. **Terraform** installed
5. **Docker** installed and running

### For GKE (Google Cloud)
1. **GCP Account** with billing enabled
2. **gcloud CLI** installed and configured (`gcloud init`)
3. **kubectl** installed
4. **Terraform** installed
5. **Docker** installed and running

## Quick Start

### EKS Deployment with Helm (Recommended)

```bash
# 1. Deploy infrastructure
cd infrastructure/terraform
terraform init
terraform apply -var="s3_bucket_name=your-unique-bucket-name"
aws eks update-kubeconfig --name file-upload-cluster --region us-east-1

# 2. Install AWS Load Balancer Controller
cd ../../scripts
./install-alb-controller.sh

# 3. Deploy monitoring stack
./scripts/deploy-monitoring-with-helm.sh

# 4. Deploy file upload service
./scripts/deploy-with-helm.sh
```

### EKS Deployment (Legacy - Raw Kubernetes Manifests)

```bash
cd infrastructure/terraform
terraform init
terraform apply -var="s3_bucket_name=your-unique-bucket-name"
aws eks update-kubeconfig --name file-upload-cluster --region us-east-1
cd ../../scripts
./deploy-app.sh
```

### GKE Deployment

```bash
cd infrastructure/gke
# Edit terraform.tfvars with your GCP project ID
terraform init
terraform apply
gcloud container clusters get-credentials file-upload-cluster --region us-central1
cd ../../scripts
./deploy-gke.sh
```

## Detailed Steps

- **EKS with Helm & CI/CD**: See [STEP_BY_STEP_HELM.md](./STEP_BY_STEP_HELM.md) ⭐ **Recommended**
- **EKS (Legacy)**: See [STEP_BY_STEP.md](./STEP_BY_STEP.md)
- **GKE**: See [GKE_DEPLOYMENT.md](./GKE_DEPLOYMENT.md)

## Architecture

### EKS
```
Internet → ALB → EKS → File Upload Service → S3
```

### GKE
```
Internet → GCP Load Balancer → GKE → File Upload Service → GCS
```

## Estimated Time

- Infrastructure Setup: 30-45 minutes
- Application Deployment: 15-20 minutes
- Monitoring Setup: 20-30 minutes
- CI/CD Setup: 30-45 minutes
- **Total: ~2-3 hours**

## Cost Estimates

### EKS
- EKS Control Plane: $73/month
- EC2 Instances: ~$300/month
- ALB: ~$20/month
- S3 & CloudWatch: ~$10/month
- **Total: ~$400/month**

### GKE
- GKE Control Plane: $73/month
- Node VMs: ~$50/month
- Load Balancer: ~$18/month
- GCS Storage: ~$2/month
- **Total: ~$143/month**

**Important:** Remember to destroy resources when not in use to avoid charges.

## Lab Structure

```
k8s-file-upload-lab/
├── infrastructure/
│   ├── terraform/      # AWS EKS infrastructure
│   ├── gke/            # GCP GKE infrastructure
│   └── aks/            # Azure AKS infrastructure
├── charts/             # Helm charts ⭐
│   ├── file-upload-service/  # Application Helm chart
│   └── monitoring-stack/      # Monitoring Helm chart
├── kubernetes/         # Raw Kubernetes manifests (legacy)
│   ├── *.yaml          # EKS manifests
│   ├── gke/            # GKE manifests
│   └── aks/            # AKS manifests
├── application/        # Application code (supports all clouds)
├── monitoring/         # Monitoring stack (legacy)
├── ci-cd/              # CI/CD configurations
│   ├── github-actions/ # GitHub Actions workflows
│   ├── argocd/         # ArgoCD applications
│   └── jenkins/        # Jenkins pipelines
├── .github/
│   └── workflows/      # GitHub Actions workflows ⭐
└── scripts/
    ├── deploy-with-helm.sh           # Helm deployment (recommended)
    ├── deploy-monitoring-with-helm.sh # Monitoring Helm deployment
    ├── deploy-app.sh                 # Legacy deployment
    ├── deploy-gke.sh                  # GKE deployment
    └── deploy-aks.sh                  # AKS deployment
```

## Cleanup

### EKS
```bash
cd infrastructure/terraform
terraform destroy
```

### GKE
```bash
cd infrastructure/gke
terraform destroy
```

## Troubleshooting

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues and solutions.
