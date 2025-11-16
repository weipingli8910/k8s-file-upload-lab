#!/bin/bash
set -e

echo "=========================================="
echo "EKS File Upload Lab - Setup Script"
echo "=========================================="

# Check prerequisites
echo "Checking prerequisites..."
command -v aws >/dev/null 2>&1 || { echo "AWS CLI not found. Please install it."; exit 1; }
command -v kubectl >/dev/null 2>&1 || { echo "kubectl not found. Please install it."; exit 1; }
command -v terraform >/dev/null 2>&1 || { echo "Terraform not found. Please install it."; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "Docker not found. Please install it."; exit 1; }

# Set variables
export AWS_REGION=${AWS_REGION:-us-east-1}
export CLUSTER_NAME=${CLUSTER_NAME:-file-upload-cluster}
export S3_BUCKET_NAME=${S3_BUCKET_NAME:-file-upload-lab-$(date +%s)}

echo "AWS Region: $AWS_REGION"
echo "Cluster Name: $CLUSTER_NAME"
echo "S3 Bucket: $S3_BUCKET_NAME"

# Verify AWS credentials
echo "Verifying AWS credentials..."
aws sts get-caller-identity || { echo "AWS credentials not configured. Run 'aws configure'"; exit 1; }

echo ""
echo "Setup complete! Next steps:"
echo "1. cd infrastructure/terraform"
echo "2. terraform init"
echo "3. terraform plan -var=\"s3_bucket_name=$S3_BUCKET_NAME\""
echo "4. terraform apply -var=\"s3_bucket_name=$S3_BUCKET_NAME\""

