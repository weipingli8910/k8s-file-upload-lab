# CI/CD Migration to Helm Charts

This document summarizes the changes made to migrate from raw Kubernetes manifests to Helm charts for CI/CD.

## What Changed

### 1. GitHub Actions Workflows

**Location**: `.github/workflows/`

**New Files**:
- `ci.yml`: Updated CI pipeline with Helm chart linting and templating
- `deploy.yml`: New deployment workflow using Helm charts

**Key Changes**:
- ✅ Docker builds now use `--platform linux/amd64` for EKS compatibility
- ✅ Added Helm chart linting job
- ✅ Added Helm chart templating validation
- ✅ Deployment uses Helm instead of raw kubectl apply

### 2. ArgoCD Applications

**Location**: `ci-cd/argocd/applications/`

**New Files**:
- `file-upload-service.yaml`: Helm-based ArgoCD application
- `monitoring-stack.yaml`: Helm-based monitoring stack application
- `app-of-apps.yaml`: App of Apps pattern for managing all applications

**Key Changes**:
- ✅ Applications now use Helm source type
- ✅ Helm values configured via ArgoCD parameters
- ✅ Supports multiple environments via values files

### 3. Documentation

**New Files**:
- `STEP_BY_STEP_HELM.md`: Comprehensive guide for Helm-based deployment with CI/CD
- `ci-cd/README.md`: CI/CD configuration documentation

**Updated Files**:
- `README.md`: Updated to show Helm as recommended approach

## Migration Path

### Option 1: Fresh Installation (Recommended)

Follow the new `STEP_BY_STEP_HELM.md` guide for a clean Helm-based setup.

### Option 2: Migrate Existing Deployment

1. **Backup current deployment**:
   ```bash
   kubectl get all -n file-upload -o yaml > backup.yaml
   ```

2. **Deploy with Helm**:
   ```bash
   ./scripts/deploy-with-helm.sh
   ```

3. **Verify deployment**:
   ```bash
   kubectl get pods -n file-upload
   ```

4. **Remove old manifests** (optional):
   ```bash
   # Only if you want to remove the old deployment
   kubectl delete -f kubernetes/
   ```

## CI/CD Flow Comparison

### Before (Raw Manifests)

```
Code Push → CI Build → kubectl apply → Manual sync
```

### After (Helm Charts)

```
Code Push → CI Build → Helm install/upgrade → ArgoCD auto-sync
```

## Benefits

1. **Versioning**: Helm charts are versioned
2. **Parameterization**: Easy environment-specific configurations
3. **Rollback**: Built-in Helm rollback capability
4. **GitOps**: ArgoCD manages Helm releases automatically
5. **Multi-Environment**: Easy to deploy to dev/staging/prod

## Backward Compatibility

- ✅ Original Kubernetes manifests still work (`kubernetes/` directory)
- ✅ Legacy deployment scripts still available (`deploy-app.sh`)
- ✅ Old ArgoCD application kept for reference

## Next Steps

1. **Set up GitHub Secrets** (see `STEP_BY_STEP_HELM.md`)
2. **Install ArgoCD** (if not already installed)
3. **Deploy ArgoCD applications**
4. **Test CI/CD pipeline**
5. **Configure webhooks** for instant ArgoCD sync

## Troubleshooting

See `STEP_BY_STEP_HELM.md` for detailed troubleshooting steps.

