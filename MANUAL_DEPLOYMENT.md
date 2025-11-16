# Manual Deployment Steps - Replacing Placeholders

This guide shows you how to manually replace placeholders in the Kubernetes manifests.

## Placeholders to Replace

### 1. `deployment.yaml` - Line 25
**Placeholder:** `image: CHANGEME`  
**Replace with:** Your ECR image URL

### 2. `deployment.yaml` - Line 78
**Placeholder:** `eks.amazonaws.com/role-arn: "CHANGEME"`  
**Replace with:** Your IAM role ARN for the service account

### 3. `configmap.yaml` - Line 6
**Placeholder:** `S3_BUCKET: "CHANGE_ME"`  
**Replace with:** Your S3 bucket name

## Step-by-Step Instructions

### Step 1: Get Values from Terraform

```bash
cd infrastructure/terraform

# Get ECR URL
ECR_URL=$(terraform output -raw ecr_url)
echo "ECR URL: $ECR_URL"

# Get IAM Role ARN
IAM_ROLE_ARN=$(terraform output -raw file_upload_service_role_arn)
echo "IAM Role ARN: $IAM_ROLE_ARN"

# Get S3 Bucket
S3_BUCKET=$(terraform output -raw s3_bucket_name)
echo "S3 Bucket: $S3_BUCKET"
```

### Step 2: Replace in deployment.yaml

**Option A: Using sed (macOS/Linux)**

```bash
cd ../../kubernetes

# Replace ECR URL (line 25)
sed -i '' "s|image: CHANGEME|image: $ECR_URL:latest|g" deployment.yaml

# Replace IAM Role ARN (line 78)
sed -i '' "s|eks.amazonaws.com/role-arn: \"CHANGEME\"|eks.amazonaws.com/role-arn: \"$IAM_ROLE_ARN\"|g" deployment.yaml
```

**Option B: Manual Edit**

1. Open `kubernetes/deployment.yaml`
2. Find line 25: `image: CHANGEME`
3. Replace with: `image: 894002457387.dkr.ecr.us-east-1.amazonaws.com/file-upload-service:latest`
4. Find line 78: `eks.amazonaws.com/role-arn: "CHANGEME"`
5. Replace with: `eks.amazonaws.com/role-arn: "arn:aws:iam::894002457387:role/file-upload-cluster-file-upload-service"`

### Step 3: Replace in configmap.yaml

**Option A: Using sed**

```bash
sed -i '' "s|S3_BUCKET: \"CHANGE_ME\"|S3_BUCKET: \"$S3_BUCKET\"|g" configmap.yaml
```

**Option B: Manual Edit**

1. Open `kubernetes/configmap.yaml`
2. Find line 6: `S3_BUCKET: "CHANGE_ME"`
3. Replace with: `S3_BUCKET: "terraform-20251115065342088700000001"` (your actual bucket name)

### Step 4: Verify Changes

```bash
# Check deployment.yaml
grep -E "(image:|role-arn:)" kubernetes/deployment.yaml

# Check configmap.yaml
grep "S3_BUCKET" kubernetes/configmap.yaml
```

### Step 5: Apply Manifests

```bash
cd kubernetes

# Apply in order
kubectl apply -f namespace.yaml
kubectl apply -f configmap.yaml
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
kubectl apply -f ingress.yaml
kubectl apply -f hpa.yaml
```

## Quick Script Method

Use the provided script to automate the replacement:

```bash
./scripts/replace-placeholders.sh
```

This script will:
1. Get values from Terraform
2. Create backups of original files
3. Replace all placeholders
4. Show you what to do next

## Alternative: Use deploy-app.sh

The easiest way is to use the deployment script which handles everything:

```bash
./scripts/deploy-app.sh
```

This script:
- Builds and pushes the Docker image
- Gets all values from Terraform
- Replaces placeholders automatically
- Applies all manifests

## Verification

After deployment, verify everything is working:

```bash
# Check pods
kubectl get pods -n file-upload

# Check service account annotation
kubectl get serviceaccount file-upload-service -n file-upload -o yaml | grep role-arn

# Check deployment image
kubectl get deployment file-upload-service -n file-upload -o jsonpath='{.spec.template.spec.containers[0].image}'

# Check configmap
kubectl get configmap file-upload-config -n file-upload -o yaml | grep S3_BUCKET
```

## Current Values (from your Terraform)

Based on your current Terraform outputs:

- **ECR URL:** `894002457387.dkr.ecr.us-east-1.amazonaws.com/file-upload-service`
- **IAM Role ARN:** `arn:aws:iam::894002457387:role/file-upload-cluster-file-upload-service`
- **S3 Bucket:** `terraform-20251115065342088700000001`

## Troubleshooting

If you get errors:

1. **Image pull errors:** Make sure you've built and pushed the image to ECR
2. **Permission errors:** Verify the IAM role ARN is correct
3. **S3 access errors:** Check the service account has the correct annotation

