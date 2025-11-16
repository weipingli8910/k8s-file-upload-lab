# Step-by-Step Deployment Guide - Helm Charts & CI/CD

This guide walks you through deploying the file upload service using Helm charts with GitHub Actions and ArgoCD.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Infrastructure Setup](#infrastructure-setup)
3. [Deploy Monitoring Stack](#deploy-monitoring-stack)
4. [Deploy File Upload Service](#deploy-file-upload-service)
5. [CI/CD Setup](#cicd-setup)
6. [ArgoCD Setup](#argocd-setup)
7. [Verification](#verification)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Tools

```bash
# Verify installations
aws --version          # AWS CLI
kubectl version        # Kubernetes CLI
helm version           # Helm 3.x
terraform version      # Terraform
docker --version       # Docker
git --version          # Git
```

### AWS Configuration

```bash
# Configure AWS CLI
aws configure

# Verify access
aws sts get-caller-identity
```

### GitHub Repository

1. Fork or clone this repository
2. Update repository URLs in ArgoCD applications
3. Set up GitHub Secrets (see [CI/CD Setup](#cicd-setup))

## Infrastructure Setup

### Step 1: Deploy EKS Cluster

```bash
cd infrastructure/terraform

# Initialize Terraform
terraform init

# Review plan
terraform plan -var="s3_bucket_name=your-unique-bucket-name"

# Apply infrastructure
terraform apply -var="s3_bucket_name=your-unique-bucket-name"

# Note the outputs (you'll need these later):
# - ECR URL
# - S3 Bucket Name
# - IAM Role ARN
# - Cluster Name
```

### Step 2: Configure kubectl

```bash
# Get cluster name from Terraform output
CLUSTER_NAME=$(cd infrastructure/terraform && terraform output -raw cluster_name)
AWS_REGION=$(cd infrastructure/terraform && terraform output -raw aws_region || echo "us-east-1")

# Configure kubectl
aws eks update-kubeconfig --name $CLUSTER_NAME --region $AWS_REGION

# Verify access
kubectl get nodes
```

### Step 3: Install AWS Load Balancer Controller

```bash
cd scripts
./install-alb-controller.sh
```

Wait for the controller to be ready:
```bash
kubectl get pods -n kube-system | grep aws-load-balancer-controller
```

## Deploy Monitoring Stack

### Option A: Using Helm Script (Recommended)

```bash
./scripts/deploy-monitoring-with-helm.sh
```

### Option B: Manual Helm Deployment

```bash
cd charts/monitoring-stack

# Update dependencies
helm dependency update

# Install
helm install monitoring-stack . \
  -f values-aws.yaml \
  --set namespace.create=false \
  -n monitoring \
  --create-namespace \
  --wait --timeout=10m
```

### Verify Monitoring Stack

```bash
# Check pods
kubectl get pods -n monitoring

# Access Prometheus
kubectl port-forward -n monitoring svc/monitoring-stack-kube-prometheus-prometheus 9090:9090
# Open http://localhost:9090

# Access Grafana
kubectl port-forward -n monitoring svc/monitoring-stack-grafana 3000:80
# Open http://localhost:3000
# Username: admin
# Password: (get from secret or default: admin123)
```

## Deploy File Upload Service

### Option A: Using Helm Script (Recommended)

```bash
./scripts/deploy-with-helm.sh
```

### Option B: Manual Helm Deployment

```bash
# Get values from Terraform
cd infrastructure/terraform
ECR_URL=$(terraform output -raw ecr_url)
S3_BUCKET=$(terraform output -raw s3_bucket_name)
IAM_ROLE_ARN=$(terraform output -raw file_upload_service_role_arn)
AWS_REGION=$(terraform output -raw aws_region || echo "us-east-1")

# Deploy with Helm
cd ../../charts/file-upload-service
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
```

### Verify File Upload Service

```bash
# Check pods
kubectl get pods -n file-upload

# Check ingress
kubectl get ingress -n file-upload

# Get ALB URL
ALB_URL=$(kubectl get ingress file-upload-service-ingress -n file-upload -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
echo "Application URL: http://$ALB_URL"

# Test health endpoint
curl http://$ALB_URL/health
```

## CI/CD Setup

### Step 1: Configure GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions

Add the following secrets:

```
AWS_ACCESS_KEY_ID          # Your AWS access key
AWS_SECRET_ACCESS_KEY      # Your AWS secret key
ECR_URL                    # ECR repository URL (from Terraform output)
S3_BUCKET                  # S3 bucket name (from Terraform output)
IAM_ROLE_ARN              # IAM role ARN (from Terraform output)
```

**Get values from Terraform:**
```bash
cd infrastructure/terraform
terraform output -raw ecr_url
terraform output -raw s3_bucket_name
terraform output -raw file_upload_service_role_arn
```

### Step 2: Update GitHub Actions Workflows

The workflows are already configured in `.github/workflows/`:

- **`ci.yml`**: Runs tests, builds Docker image, security scans, Helm linting
- **`deploy.yml`**: Deploys to EKS (manual trigger or on main branch)

**Update repository URL in workflows if needed:**
```yaml
# In .github/workflows/deploy.yml
repoURL: https://github.com/your-org/k8s-file-upload-lab
```

### Step 3: Test CI Pipeline

```bash
# Push to a branch to trigger CI
git checkout -b test-ci
git add .
git commit -m "Test CI pipeline"
git push origin test-ci

# Create a PR to see CI results
```

### Step 4: Test Deployment Pipeline

```bash
# Merge to main or use workflow_dispatch
# Go to GitHub Actions → Deploy to EKS → Run workflow
```

## ArgoCD Setup

### Step 1: Install ArgoCD

```bash
# Create namespace
kubectl create namespace argocd

# Install ArgoCD
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Wait for ArgoCD to be ready
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=argocd-server -n argocd --timeout=300s

# Get admin password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
echo ""
```

### Step 2: Access ArgoCD UI

```bash
# Port forward
kubectl port-forward svc/argocd-server -n argocd 8080:443

# Open https://localhost:8080
# Username: admin
# Password: (from step above)
```

### Step 3: Update ArgoCD Applications

Edit `ci-cd/argocd/applications/file-upload-service.yaml`:

```yaml
source:
  repoURL: https://github.com/your-org/k8s-file-upload-lab  # Update this
  helm:
    parameters:
    - name: image.repository
      value: "your-ecr-url"  # Update with your ECR URL
    - name: config.s3Bucket
      value: "your-s3-bucket"  # Update with your S3 bucket
    - name: serviceAccount.annotations.eks\\.amazonaws\\.com/role-arn
      value: "your-iam-role-arn"  # Update with your IAM role ARN
```

Edit `ci-cd/argocd/applications/monitoring-stack.yaml`:

```yaml
source:
  repoURL: https://github.com/your-org/k8s-file-upload-lab  # Update this
```

### Step 4: Deploy ArgoCD Applications

**Option A: App of Apps Pattern (Recommended)**

```bash
# Deploy app-of-apps
kubectl apply -f ci-cd/argocd/app-of-apps.yaml

# This will automatically deploy all applications
```

**Option B: Individual Applications**

```bash
# Deploy monitoring stack
kubectl apply -f ci-cd/argocd/applications/monitoring-stack.yaml

# Deploy file upload service
kubectl apply -f ci-cd/argocd/applications/file-upload-service.yaml
```

### Step 5: Verify ArgoCD Sync

```bash
# Check applications
kubectl get applications -n argocd

# Check sync status
argocd app list

# Or use ArgoCD UI
# Go to Applications → Check sync status
```

## Verification

### Step 1: Verify Application

```bash
# Check pods
kubectl get pods -n file-upload

# Check services
kubectl get svc -n file-upload

# Check ingress
kubectl get ingress -n file-upload

# Get application URL
ALB_URL=$(kubectl get ingress file-upload-service-ingress -n file-upload -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
echo "Application URL: http://$ALB_URL"
```

### Step 2: Test Application

```bash
# Health check
curl http://$ALB_URL/health

# Upload a file
curl -X POST -F "file=@test.txt" http://$ALB_URL/upload

# List files
curl http://$ALB_URL/files
```

### Step 3: Verify Monitoring

```bash
# Check Prometheus targets
# In Prometheus UI: Status → Targets
# Should see file-upload-service target

# Check Grafana dashboards
# In Grafana UI: Explore → Query metrics
```

### Step 4: Verify CI/CD

```bash
# Check GitHub Actions
# Go to GitHub → Actions → Check workflow runs

# Check ArgoCD sync
# In ArgoCD UI: Applications → Check sync status
```

## CI/CD Workflow

### Development Flow

1. **Developer pushes code** → Triggers CI pipeline
2. **CI Pipeline**:
   - Runs tests
   - Builds Docker image (linux/amd64)
   - Pushes to ECR
   - Security scans
   - Lints Helm charts
3. **Merge to main** → Triggers deploy pipeline
4. **Deploy Pipeline**:
   - Updates Helm chart with new image tag
   - Deploys to EKS
5. **ArgoCD** (if enabled):
   - Detects changes in Git
   - Syncs application automatically

### ArgoCD Sync Flow

1. **Code pushed to main** → ArgoCD polls Git (every 3 minutes by default)
2. **ArgoCD detects changes** → Compares desired state (Git) vs actual state (cluster)
3. **ArgoCD syncs** → Applies Helm chart changes
4. **Application updated** → New version deployed

## Updating the Application

### Via Helm (Manual)

```bash
# Update image tag
helm upgrade file-upload-service charts/file-upload-service \
  -f charts/file-upload-service/values-aws.yaml \
  --set image.tag=v1.2.3 \
  -n file-upload
```

### Via Git (ArgoCD)

1. Update `ci-cd/argocd/applications/file-upload-service.yaml`:
   ```yaml
   helm:
     parameters:
     - name: image.tag
       value: "v1.2.3"
   ```
2. Commit and push
3. ArgoCD will automatically sync

### Via GitHub Actions

1. Push code → CI builds new image
2. Merge to main → Deploy workflow updates image tag
3. ArgoCD syncs automatically

## Troubleshooting

### Helm Chart Issues

```bash
# Lint chart
helm lint charts/file-upload-service

# Template chart (dry-run)
helm template test charts/file-upload-service \
  -f charts/file-upload-service/values-aws.yaml \
  --set image.repository=test-repo \
  --set config.s3Bucket=test-bucket

# Check release status
helm status file-upload-service -n file-upload

# View release history
helm history file-upload-service -n file-upload
```

### ArgoCD Issues

```bash
# Check application status
kubectl get application file-upload-service -n argocd -o yaml

# Check sync status
argocd app get file-upload-service

# Force sync
argocd app sync file-upload-service

# Check logs
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-application-controller
```

### CI/CD Issues

```bash
# Check GitHub Actions logs
# Go to GitHub → Actions → Select workflow run → View logs

# Check Docker image
aws ecr describe-images --repository-name file-upload-service --region us-east-1

# Check ECR permissions
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <ecr-url>
```

## Cleanup

### Remove Helm Releases

```bash
# Uninstall file upload service
helm uninstall file-upload-service -n file-upload

# Uninstall monitoring stack
helm uninstall monitoring-stack -n monitoring
```

### Remove ArgoCD Applications

```bash
# Delete applications
kubectl delete application file-upload-service -n argocd
kubectl delete application monitoring-stack -n argocd
kubectl delete application app-of-apps -n argocd
```

### Remove Infrastructure

```bash
cd infrastructure/terraform
terraform destroy
```

## Next Steps

1. **Customize Helm values**: Edit `values-aws.yaml` for your environment
2. **Add more environments**: Create `values-staging.yaml`, `values-prod.yaml`
3. **Configure alerts**: Update Prometheus rules and Alertmanager configs
4. **Set up notifications**: Configure webhook receivers in Alertmanager
5. **Import Grafana dashboards**: Add Kubernetes and application dashboards

## Additional Resources

- [Helm Chart Documentation](./charts/file-upload-service/README.md)
- [Monitoring Stack Documentation](./charts/monitoring-stack/README.md)
- [ArgoCD Documentation](https://argo-cd.readthedocs.io/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

