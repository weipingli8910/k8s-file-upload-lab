#!/bin/bash
set -e

echo "Replacing placeholders in deployment.yaml..."

# Get values from Terraform
cd "$(dirname "$0")/../infrastructure/terraform"

ECR_URL=$(terraform output -raw ecr_url 2>/dev/null || echo "")
IAM_ROLE_ARN=$(terraform output -raw file_upload_service_role_arn 2>/dev/null || echo "")
S3_BUCKET=$(terraform output -raw s3_bucket_name 2>/dev/null || echo "")

if [ -z "$ECR_URL" ] || [ -z "$IAM_ROLE_ARN" ] || [ -z "$S3_BUCKET" ]; then
    echo "Error: Terraform outputs not found. Please run 'terraform apply' first."
    exit 1
fi

cd ../../kubernetes

# Create backup
cp deployment.yaml deployment.yaml.backup
cp configmap.yaml configmap.yaml.backup

echo "Replacing placeholders..."

# Replace ECR URL in deployment.yaml (line 25)
sed -i '' "s|image: CHANGEME|image: $ECR_URL:latest|g" deployment.yaml

# Replace IAM Role ARN in deployment.yaml (line 78)
sed -i '' "s|eks.amazonaws.com/role-arn: \"CHANGEME\"|eks.amazonaws.com/role-arn: \"$IAM_ROLE_ARN\"|g" deployment.yaml

# Replace S3 bucket in configmap.yaml
sed -i '' "s|S3_BUCKET: \"CHANGE_ME\"|S3_BUCKET: \"$S3_BUCKET\"|g" configmap.yaml

echo "✅ Placeholders replaced!"
echo ""
echo "Changes made:"
echo "  - deployment.yaml: ECR URL and IAM Role ARN updated"
echo "  - configmap.yaml: S3 Bucket updated"
echo ""
echo "Backup files created:"
echo "  - deployment.yaml.backup"
echo "  - configmap.yaml.backup"
echo ""
echo "You can now apply the manifests:"
echo "  kubectl apply -f namespace.yaml"
echo "  kubectl apply -f configmap.yaml"
echo "  kubectl apply -f deployment.yaml"
echo "  kubectl apply -f service.yaml"
echo "  kubectl apply -f ingress.yaml"

