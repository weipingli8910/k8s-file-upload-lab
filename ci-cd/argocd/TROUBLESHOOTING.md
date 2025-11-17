# ArgoCD Troubleshooting Guide

Comprehensive guide for troubleshooting and deleting ArgoCD applications, especially when they get stuck.

## Table of Contents

1. [Common Issues](#common-issues)
2. [Proper Deletion Methods](#proper-deletion-methods)
3. [Troubleshooting Stuck Applications](#troubleshooting-stuck-applications)
4. [App-of-Apps Pattern](#app-of-apps-pattern)
5. [Prevention Tips](#prevention-tips)
6. [Quick Reference](#quick-reference)

## Common Issues

### Issue 1: Application Stuck in Deletion

**Symptoms:**
- `kubectl delete` hangs forever
- Application shows `deletionTimestamp` but never completes
- Application remains in list after `argocd app delete`

**Cause:**
- Finalizer (`resources-finalizer.argocd.argoproj.io`) blocking deletion
- ArgoCD controller not processing deletion
- Managed resources not cleaning up properly

### Issue 2: Application Shows "OutOfSync" or "Missing"

**Symptoms:**
- Application status: `OutOfSync` or `Missing`
- Health status: `Missing` or `Degraded`
- Resources exist but ArgoCD can't sync them

**Cause:**
- Resources manually modified outside ArgoCD
- Git repository changes not reflected
- ArgoCD controller issues
- Resource conflicts

### Issue 3: App-of-Apps Recreating Deleted Apps

**Symptoms:**
- Delete an app, it comes back
- App keeps getting recreated
- Multiple instances of same app

**Cause:**
- App-of-apps pattern with auto-sync enabled
- Application definition still in Git
- ArgoCD detecting drift and recreating

## Proper Deletion Methods

### Method 1: ArgoCD CLI (Recommended - Try This First)

**Standard Delete:**
```bash
argocd app delete <app-name>
```

**Delete with Cascade (Removes Managed Resources):**
```bash
argocd app delete <app-name> --cascade
```

**Force Delete (If Stuck):**
```bash
argocd app delete <app-name> --cascade --force
```

**Delete with Confirmation Skip:**
```bash
argocd app delete <app-name> --cascade --yes
```

**Example:**
```bash
# Delete monitoring-stack
argocd app delete monitoring-stack --cascade --force

# Delete file-upload-service
argocd app delete file-upload-service --cascade
```

**Why This is Best:**
- ArgoCD handles finalizers automatically
- Properly cleans up managed resources
- Safe and controlled deletion
- Maintains audit trail

### Method 2: kubectl with Finalizer Removal (When CLI Doesn't Work)

**Step 1: Remove Finalizer Using Patch**
```bash
kubectl patch application <app-name> -n argocd \
  --type json \
  -p='[{"op": "remove", "path": "/metadata/finalizers"}]'
```

**Step 2: Delete Application**
```bash
kubectl delete application <app-name> -n argocd
```

**Example:**
```bash
# Remove finalizer
kubectl patch application monitoring-stack -n argocd \
  --type json \
  -p='[{"op": "remove", "path": "/metadata/finalizers"}]'

# Delete
kubectl delete application monitoring-stack -n argocd
```

**Alternative: Using jq (If Application Definition is Large)**
```bash
# Get application, remove finalizer, replace
kubectl get application <app-name> -n argocd -o json | \
  jq 'del(.metadata.finalizers)' | \
  kubectl replace -f -

# Then delete
kubectl delete application <app-name> -n argocd
```

### Method 3: Force Delete (Last Resort)

**When to Use:**
- Application completely stuck
- ArgoCD controller not responding
- Need immediate deletion

**Steps:**
```bash
# 1. Remove finalizer
kubectl patch application <app-name> -n argocd \
  --type json \
  -p='[{"op": "remove", "path": "/metadata/finalizers"}]'

# 2. Force delete
kubectl delete application <app-name> -n argocd \
  --force \
  --grace-period=0
```

**Warning:** Force delete doesn't wait for confirmation. Resources may continue running.

### Method 4: Manual Edit (For Complex Cases)

**Steps:**
```bash
# 1. Edit application
kubectl edit application <app-name> -n argocd

# 2. Remove the finalizers section:
#    Delete these lines:
#    finalizers:
#      - resources-finalizer.argocd.argoproj.io

# 3. Save and exit

# 4. Delete
kubectl delete application <app-name> -n argocd
```

## Troubleshooting Stuck Applications

### Step 1: Check Application Status

```bash
# List all applications
argocd app list

# Get detailed status
argocd app get <app-name>

# Check with kubectl
kubectl get application <app-name> -n argocd -o yaml
```

### Step 2: Check for Finalizers

```bash
# Check if finalizer exists
kubectl get application <app-name> -n argocd -o jsonpath='{.metadata.finalizers}'

# Should show: resources-finalizer.argoproj.io
# If empty, finalizer already removed
```

### Step 3: Check Deletion Timestamp

```bash
# Check if in deletion state
kubectl get application <app-name> -n argocd -o jsonpath='{.metadata.deletionTimestamp}'

# If shows a timestamp, app is stuck in deletion
```

### Step 4: Check ArgoCD Controller

```bash
# Check if ArgoCD controller is running
kubectl get pods -n argocd | grep application-controller

# Check controller logs
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-application-controller --tail=50
```

### Step 5: Check Managed Resources

```bash
# List resources managed by the app
argocd app resources <app-name>

# Check if resources are stuck
kubectl get all -n <namespace>
```

## App-of-Apps Pattern

### Understanding App-of-Apps

When using app-of-apps pattern, child applications are managed by the parent. Deleting them requires special care.

### Deleting App-of-Apps Applications

**Step 1: Disable Auto-Sync (If Enabled)**
```bash
# Get app-of-apps
argocd app get app-of-apps

# Disable auto-sync
argocd app set app-of-apps --sync-policy none
```

**Step 2: Delete Child Applications First**
```bash
# List child apps
argocd app list

# Delete each child app
argocd app delete <child-app-1> --cascade
argocd app delete <child-app-2> --cascade
```

**Step 3: Delete Parent Application**
```bash
argocd app delete app-of-apps --cascade
```

**Step 4: If Child Apps Keep Reappearing**

The app-of-apps might be recreating them. Check:

```bash
# Check if app-of-apps still exists
kubectl get application app-of-apps -n argocd

# If it exists and has auto-sync, disable it first
argocd app set app-of-apps --sync-policy none

# Then delete child apps
argocd app delete <child-app> --cascade --force
```

### Deleting App-of-Apps Itself

**If app-of-apps is stuck:**

```bash
# 1. Remove finalizer
kubectl patch application app-of-apps -n argocd \
  --type json \
  -p='[{"op": "remove", "path": "/metadata/finalizers"}]'

# 2. Delete
kubectl delete application app-of-apps -n argocd

# 3. Verify child apps are also deleted
argocd app list
```

## Prevention Tips

### 1. Always Use ArgoCD CLI for Deletion

```bash
# Good
argocd app delete <app-name> --cascade

# Avoid (unless necessary)
kubectl delete application <app-name> -n argocd
```

### 2. Delete Child Apps Before Parent

For app-of-apps pattern:
1. Delete child applications first
2. Then delete parent application
3. Or disable auto-sync before deletion

### 3. Check Application Status Before Deletion

```bash
# Check status
argocd app get <app-name>

# Ensure it's in good state before deleting
# Fix any issues first
```

### 4. Use Cascade Flag

Always use `--cascade` to ensure managed resources are cleaned up:

```bash
argocd app delete <app-name> --cascade
```

### 5. Monitor ArgoCD Controller Health

```bash
# Check controller status
kubectl get pods -n argocd -l app.kubernetes.io/name=argocd-application-controller

# Restart if needed
kubectl delete pod -n argocd -l app.kubernetes.io/name=argocd-application-controller
```

## Quick Reference

### Delete Application (Normal Case)
```bash
argocd app delete <app-name> --cascade
```

### Delete Application (Stuck Case)
```bash
# Remove finalizer
kubectl patch application <app-name> -n argocd \
  --type json \
  -p='[{"op": "remove", "path": "/metadata/finalizers"}]'

# Delete
kubectl delete application <app-name> -n argocd
```

### Delete App-of-Apps
```bash
# 1. Disable auto-sync
argocd app set app-of-apps --sync-policy none

# 2. Delete child apps
argocd app delete <child-app> --cascade

# 3. Delete parent
argocd app delete app-of-apps --cascade
```

### Check Application Status
```bash
# List all apps
argocd app list

# Get app details
argocd app get <app-name>

# Check with kubectl
kubectl get application <app-name> -n argocd
```

### Restart ArgoCD Application
```bash
# Restart app
argocd app restart <app-name>

# Restart and sync
argocd app restart <app-name> && argocd app sync <app-name>
```

## Common Error Messages

### "Resource not accessible by integration"
- **Cause:** Missing permissions
- **Fix:** Check ArgoCD service account permissions

### "Application is being deleted"
- **Cause:** Already in deletion state
- **Fix:** Remove finalizer and force delete

### "Application already exists"
- **Cause:** App-of-apps recreating it
- **Fix:** Disable auto-sync on app-of-apps first

### "Finalizer timeout"
- **Cause:** ArgoCD controller not processing
- **Fix:** Check controller health, remove finalizer manually

## Emergency Procedures

### Complete ArgoCD Reset (Nuclear Option)

**Warning:** This deletes ALL ArgoCD applications!

```bash
# 1. List all apps
argocd app list -o name

# 2. Delete all apps (be careful!)
argocd app list -o name | xargs -I {} argocd app delete {} --cascade --force

# 3. If apps are stuck, remove all finalizers
kubectl get application -n argocd -o json | \
  jq '.items[] | select(.metadata.finalizers != null) | .metadata.name' | \
  xargs -I {} kubectl patch application {} -n argocd \
    --type json \
    -p='[{"op": "remove", "path": "/metadata/finalizers"}]'

# 4. Delete all applications
kubectl delete application --all -n argocd
```

## Additional Resources

- [ArgoCD CLI Documentation](https://argo-cd.readthedocs.io/en/stable/user-guide/commands/argocd_app/)
- [ArgoCD Troubleshooting](https://argo-cd.readthedocs.io/en/stable/operator-manual/troubleshooting/)
- [Kubernetes Finalizers](https://kubernetes.io/docs/concepts/overview/working-with-objects/finalizers/)

## Summary

**For Normal Deletion:**
```bash
argocd app delete <app-name> --cascade
```

**For Stuck Applications:**
```bash
kubectl patch application <app-name> -n argocd \
  --type json \
  -p='[{"op": "remove", "path": "/metadata/finalizers"}]'
kubectl delete application <app-name> -n argocd
```

**For App-of-Apps:**
1. Disable auto-sync
2. Delete child apps
3. Delete parent app

Remember: Always try ArgoCD CLI first, then fall back to kubectl with finalizer removal if needed.

