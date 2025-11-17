# ArgoCD CLI Guide - Deploying Applications

Complete guide for using ArgoCD CLI commands instead of `kubectl` for application management.

## Prerequisites

1. **Install ArgoCD CLI**:
   ```bash
   # macOS
   brew install argocd
   
   # Linux
   curl -sSL -o /usr/local/bin/argocd https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-amd64
   chmod +x /usr/local/bin/argocd
   ```

2. **Login to ArgoCD**:
   ```bash
   # Port forward ArgoCD server (if not already done)
   kubectl port-forward svc/argocd-server -n argocd 8080:443
   
   # Login (password from secret)
   argocd login localhost:8080 --username admin --insecure
   # Or get password:
   kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d && echo
   ```

## Application Management Commands

### 1. Create Application (Instead of `kubectl apply`)

**Using kubectl (old way):**
```bash
kubectl apply -f ci-cd/argocd/applications/file-upload-service.yaml
```

**Using ArgoCD CLI (recommended):**
```bash
# Create from YAML file
argocd app create -f ci-cd/argocd/applications/file-upload-service.yaml

# Or create directly with parameters
argocd app create file-upload-service \
  --repo https://github.com/weipingli8910/k8s-file-upload-lab \
  --path charts/file-upload-service \
  --dest-server https://kubernetes.default.svc \
  --dest-namespace file-upload \
  --revision main \
  --sync-policy automated \
  --self-heal \
  --auto-prune \
  --helm-set image.repository=894002457387.dkr.ecr.us-east-1.amazonaws.com/file-upload-service \
  --helm-set image.tag=latest \
  --helm-set config.s3Bucket=terraform-20251115065342088700000001 \
  --helm-set config.awsRegion=us-east-1
```

### 2. Sync Application (Deploy/Update)

**Using kubectl (old way):**
```bash
# No direct equivalent - would need to edit YAML and reapply
kubectl apply -f ci-cd/argocd/applications/file-upload-service.yaml
```

**Using ArgoCD CLI (recommended):**
```bash
# Sync application (deploys latest from Git)
argocd app sync file-upload-service

# Sync with specific revision
argocd app sync file-upload-service --revision <commit-sha>

# Sync and wait for completion
argocd app sync file-upload-service --wait

# Sync with force (overrides conflicts)
argocd app sync file-upload-service --force

# Sync and prune (removes resources not in Git)
argocd app sync file-upload-service --prune
```

### 3. Update Application Parameters

**Using kubectl (old way):**
```bash
# Edit YAML file
kubectl edit application file-upload-service -n argocd
# Or apply updated YAML
kubectl apply -f ci-cd/argocd/applications/file-upload-service.yaml
```

**Using ArgoCD CLI (recommended):**
```bash
# Update image tag
argocd app set file-upload-service \
  --helm-set image.tag=v1.2.3

# Update multiple parameters
argocd app set file-upload-service \
  --helm-set image.tag=latest \
  --helm-set config.s3Bucket=new-bucket-name \
  --helm-set replicaCount=3

# Update sync policy
argocd app set file-upload-service \
  --sync-policy automated \
  --self-heal \
  --auto-prune

# Update source revision
argocd app set file-upload-service \
  --revision main
```

### 4. Check Application Status

**Using kubectl (old way):**
```bash
kubectl get application file-upload-service -n argocd
kubectl describe application file-upload-service -n argocd
```

**Using ArgoCD CLI (recommended):**
```bash
# List all applications
argocd app list

# Get detailed status
argocd app get file-upload-service

# Get application manifest (what will be deployed)
argocd app manifests file-upload-service

# Get application parameters
argocd app get file-upload-service --show-params

# Check application health
argocd app get file-upload-service --health

# Check sync status
argocd app get file-upload-service --sync-status
```

### 5. Restart Application

**Using kubectl (old way):**
```bash
kubectl rollout restart deployment file-upload-service -n file-upload
```

**Using ArgoCD CLI (recommended):**
```bash
# Restart application (restarts all pods)
argocd app restart file-upload-service

# Restart specific resource
argocd app actions run file-upload-service restart \
  --kind Deployment \
  --resource-name file-upload-service \
  --namespace file-upload
```

### 6. Rollback Application

**Using kubectl (old way):**
```bash
kubectl rollout undo deployment file-upload-service -n file-upload
```

**Using ArgoCD CLI (recommended):**
```bash
# List application history
argocd app history file-upload-service

# Rollback to previous revision
argocd app rollback file-upload-service

# Rollback to specific revision
argocd app rollback file-upload-service <revision-id>
```

### 7. Delete Application

**Using kubectl (old way):**
```bash
kubectl delete application file-upload-service -n argocd
# Note: This can get stuck due to finalizers
```

**Using ArgoCD CLI (recommended):**
```bash
# Delete application (removes from ArgoCD)
argocd app delete file-upload-service

# Delete with cascade (removes managed resources)
argocd app delete file-upload-service --cascade

# Force delete (if stuck)
argocd app delete file-upload-service --cascade --force

# Delete without confirmation
argocd app delete file-upload-service --cascade --yes
```

## Complete Deployment Workflow

### Initial Setup

```bash
# 1. Create application from YAML
argocd app create -f ci-cd/argocd/applications/file-upload-service.yaml

# 2. Sync application (deploy)
argocd app sync file-upload-service --wait

# 3. Verify deployment
argocd app get file-upload-service
```

### Update Deployment

```bash
# 1. Update image tag
argocd app set file-upload-service --helm-set image.tag=v1.2.3

# 2. Sync changes
argocd app sync file-upload-service --wait

# 3. Verify
argocd app get file-upload-service
```

### Update from Git

```bash
# 1. Make changes in Git repository
git commit -m "Update deployment"
git push

# 2. ArgoCD auto-syncs (if enabled), or manually:
argocd app sync file-upload-service

# 3. Check status
argocd app get file-upload-service
```

## Comparison: ArgoCD CLI vs kubectl

| Operation | kubectl | ArgoCD CLI |
|-----------|---------|------------|
| **Create app** | `kubectl apply -f app.yaml` | `argocd app create -f app.yaml` |
| **Deploy/Update** | Edit YAML + `kubectl apply` | `argocd app sync <app>` |
| **Check status** | `kubectl get application` | `argocd app get <app>` |
| **Update params** | Edit YAML + apply | `argocd app set <app> --helm-set ...` |
| **Restart** | `kubectl rollout restart` | `argocd app restart <app>` |
| **Rollback** | `kubectl rollout undo` | `argocd app rollback <app>` |
| **Delete** | `kubectl delete application` | `argocd app delete <app> --cascade` |
| **GitOps** | ❌ Bypasses Git | ✅ Respects Git |
| **Drift detection** | ❌ No | ✅ Yes |
| **History** | ❌ Limited | ✅ Full revision history |

## Best Practices

### ✅ DO: Use ArgoCD CLI for Application Management

```bash
# Good: Use ArgoCD CLI
argocd app sync file-upload-service
argocd app set file-upload-service --helm-set image.tag=v1.2.3
argocd app delete file-upload-service --cascade
```

### ❌ DON'T: Use kubectl for ArgoCD-Managed Resources

```bash
# Avoid: Directly modifying ArgoCD-managed resources
kubectl edit deployment file-upload-service -n file-upload
kubectl scale deployment file-upload-service -n file-upload --replicas=3
```

**Why?** These changes will be reverted by ArgoCD's auto-sync/self-heal.

### ✅ DO: Use kubectl for Troubleshooting

```bash
# Good: Use kubectl for inspection/debugging
kubectl get pods -n file-upload
kubectl logs -n file-upload deployment/file-upload-service
kubectl describe pod -n file-upload <pod-name>
```

## Quick Reference

```bash
# Login
argocd login localhost:8080 --username admin --insecure

# List apps
argocd app list

# Get app details
argocd app get file-upload-service

# Sync (deploy)
argocd app sync file-upload-service --wait

# Update image
argocd app set file-upload-service --helm-set image.tag=latest

# Restart
argocd app restart file-upload-service

# Rollback
argocd app rollback file-upload-service

# Delete
argocd app delete file-upload-service --cascade
```

## Troubleshooting

### App Not Syncing

```bash
# Check app status
argocd app get file-upload-service

# Force sync
argocd app sync file-upload-service --force

# Check ArgoCD controller logs
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-application-controller
```

### App Stuck

```bash
# Check app status
argocd app get file-upload-service

# Force delete if needed
argocd app delete file-upload-service --cascade --force
```

## Additional Resources

- [ArgoCD CLI Documentation](https://argo-cd.readthedocs.io/en/stable/user-guide/commands/argocd_app/)
- [ArgoCD Application Management](https://argo-cd.readthedocs.io/en/stable/user-guide/application_management/)
- [ArgoCD Sync Policies](https://argo-cd.readthedocs.io/en/stable/user-guide/sync-policies/)

