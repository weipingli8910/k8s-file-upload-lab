#!/bin/bash
set -e

# Quick script to rebuild and push image with correct platform

cd "$(dirname "$0")/../infrastructure/terraform"

ECR_URL=$(terraform output -raw ecr_url 2>/dev/null || echo "")
AWS_REGION=${AWS_REGION:-us-east-1}

if [ -z "$ECR_URL" ]; then
    echo "Error: ECR URL not found. Please run 'terraform apply' first."
    exit 1
fi

echo "ECR URL: $ECR_URL"
echo "Building for linux/amd64 (required for EKS nodes)..."
echo ""

# Build and push image
cd ../../application/backend

# Build for linux/amd64 platform
echo "Building Docker image..."
docker build --platform linux/amd64 -t file-upload-service:latest .

# Login to ECR
echo "Logging in to ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_URL

# Tag and push
echo "Tagging and pushing image..."
docker tag file-upload-service:latest $ECR_URL:latest
docker push $ECR_URL:latest

echo ""
echo "✅ Image rebuilt and pushed successfully!"
echo "Image: $ECR_URL:latest"
echo ""
echo "Now restart the deployment:"
echo "  kubectl rollout restart deployment file-upload-service -n file-upload"

