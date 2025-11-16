#!/bin/bash
set -e

# Get values from terraform output
cd "$(dirname "$0")/../infrastructure/aks"

# Read from terraform.tfvars if outputs not available
if [ -f terraform.tfvars ]; then
  CLUSTER_NAME=$(grep '^cluster_name' terraform.tfvars | cut -d'"' -f2 || echo "file-upload-cluster")
  RESOURCE_GROUP=$(grep '^resource_group' terraform.tfvars | cut -d'"' -f2 || echo "")
  LOCATION=$(grep '^location' terraform.tfvars | cut -d'"' -f2 || echo "eastus")
fi

# Try to get from terraform output
CLUSTER_NAME=${CLUSTER_NAME:-$(terraform output -raw cluster_name 2>/dev/null || echo "file-upload-cluster")}
RESOURCE_GROUP=${RESOURCE_GROUP:-$(terraform output -raw resource_group_name 2>/dev/null || echo "")}
STORAGE_ACCOUNT=$(terraform output -raw storage_account_name 2>/dev/null || echo "")
STORAGE_CONTAINER=$(terraform output -raw storage_container_name 2>/dev/null || echo "")
ACR_URL=$(terraform output -raw container_registry_url 2>/dev/null || echo "")
MANAGED_IDENTITY_CLIENT_ID=$(terraform output -raw managed_identity_client_id 2>/dev/null || echo "")
LOCATION=${LOCATION:-"eastus"}

if [ -z "$RESOURCE_GROUP" ] || [ -z "$STORAGE_ACCOUNT" ] || [ -z "$ACR_URL" ]; then
    echo "Error: Terraform outputs not found. Please run 'terraform apply' first."
    exit 1
fi

echo "Resource Group: $RESOURCE_GROUP"
echo "Storage Account: $STORAGE_ACCOUNT"
echo "ACR URL: $ACR_URL"
echo "Managed Identity Client ID: $MANAGED_IDENTITY_CLIENT_ID"

# Configure kubectl
echo "Configuring kubectl..."
az aks get-credentials --resource-group $RESOURCE_GROUP --name $CLUSTER_NAME --overwrite-existing

# Build and push image
cd ../../application/backend
echo "Building Docker image for linux/amd64..."
docker build --platform linux/amd64 -f Dockerfile.aks -t file-upload-service:latest .

# Login to ACR
echo "Logging in to ACR..."
az acr login --name $(echo $ACR_URL | cut -d'.' -f1)

# Tag and push
IMAGE_TAG="${ACR_URL}/file-upload-service:latest"
echo "Tagging and pushing image to $IMAGE_TAG..."
docker tag file-upload-service:latest $IMAGE_TAG
docker push $IMAGE_TAG

# Update Kubernetes manifests
cd ../../kubernetes/aks
echo "Updating Kubernetes manifests..."

# Create namespace if it doesn't exist
kubectl create namespace file-upload --dry-run=client -o yaml | kubectl apply -f -

# Update ConfigMap
kubectl create configmap file-upload-config \
  --from-literal=STORAGE_ACCOUNT=$STORAGE_ACCOUNT \
  --from-literal=STORAGE_CONTAINER=$STORAGE_CONTAINER \
  --from-literal=AZURE_REGION=$LOCATION \
  --from-literal=PORT=8080 \
  --from-literal=LOG_LEVEL=info \
  -n file-upload --dry-run=client -o yaml | kubectl apply -f -

# Create secret for managed identity
if [ ! -z "$MANAGED_IDENTITY_CLIENT_ID" ]; then
    kubectl create secret generic azure-identity \
      --from-literal=clientId=$MANAGED_IDENTITY_CLIENT_ID \
      -n file-upload --dry-run=client -o yaml | kubectl apply -f -
fi

# Update deployment with image URL
sed "s|CHANGEME|$IMAGE_TAG|g" deployment.yaml | kubectl apply -f -

# Apply namespace first
kubectl apply -f namespace.yaml

# Apply other resources
kubectl apply -f service.yaml
kubectl apply -f hpa.yaml

echo "Deployment complete!"
echo "Check status with: kubectl get pods -n file-upload"
echo "Get LoadBalancer IP: kubectl get svc -n file-upload"

