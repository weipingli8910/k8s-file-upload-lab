#!/bin/bash
set -e

# Get values from terraform output
cd "$(dirname "$0")/../infrastructure/gke"

# Read from terraform.tfvars if outputs not available
if [ -f terraform.tfvars ]; then
  PROJECT_ID=$(grep '^project_id' terraform.tfvars | cut -d'"' -f2)
  REGION=$(grep '^region' terraform.tfvars | cut -d'"' -f2 || echo "us-central1")
  CLUSTER_NAME=$(grep '^cluster_name' terraform.tfvars | cut -d'"' -f2 || echo "file-upload-cluster")
fi

# Try to get from terraform output
PROJECT_ID=${PROJECT_ID:-$(terraform output -raw project_id 2>/dev/null || echo "")}
GCS_BUCKET=$(terraform output -raw gcs_bucket_name 2>/dev/null || echo "")
ARTIFACT_REGISTRY_URL=$(terraform output -raw artifact_registry_url 2>/dev/null || echo "")
SERVICE_ACCOUNT_EMAIL=$(terraform output -raw service_account_email 2>/dev/null || echo "")
CLUSTER_NAME=${CLUSTER_NAME:-$(terraform output -raw cluster_name 2>/dev/null || echo "file-upload-cluster")}
REGION=${REGION:-$(terraform output -raw cluster_location 2>/dev/null || echo "us-central1")}

if [ -z "$PROJECT_ID" ] || [ -z "$GCS_BUCKET" ] || [ -z "$ARTIFACT_REGISTRY_URL" ]; then
    echo "Error: Terraform outputs not found. Please run 'terraform apply' first."
    exit 1
fi

echo "Project ID: $PROJECT_ID"
echo "GCS Bucket: $GCS_BUCKET"
echo "Artifact Registry: $ARTIFACT_REGISTRY_URL"
echo "Service Account: $SERVICE_ACCOUNT_EMAIL"

# Configure kubectl
echo "Configuring kubectl..."
gcloud container clusters get-credentials $CLUSTER_NAME --region $REGION --project $PROJECT_ID

# Build and push image
cd ../../application/backend
echo "Building Docker image for linux/amd64..."
docker build --platform linux/amd64 -f Dockerfile.gke -t file-upload-service:latest .

# Configure Docker for Artifact Registry
echo "Configuring Docker for Artifact Registry..."
gcloud auth configure-docker ${REGION}-docker.pkg.dev

# Tag and push
IMAGE_TAG="${ARTIFACT_REGISTRY_URL}:latest"
echo "Tagging and pushing image to $IMAGE_TAG..."
docker tag file-upload-service:latest $IMAGE_TAG
docker push $IMAGE_TAG

# Update Kubernetes manifests
cd ../../kubernetes/gke
echo "Updating Kubernetes manifests..."

# Create namespace if it doesn't exist
kubectl create namespace file-upload --dry-run=client -o yaml | kubectl apply -f -

# Update ConfigMap
kubectl create configmap file-upload-config \
  --from-literal=GCS_BUCKET=$GCS_BUCKET \
  --from-literal=GCP_PROJECT=$PROJECT_ID \
  --from-literal=GCP_REGION=$REGION \
  --from-literal=PORT=8080 \
  --from-literal=LOG_LEVEL=info \
  -n file-upload --dry-run=client -o yaml | kubectl apply -f -

# Update deployment with image URL
sed "s|CHANGEME|$IMAGE_TAG|g" deployment.yaml | kubectl apply -f -

# Update service account with GCP service account
if [ ! -z "$SERVICE_ACCOUNT_EMAIL" ]; then
    kubectl annotate serviceaccount file-upload-service \
      iam.gke.io/gcp-service-account=$SERVICE_ACCOUNT_EMAIL \
      -n file-upload --overwrite
fi

# Apply namespace first
kubectl apply -f namespace.yaml

# Apply other resources
kubectl apply -f service.yaml
kubectl apply -f hpa.yaml

echo "Deployment complete!"
echo "Check status with: kubectl get pods -n file-upload"
echo "Get LoadBalancer IP: kubectl get svc -n file-upload"

