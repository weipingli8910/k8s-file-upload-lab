#!/bin/bash
# Quick script to get values needed for deployment

cd "$(dirname "$0")/../infrastructure/terraform"

echo "Getting Terraform outputs..."
echo ""

ECR_URL=$(terraform output -raw ecr_url 2>/dev/null || echo "NOT_FOUND")
S3_BUCKET=$(terraform output -raw s3_bucket_name 2>/dev/null || echo "NOT_FOUND")
IAM_ROLE_ARN=$(terraform output -raw file_upload_service_role_arn 2>/dev/null || echo "NOT_FOUND")

echo "Values to replace in deployment.yaml:"
echo "======================================"
echo ""
echo "1. ECR Image URL (line 25):"
echo "   Replace: CHANGEME"
echo "   With:    $ECR_URL:latest"
echo ""
echo "2. IAM Role ARN (line 78):"
echo "   Replace: CHANGEME"
echo "   With:    $IAM_ROLE_ARN"
echo ""
echo "3. S3 Bucket (in configmap.yaml):"
echo "   Replace: CHANGE_ME"
echo "   With:    $S3_BUCKET"
echo ""

