# GKE Deployment Guide

This guide explains how to deploy the file upload service to Google Kubernetes Engine (GKE).

## Prerequisites

1. **GCP Account** with billing enabled
2. **gcloud CLI** installed and configured (`gcloud init`)
3. **kubectl** installed
4. **Terraform** installed
5. **Docker** installed

## Quick Start

### Step 1: Setup GCP Project

```bash
# Set your project ID
export PROJECT_ID="your-gcp-project-id"
export REGION="us-central1"

# Enable billing (if not already enabled)
gcloud billing projects link $PROJECT_ID --billing-account=YOUR_BILLING_ACCOUNT

# Set default project
gcloud config set project $PROJECT_ID
```

### Step 2: Authenticate

```bash
# Login to GCP
gcloud auth login

# Configure application-default credentials (for Terraform)
gcloud auth application-default login
```

### Step 3: Deploy Infrastructure

```bash
cd infrastructure/gke

# Copy and edit terraform.tfvars
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values

# Initialize Terraform
terraform init

# Plan
terraform plan

# Apply (takes 10-15 minutes)
terraform apply

# Save outputs
terraform output > ../../outputs-gke.txt
```

### Step 4: Configure kubectl

```bash
# Get cluster credentials
gcloud container clusters get-credentials file-upload-cluster \
  --region us-central1 \
  --project $PROJECT_ID

# Verify connection
kubectl get nodes
```

### Step 5: Deploy Application

```bash
# Use the deployment script
cd ../../scripts
./deploy-gke.sh

# Or manually:
# 1. Build and push image to Artifact Registry
# 2. Update Kubernetes manifests
# 3. Apply manifests
```

### Step 6: Get Application URL

```bash
# Get LoadBalancer IP (may take 2-3 minutes)
kubectl get svc -n file-upload -w

# Get the EXTERNAL-IP
EXTERNAL_IP=$(kubectl get svc file-upload-service -n file-upload -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
echo "Application URL: http://$EXTERNAL_IP"

# Test
curl http://$EXTERNAL_IP/health
```

## Manual Deployment Steps

### 1. Build and Push Container Image

```bash
cd application/backend

# Build image
docker build -f Dockerfile.gke -t file-upload-service:latest .

# Get Artifact Registry URL from terraform output
ARTIFACT_REGISTRY_URL=$(cd ../../infrastructure/gke && terraform output -raw artifact_registry_url)

# Configure Docker
gcloud auth configure-docker us-central1-docker.pkg.dev

# Tag and push
docker tag file-upload-service:latest $ARTIFACT_REGISTRY_URL:latest
docker push $ARTIFACT_REGISTRY_URL:latest
```

### 2. Update Kubernetes Manifests

```bash
cd ../../kubernetes/gke

# Get values from terraform
GCS_BUCKET=$(cd ../../infrastructure/gke && terraform output -raw gcs_bucket_name)
PROJECT_ID=$(cd ../../infrastructure/gke && terraform output -raw project_id)
SERVICE_ACCOUNT=$(cd ../../infrastructure/gke && terraform output -raw service_account_email)
IMAGE_URL=$(cd ../../infrastructure/gke && terraform output -raw artifact_registry_url):latest

# Update ConfigMap
kubectl create configmap file-upload-config \
  --from-literal=GCS_BUCKET=$GCS_BUCKET \
  --from-literal=GCP_PROJECT=$PROJECT_ID \
  --from-literal=GCP_REGION=us-central1 \
  --from-literal=PORT=8080 \
  --from-literal=LOG_LEVEL=info \
  -n file-upload

# Update deployment
sed "s|CHANGEME|$IMAGE_URL|g" deployment.yaml | kubectl apply -f -

# Update service account
kubectl annotate serviceaccount file-upload-service \
  iam.gke.io/gcp-service-account=$SERVICE_ACCOUNT \
  -n file-upload --overwrite

# Apply other resources
kubectl apply -f service.yaml
kubectl apply -f hpa.yaml
```

## Differences from EKS

### Storage
- **EKS**: Uses S3 (AWS Simple Storage Service)
- **GKE**: Uses GCS (Google Cloud Storage)

### Container Registry
- **EKS**: Uses ECR (Elastic Container Registry)
- **GKE**: Uses Artifact Registry

### Load Balancing
- **EKS**: Uses Application Load Balancer (ALB) via Ingress
- **GKE**: Uses GCP Load Balancer via Service type LoadBalancer

### IAM Integration
- **EKS**: Uses IRSA (IAM Roles for Service Accounts)
- **GKE**: Uses Workload Identity

### Networking
- **EKS**: VPC CNI plugin
- **GKE**: Native GKE networking

## Application Code Changes

The GKE version uses:
- `@google-cloud/storage` instead of `aws-sdk`
- `server-gke.js` instead of `server.js`
- Environment variables: `GCS_BUCKET`, `GCP_PROJECT`, `GCP_REGION`

## Monitoring

GKE automatically integrates with:
- **Cloud Logging**: Application logs
- **Cloud Monitoring**: Metrics and dashboards
- **Prometheus**: Can be installed separately

## Cost Estimate

- **GKE Cluster**: ~$73/month (control plane)
- **Node VMs** (2x e2-medium): ~$50/month
- **Load Balancer**: ~$18/month
- **GCS Storage**: ~$0.02/GB/month
- **Total**: ~$141/month (varies by usage)

## Cleanup

```bash
cd infrastructure/gke
terraform destroy
```

## Troubleshooting

### Issue: "Permission denied" when pushing to Artifact Registry
```bash
gcloud auth configure-docker us-central1-docker.pkg.dev
```

### Issue: Service account not working
```bash
# Verify workload identity binding
gcloud iam service-accounts get-iam-policy SERVICE_ACCOUNT_EMAIL

# Check service account annotation
kubectl get serviceaccount file-upload-service -n file-upload -o yaml
```

### Issue: Cannot access GCS bucket
```bash
# Verify IAM permissions
gcloud projects get-iam-policy $PROJECT_ID

# Check service account has Storage Object Admin role
```

### Issue: LoadBalancer stuck in pending
```bash
# Check firewall rules
gcloud compute firewall-rules list

# Check quota
gcloud compute project-info describe --project=$PROJECT_ID
```

## Useful Commands

```bash
# View cluster info
gcloud container clusters describe file-upload-cluster --region us-central1

# Get credentials
gcloud container clusters get-credentials file-upload-cluster --region us-central1

# View pods
kubectl get pods -n file-upload

# View logs
kubectl logs -n file-upload -l app=file-upload-service

# Port forward
kubectl port-forward -n file-upload svc/file-upload-service 8080:80
```

