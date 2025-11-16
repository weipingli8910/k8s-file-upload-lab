# Multi-Cloud Deployment Guide

This lab supports deployment to **AWS (EKS)**, **GCP (GKE)**, and **Azure (AKS)** with the same modular structure.

## Consistent Structure

All three cloud providers follow the same structure:

```
infrastructure/
├── terraform/          # AWS EKS
│   ├── main.tf
│   └── modules/
│       ├── vpc/
│       └── eks/
├── gke/                # GCP GKE
│   ├── main.tf
│   └── modules/
│       ├── vpc/
│       └── gke/
└── aks/                # Azure AKS
    ├── main.tf
    └── modules/
        ├── vnet/
        └── aks/
```

## Deployment Scope

Each cloud provider creates:
1. **VPC/VNet** - Virtual network with subnets
2. **Kubernetes Cluster** - Managed Kubernetes service
3. **Storage** - Object storage (S3/GCS/Blob Storage)
4. **Container Registry** - For container images (ECR/Artifact Registry/ACR)
5. **IAM/Service Accounts** - For service authentication

## Quick Start

### AWS (EKS)

```bash
cd infrastructure/terraform
terraform init
terraform apply -var="s3_bucket_name=your-unique-bucket"
aws eks update-kubeconfig --name file-upload-cluster --region us-east-1
cd ../../scripts
./deploy-app.sh
```

### GCP (GKE)

```bash
cd infrastructure/gke
# Edit terraform.tfvars with your project_id
terraform init
terraform apply
gcloud container clusters get-credentials file-upload-cluster --region us-central1
cd ../../scripts
./deploy-gke.sh
```

### Azure (AKS)

```bash
cd infrastructure/aks
# Edit terraform.tfvars
terraform init
terraform apply
az aks get-credentials --resource-group file-upload-cluster-rg --name file-upload-cluster
cd ../../scripts
./deploy-aks.sh
```

## Comparison Table

| Feature | AWS (EKS) | GCP (GKE) | Azure (AKS) |
|---------|-----------|-----------|-------------|
| **VPC** | VPC with public/private subnets | VPC with subnet | Virtual Network |
| **Cluster** | EKS | GKE | AKS |
| **Storage** | S3 | GCS | Blob Storage |
| **Registry** | ECR | Artifact Registry | ACR |
| **IAM** | IRSA (IAM Roles) | Workload Identity | Managed Identity |
| **Load Balancer** | ALB (via Ingress) | GCP Load Balancer | Azure Load Balancer |
| **Networking** | VPC CNI | Native GKE | Azure CNI |

## Application Code

The application has cloud-specific versions:
- `server.js` - AWS (S3)
- `server-gke.js` - GCP (GCS)
- `server-aks.js` - Azure (Blob Storage)

Dockerfiles:
- `Dockerfile` - AWS
- `Dockerfile.gke` - GCP
- `Dockerfile.aks` - Azure

## Kubernetes Manifests

Each cloud has its own manifests in:
- `kubernetes/` - AWS (EKS)
- `kubernetes/gke/` - GCP (GKE)
- `kubernetes/aks/` - Azure (AKS)

All use the same structure:
- `namespace.yaml`
- `configmap.yaml`
- `deployment.yaml`
- `service.yaml`
- `hpa.yaml`

## Environment Variables

### AWS
- `S3_BUCKET`
- `AWS_REGION`

### GCP
- `GCS_BUCKET`
- `GCP_PROJECT`
- `GCP_REGION`

### Azure
- `STORAGE_ACCOUNT`
- `STORAGE_CONTAINER`
- `AZURE_REGION`
- `AZURE_CLIENT_ID` (for Managed Identity)

## Cost Estimates

| Cloud | Control Plane | Nodes | Load Balancer | Storage | **Total** |
|-------|--------------|-------|---------------|---------|-----------|
| AWS | $73/mo | ~$300/mo | ~$20/mo | ~$10/mo | **~$400/mo** |
| GCP | $73/mo | ~$50/mo | ~$18/mo | ~$2/mo | **~$143/mo** |
| Azure | $0/mo* | ~$100/mo | ~$20/mo | ~$2/mo | **~$122/mo** |

*Azure AKS control plane is free, but nodes cost more

## Prerequisites

### AWS
- AWS CLI configured
- Appropriate IAM permissions

### GCP
- gcloud CLI configured
- Project with billing enabled
- Application Default Credentials

### Azure
- Azure CLI configured
- Subscription with appropriate permissions

## Cleanup

### AWS
```bash
cd infrastructure/terraform
terraform destroy
```

### GCP
```bash
cd infrastructure/gke
terraform destroy
```

### Azure
```bash
cd infrastructure/aks
terraform destroy
```

## Troubleshooting

See cloud-specific guides:
- **EKS**: [STEP_BY_STEP.md](./STEP_BY_STEP.md)
- **GKE**: [GKE_DEPLOYMENT.md](./GKE_DEPLOYMENT.md)
- **AKS**: Check Azure-specific issues in [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

