#!/bin/bash
set -e

# Get values from terraform output
cd "$(dirname "$0")/../infrastructure/terraform"

ECR_URL=$(terraform output -raw ecr_url 2>/dev/null || echo "")
S3_BUCKET=$(terraform output -raw s3_bucket_name 2>/dev/null || echo "")
IAM_ROLE_ARN=$(terraform output -raw file_upload_service_role_arn 2>/dev/null || echo "")

if [ -z "$ECR_URL" ] || [ -z "$S3_BUCKET" ]; then
    echo "Error: Terraform outputs not found. Please run 'terraform apply' first."
    exit 1
fi

echo "ECR URL: $ECR_URL"
echo "S3 Bucket: $S3_BUCKET"
echo "IAM Role ARN: $IAM_ROLE_ARN"

# Build and push image
cd ../../application/backend
echo "Building Docker image for linux/amd64 (EKS nodes are x86_64)..."
docker build --platform linux/amd64 -t file-upload-service:latest .

# Login to ECR
echo "Logging in to ECR..."
aws ecr get-login-password --region ${AWS_REGION:-us-east-1} | docker login --username AWS --password-stdin $ECR_URL

# Tag and push
echo "Tagging and pushing image..."
docker tag file-upload-service:latest $ECR_URL:latest
docker push $ECR_URL:latest

# Update Kubernetes manifests
cd ../../kubernetes
echo "Updating Kubernetes manifests..."

# Update ConfigMap with S3 bucket
kubectl create configmap file-upload-config \
  --from-literal=S3_BUCKET=$S3_BUCKET \
  --from-literal=AWS_REGION=${AWS_REGION:-us-east-1} \
  --from-literal=PORT=8080 \
  --from-literal=LOG_LEVEL=info \
  -n file-upload --dry-run=client -o yaml | kubectl apply -f -

# Update deployment with ECR URL
sed "s|CHANGEME|$ECR_URL:latest|g" deployment.yaml | kubectl apply -f -

# Update service account with IAM role
if [ ! -z "$IAM_ROLE_ARN" ]; then
    kubectl annotate serviceaccount file-upload-service \
      eks.amazonaws.com/role-arn=$IAM_ROLE_ARN \
      -n file-upload --overwrite
fi

echo "Deployment complete!"
echo "Check status with: kubectl get pods -n file-upload"

