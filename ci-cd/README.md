# CI/CD Configuration

This directory contains CI/CD configurations for GitHub Actions and ArgoCD.

## Structure

```
ci-cd/
├── github-actions/      # Legacy GitHub Actions (moved to .github/workflows)
│   └── ci.yml
├── argocd/             # ArgoCD applications
│   ├── applications/
│   │   ├── file-upload-service.yaml
│   │   └── monitoring-stack.yaml
│   └── app-of-apps.yaml
└── jenkins/            # Jenkins pipelines
    └── Jenkinsfile
```

## GitHub Actions

Workflows are located in `.github/workflows/`:

- **`ci.yml`**: Continuous Integration
  - Runs tests
  - Builds Docker image (linux/amd64)
  - Pushes to ECR
  - Security scanning (Trivy)
  - Helm chart linting

- **`deploy.yml`**: Deployment
  - Deploys to EKS using Helm
  - Can be triggered manually or on push to main

### Setup

1. **Add GitHub Secrets**:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `ECR_URL` (from Terraform output)
   - `S3_BUCKET` (from Terraform output)
   - `IAM_ROLE_ARN` (from Terraform output)

2. **Update repository URL** in workflows if needed

3. **Push code** to trigger CI pipeline

## ArgoCD

### Applications

- **`file-upload-service.yaml`**: File upload service application
- **`monitoring-stack.yaml`**: Monitoring stack application
- **`app-of-apps.yaml`**: App of Apps pattern (deploys all applications)

### Setup

1. **Install ArgoCD**:
   ```bash
   kubectl create namespace argocd
   kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
   ```

2. **Update repository URL** in application files:
   ```yaml
   source:
     repoURL: https://github.com/your-org/k8s-file-upload-lab
   ```

3. **Update Helm values** in `file-upload-service.yaml`:
   - ECR URL
   - S3 Bucket
   - IAM Role ARN

4. **Deploy applications**:
   ```bash
   # Option A: App of Apps (recommended)
   kubectl apply -f ci-cd/argocd/app-of-apps.yaml
   
   # Option B: Individual applications
   kubectl apply -f ci-cd/argocd/applications/file-upload-service.yaml
   kubectl apply -f ci-cd/argocd/applications/monitoring-stack.yaml
   ```

### Access ArgoCD UI

```bash
# Port forward
kubectl port-forward svc/argocd-server -n argocd 8080:443

# Get admin password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d

# Open https://localhost:8080
# Username: admin
```

## CI/CD Flow

### Development Flow

1. **Developer pushes code** → Triggers CI pipeline
2. **CI Pipeline**:
   - Tests code
   - Builds Docker image
   - Pushes to ECR
   - Security scans
   - Lints Helm charts
3. **Merge to main** → Triggers deploy pipeline
4. **Deploy Pipeline**:
   - Updates Helm chart with new image
   - Deploys to EKS
5. **ArgoCD** (if enabled):
   - Detects Git changes
   - Syncs application automatically

### ArgoCD Sync

- **Polling**: ArgoCD polls Git every 3 minutes (default)
- **Webhook**: Can configure webhook for instant sync
- **Manual**: Use ArgoCD UI or CLI to sync manually

## Configuration

### GitHub Actions

Edit `.github/workflows/ci.yml` and `.github/workflows/deploy.yml` to customize:
- Build steps
- Deployment environments
- Image tags
- Notification settings

### ArgoCD

Edit `ci-cd/argocd/applications/*.yaml` to customize:
- Helm values
- Sync policies
- Resource limits
- Health checks

## Troubleshooting

### GitHub Actions

- Check workflow logs in GitHub UI
- Verify secrets are set correctly
- Check AWS permissions
- Verify ECR access

### ArgoCD

```bash
# Check application status
kubectl get application -n argocd

# Check sync status
argocd app get file-upload-service

# Force sync
argocd app sync file-upload-service

# Check logs
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-application-controller
```

## Next Steps

1. Configure webhook for ArgoCD (instant sync)
2. Set up notifications (Slack, email)
3. Add more environments (staging, production)
4. Configure canary deployments
5. Set up monitoring and alerting for CI/CD

