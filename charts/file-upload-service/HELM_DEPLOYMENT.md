# Helm Chart Deployment Guide - File Upload Service

This guide provides step-by-step instructions for deploying the file upload service using Helm chart on AWS EKS.

## Prerequisites

Before starting, ensure you have:

1. ✅ EKS cluster created and `kubectl` configured
2. ✅ AWS Load Balancer Controller installed
3. ✅ Docker image built and pushed to ECR
4. ✅ Terraform infrastructure deployed
5. ✅ Helm 3.x installed (`helm version`)

## Step 1: Verify Prerequisites

### Check kubectl Access

```bash
kubectl get nodes
```

Expected output: List of EKS nodes

### Check Helm Installation

```bash
helm version
```

Expected: `version.BuildInfo{Version:"v3.x.x", ...}`

### Check AWS Load Balancer Controller

```bash
kubectl get pods -n kube-system | grep aws-load-balancer-controller
```

Expected: At least one pod running

## Step 2: Get Values from Terraform

Navigate to the Terraform directory and get required values:

```bash
cd infrastructure/terraform

# Get ECR repository URL
ECR_URL=$(terraform output -raw ecr_url)
echo "ECR URL: $ECR_URL"

# Get S3 bucket name
S3_BUCKET=$(terraform output -raw s3_bucket_name)
echo "S3 Bucket: $S3_BUCKET"

# Get IAM role ARN for service account (IRSA)
IAM_ROLE_ARN=$(terraform output -raw file_upload_service_role_arn)
echo "IAM Role ARN: $IAM_ROLE_ARN"

# Get AWS region
AWS_REGION=$(terraform output -raw aws_region 2>/dev/null || echo "us-east-1")
echo "AWS Region: $AWS_REGION"
```

**Note:** If any command fails, make sure Terraform has been applied:
```bash
cd infrastructure/terraform
terraform apply
```

## Step 3: Navigate to Chart Directory

```bash
cd /Users/weipingli8910/code/playgrounds/k8s-file-upload-lab/charts/file-upload-service
```

## Step 4: Validate Chart

Before deploying, validate the chart:

```bash
# Lint the chart
helm lint .

# Template the chart (dry-run)
helm template file-upload-service . \
  -f values-aws.yaml \
  --set image.repository=$ECR_URL \
  --set config.s3Bucket=$S3_BUCKET \
  --set serviceAccount.annotations."eks\.amazonaws\.com/role-arn"=$IAM_ROLE_ARN \
  --dry-run --debug
```

This shows what will be deployed without actually deploying.

## Step 5: Install the Chart

### Option A: Install with Command-Line Values (Recommended)

```bash
helm install file-upload-service . \
  -f values-aws.yaml \
  --set image.repository=$ECR_URL \
  --set image.tag=latest \
  --set config.s3Bucket=$S3_BUCKET \
  --set config.awsRegion=$AWS_REGION \
  --set serviceAccount.annotations."eks\.amazonaws\.com/role-arn"=$IAM_ROLE_ARN \
  -n file-upload \
  --create-namespace \
  --wait
```

**What this does:**
- `-f values-aws.yaml`: Loads AWS-specific configuration
- `--set image.repository=$ECR_URL`: Sets the ECR image URL
- `--set config.s3Bucket=$S3_BUCKET`: Sets the S3 bucket name
- `--set serviceAccount.annotations...`: Sets IRSA role ARN
- `-n file-upload`: Deploys to `file-upload` namespace
- `--create-namespace`: Creates namespace if it doesn't exist
- `--wait`: Waits for deployment to be ready

### Option B: Install with Values File

1. **Edit values-aws.yaml:**
   ```bash
   nano values-aws.yaml
   ```

2. **Update these values:**
   ```yaml
   image:
     repository: "894002457387.dkr.ecr.us-east-1.amazonaws.com/file-upload-service"
     tag: "latest"
   
   config:
     s3Bucket: "your-bucket-name"
     awsRegion: "us-east-1"
   
   serviceAccount:
     annotations:
       eks.amazonaws.com/role-arn: "arn:aws:iam::894002457387:role/file-upload-cluster-file-upload-service"
   ```

3. **Install:**
   ```bash
   helm install file-upload-service . \
     -f values-aws.yaml \
     -n file-upload \
     --create-namespace \
     --wait
   ```

## Step 6: Verify Deployment

### Check Deployment Status

```bash
# Check pods
kubectl get pods -n file-upload

# Expected output:
# NAME                                  READY   STATUS    RESTARTS   AGE
# file-upload-service-xxxxx-xxxxx      1/1     Running   0          2m
# file-upload-service-xxxxx-xxxxx      1/1     Running   0          2m
```

### Check Services

```bash
kubectl get svc -n file-upload

# Expected:
# NAME                  TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)   AGE
# file-upload-service   ClusterIP   10.100.x.x      <none>        80/TCP    2m
```

### Check Ingress

```bash
kubectl get ingress -n file-upload

# Expected:
# NAME                          CLASS   HOSTS   ADDRESS                                                    PORTS   AGE
# file-upload-service-ingress   alb     *       k8s-fileuplo-xxxxx-xxxxx.us-east-1.elb.amazonaws.com   80      3m
```

### Check HPA

```bash
kubectl get hpa -n file-upload

# Expected:
# NAME                        REFERENCE                      TARGETS         MINPODS   MAXPODS   REPLICAS   AGE
# file-upload-service-hpa     Deployment/file-upload-service   70%/70%, 80%/80%   2         10        2          3m
```

## Step 7: Get Application URL

```bash
# Get ALB URL
ALB_URL=$(kubectl get ingress file-upload-service-ingress -n file-upload -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

echo "Application URL: http://$ALB_URL"
```

### Test the Application

```bash
# Health check
curl http://$ALB_URL/health

# Expected: {"status":"ok"}

# Ready check
curl http://$ALB_URL/ready

# Expected: {"status":"ready"}
```

## Step 8: View Logs

```bash
# View logs from all pods
kubectl logs -n file-upload -l app.kubernetes.io/name=file-upload-service --tail=50

# Follow logs
kubectl logs -n file-upload -l app.kubernetes.io/name=file-upload-service -f
```

## Upgrading the Deployment

### Update Image Tag

```bash
# Set new image tag
NEW_TAG="v1.2.3"

# Upgrade
helm upgrade file-upload-service . \
  -f values-aws.yaml \
  --set image.repository=$ECR_URL \
  --set image.tag=$NEW_TAG \
  --set config.s3Bucket=$S3_BUCKET \
  --set serviceAccount.annotations."eks\.amazonaws\.com/role-arn"=$IAM_ROLE_ARN \
  -n file-upload \
  --wait
```

### Update Configuration

```bash
helm upgrade file-upload-service . \
  -f values-aws.yaml \
  --set image.repository=$ECR_URL \
  --set config.s3Bucket=$S3_BUCKET \
  --set config.logLevel=debug \
  --set replicaCount=3 \
  --set serviceAccount.annotations."eks\.amazonaws\.com/role-arn"=$IAM_ROLE_ARN \
  -n file-upload
```

### Check Upgrade Status

```bash
# Check rollout status
kubectl rollout status deployment/file-upload-service -n file-upload

# View upgrade history
helm history file-upload-service -n file-upload
```

## Rolling Back

If something goes wrong, rollback to previous version:

```bash
# List releases
helm list -n file-upload

# Rollback to previous version
helm rollback file-upload-service -n file-upload

# Rollback to specific revision
helm rollback file-upload-service 2 -n file-upload
```

## Uninstalling

To remove the deployment:

```bash
helm uninstall file-upload-service -n file-upload
```

**Note:** This removes all resources created by the chart. The namespace will remain unless you delete it manually:

```bash
kubectl delete namespace file-upload
```

## Troubleshooting

### Pods Not Starting

```bash
# Check pod status
kubectl get pods -n file-upload

# Describe pod for details
kubectl describe pod <pod-name> -n file-upload

# Check events
kubectl get events -n file-upload --sort-by='.lastTimestamp'
```

### Image Pull Errors

```bash
# Verify image exists in ECR
aws ecr describe-images \
  --repository-name file-upload-service \
  --region us-east-1

# Check image pull secrets
kubectl get secrets -n file-upload
```

### Permission Errors

```bash
# Verify service account annotation
kubectl get serviceaccount file-upload-service -n file-upload -o yaml

# Check IAM role
aws iam get-role --role-name file-upload-cluster-file-upload-service
```

### Ingress Not Working

```bash
# Check ingress status
kubectl describe ingress file-upload-service-ingress -n file-upload

# Check ALB controller logs
kubectl logs -n kube-system -l app.kubernetes.io/name=aws-load-balancer-controller
```

### ServiceMonitor Errors

```bash
# Check if ServiceMonitor CRD exists
kubectl get crd servicemonitors.monitoring.coreos.com

# If not, install Prometheus Operator
./scripts/install-prometheus-operator.sh
```

## Next Steps

After successful deployment:

1. **Monitor the application:**
   - Check Prometheus metrics (if ServiceMonitor enabled)
   - View logs in CloudWatch
   - Monitor ALB metrics

2. **Test file upload:**
   ```bash
   curl -X POST -F "file=@test.txt" http://$ALB_URL/upload
   ```

3. **Scale the application:**
   ```bash
   helm upgrade file-upload-service . \
     -f values-aws.yaml \
     --set replicaCount=5 \
     -n file-upload
   ```

## Quick Reference

### Common Commands

```bash
# Install
helm install file-upload-service . -f values-aws.yaml [--set flags] -n file-upload

# Upgrade
helm upgrade file-upload-service . -f values-aws.yaml [--set flags] -n file-upload

# Uninstall
helm uninstall file-upload-service -n file-upload

# List releases
helm list -n file-upload

# Get values
helm get values file-upload-service -n file-upload

# Template (dry-run)
helm template file-upload-service . -f values-aws.yaml [--set flags]

# Lint
helm lint .
```

### Required Values

- `image.repository` - ECR/GCR/ACR URL
- `config.s3Bucket` - S3 bucket name (for AWS)
- `serviceAccount.annotations.eks.amazonaws.com/role-arn` - IAM role ARN (for AWS)

### Optional Values

- `image.tag` - Image tag (default: "latest")
- `replicaCount` - Number of replicas (default: 2)
- `config.logLevel` - Log level (default: "info")
- `autoscaling.enabled` - Enable HPA (default: true)
- `monitoring.serviceMonitor.enabled` - Enable ServiceMonitor (default: true)

