# File Upload Service Helm Chart

This Helm chart deploys the file upload service on Kubernetes (EKS, GKE, AKS).

## Prerequisites

- Kubernetes 1.20+
- Helm 3.0+
- kubectl configured to access your cluster
- For AWS EKS: AWS Load Balancer Controller installed
- For monitoring: Prometheus Operator installed (if using ServiceMonitor)

## Installation

### Quick Start (AWS EKS)

1. **Get values from Terraform:**
   ```bash
   cd infrastructure/terraform
   ECR_URL=$(terraform output -raw ecr_url)
   S3_BUCKET=$(terraform output -raw s3_bucket_name)
   IAM_ROLE_ARN=$(terraform output -raw file_upload_service_role_arn)
   ```

2. **Install the chart:**
   ```bash
   cd ../../charts/file-upload-service
   
   helm install file-upload-service . \
     -f values-aws.yaml \
     --set image.repository=$ECR_URL \
     --set config.s3Bucket=$S3_BUCKET \
     --set serviceAccount.annotations."eks\.amazonaws\.com/role-arn"=$IAM_ROLE_ARN \
     -n file-upload \
     --create-namespace
   ```

### Step-by-Step Installation

#### Step 1: Get Required Values

Get the values from your Terraform outputs:

```bash
cd infrastructure/terraform

# Get ECR repository URL
ECR_URL=$(terraform output -raw ecr_url)
echo "ECR URL: $ECR_URL"

# Get S3 bucket name
S3_BUCKET=$(terraform output -raw s3_bucket_name)
echo "S3 Bucket: $S3_BUCKET"

# Get IAM role ARN for service account
IAM_ROLE_ARN=$(terraform output -raw file_upload_service_role_arn)
echo "IAM Role ARN: $IAM_ROLE_ARN"
```

#### Step 2: Update values-aws.yaml (Optional)

You can either:
- Set values via `--set` flags (recommended for automation)
- Edit `values-aws.yaml` directly

To edit `values-aws.yaml`:
```bash
cd charts/file-upload-service
nano values-aws.yaml
```

Set the IAM role ARN:
```yaml
serviceAccount:
  annotations:
    eks.amazonaws.com/role-arn: "arn:aws:iam::YOUR_ACCOUNT:role/YOUR_ROLE"
```

#### Step 3: Install the Chart

**Option A: Using command-line values (Recommended)**
```bash
cd charts/file-upload-service

helm install file-upload-service . \
  -f values-aws.yaml \
  --set image.repository=$ECR_URL \
  --set image.tag=latest \
  --set config.s3Bucket=$S3_BUCKET \
  --set config.awsRegion=us-east-1 \
  --set serviceAccount.annotations."eks\.amazonaws\.com/role-arn"=$IAM_ROLE_ARN \
  -n file-upload \
  --create-namespace
```

**Option B: Using values file**
```bash
# Edit values-aws.yaml with your values first
helm install file-upload-service . \
  -f values-aws.yaml \
  -n file-upload \
  --create-namespace
```

#### Step 4: Verify Installation

```bash
# Check pods
kubectl get pods -n file-upload

# Check services
kubectl get svc -n file-upload

# Check ingress
kubectl get ingress -n file-upload

# Check deployment
kubectl get deployment -n file-upload
```

#### Step 5: Get Application URL

```bash
# Get ALB URL
kubectl get ingress -n file-upload -o jsonpath='{.items[0].status.loadBalancer.ingress[0].hostname}'

# Or use this command
ALB_URL=$(kubectl get ingress file-upload-service-ingress -n file-upload -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
echo "Application URL: http://$ALB_URL"
```

## Upgrading

### Update Image

```bash
# Get new image tag
NEW_TAG="v1.2.3"

# Upgrade deployment
helm upgrade file-upload-service ./charts/file-upload-service \
  -f values-aws.yaml \
  --set image.tag=$NEW_TAG \
  -n file-upload
```

### Update Configuration

```bash
helm upgrade file-upload-service ./charts/file-upload-service \
  -f values-aws.yaml \
  --set config.logLevel=debug \
  --set replicaCount=3 \
  -n file-upload
```

## Uninstalling

```bash
helm uninstall file-upload-service -n file-upload
```

## Configuration

### Key Values

| Parameter | Description | Default |
|-----------|-------------|---------|
| `image.repository` | Container image repository | `""` (required) |
| `image.tag` | Container image tag | `"latest"` |
| `replicaCount` | Number of replicas | `2` |
| `config.s3Bucket` | S3 bucket name | `""` (required) |
| `config.awsRegion` | AWS region | `"us-east-1"` |
| `serviceAccount.annotations` | Service account annotations (for IRSA) | `{}` |
| `ingress.enabled` | Enable ingress | `true` |
| `autoscaling.enabled` | Enable HPA | `true` |
| `monitoring.serviceMonitor.enabled` | Enable ServiceMonitor | `true` |

### Full Values Reference

See `values.yaml` for all available configuration options.

## Examples

### Development Environment

```bash
helm install file-upload-service . \
  -f values-aws.yaml \
  --set image.repository=$ECR_URL \
  --set config.s3Bucket=$S3_BUCKET \
  --set replicaCount=1 \
  --set autoscaling.enabled=false \
  --set config.logLevel=debug \
  -n file-upload-dev \
  --create-namespace
```

### Production Environment

```bash
helm install file-upload-service . \
  -f values-aws.yaml \
  --set image.repository=$ECR_URL \
  --set image.tag=v1.0.0 \
  --set config.s3Bucket=$S3_BUCKET \
  --set replicaCount=3 \
  --set resources.limits.cpu=1000m \
  --set resources.limits.memory=1Gi \
  -n file-upload-prod \
  --create-namespace
```

## Troubleshooting

### Check Chart Rendering

```bash
# Dry-run to see what will be deployed
helm install file-upload-service . \
  -f values-aws.yaml \
  --set image.repository=$ECR_URL \
  --set config.s3Bucket=$S3_BUCKET \
  --dry-run --debug
```

### Validate Chart

```bash
# Lint the chart
helm lint ./charts/file-upload-service

# Template and validate
helm template file-upload-service ./charts/file-upload-service \
  -f values-aws.yaml \
  --set image.repository=$ECR_URL \
  --set config.s3Bucket=$S3_BUCKET | kubectl apply --dry-run=client -f -
```

### Common Issues

1. **Image pull errors**: Verify ECR URL and image tag
2. **Permission errors**: Check IAM role ARN in service account annotations
3. **Ingress not working**: Verify AWS Load Balancer Controller is installed
4. **ServiceMonitor errors**: Verify Prometheus Operator is installed

## Future: Multi-Cloud Support

This chart is structured to support GKE and AKS deployments:

- `values-gke.yaml` - GCP GKE configuration
- `values-aks.yaml` - Azure AKS configuration

The chart automatically adapts based on `cloudProvider` value in values file.

