#!/bin/bash
set -e

echo "Deploying file-upload-service using Helm chart..."

# Get values from Terraform
cd "$(dirname "$0")/../infrastructure/terraform"

ECR_URL=$(terraform output -raw ecr_url 2>/dev/null || echo "")
S3_BUCKET=$(terraform output -raw s3_bucket_name 2>/dev/null || echo "")
IAM_ROLE_ARN=$(terraform output -raw file_upload_service_role_arn 2>/dev/null || echo "")
AWS_REGION=${AWS_REGION:-$(terraform output -raw aws_region 2>/dev/null || echo "us-east-1")}

if [ -z "$ECR_URL" ] || [ -z "$S3_BUCKET" ]; then
    echo "Error: Terraform outputs not found. Please run 'terraform apply' first."
    exit 1
fi

echo "ECR URL: $ECR_URL"
echo "S3 Bucket: $S3_BUCKET"
echo "IAM Role ARN: $IAM_ROLE_ARN"
echo "AWS Region: $AWS_REGION"
echo ""

# Navigate to chart directory
cd ../../charts/file-upload-service

# Lint chart
echo "Linting Helm chart..."
helm lint . || {
    echo "Error: Chart linting failed"
    exit 1
}

# Create namespace if it doesn't exist (idempotent)
NAMESPACE="file-upload"
echo "Ensuring namespace $NAMESPACE exists..."
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

# Disable namespace creation in template since we create it separately
# Install or upgrade
if helm list -n file-upload | grep -q file-upload-service; then
    echo "Upgrading existing release..."
    helm upgrade file-upload-service . \
      -f values-aws.yaml \
      --set image.repository=$ECR_URL \
      --set image.tag=latest \
      --set config.s3Bucket=$S3_BUCKET \
      --set config.awsRegion=$AWS_REGION \
      --set namespace.create=false \
      --set serviceAccount.annotations."eks\.amazonaws\.com/role-arn"=$IAM_ROLE_ARN \
      -n file-upload \
      --wait
else
    echo "Installing new release..."
    helm install file-upload-service . \
      -f values-aws.yaml \
      --set image.repository=$ECR_URL \
      --set image.tag=latest \
      --set config.s3Bucket=$S3_BUCKET \
      --set config.awsRegion=$AWS_REGION \
      --set namespace.create=false \
      --set serviceAccount.annotations."eks\.amazonaws\.com/role-arn"=$IAM_ROLE_ARN \
      -n file-upload \
      --wait
fi

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Check status:"
echo "  kubectl get pods -n file-upload"
echo "  kubectl get ingress -n file-upload"
echo ""
echo "Get application URL:"
echo "  kubectl get ingress file-upload-service-ingress -n file-upload -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'"

