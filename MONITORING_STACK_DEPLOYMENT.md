# Monitoring Stack Deployment Guide

Step-by-step guide to deploy and test the monitoring stack (Prometheus, Grafana, Alertmanager) using ArgoCD.

## Prerequisites

1. ArgoCD installed and accessible
2. ArgoCD CLI installed and logged in
3. `kubectl` configured for your cluster
4. Helm dependencies updated for monitoring-stack chart

## Step 1: Prepare the Monitoring Namespace

```bash
# Create monitoring namespace (ArgoCD won't create it due to CreateNamespace=false)
kubectl create namespace monitoring

# Verify namespace exists
kubectl get namespace monitoring
```

## Step 2: Update Helm Dependencies

The monitoring-stack chart depends on `kube-prometheus-stack`. Update dependencies:

```bash
cd charts/monitoring-stack

# Update Helm dependencies
helm dependency update

# Verify dependencies are downloaded
ls charts/
# Should see: kube-prometheus-stack-*.tgz

cd ../..
```

**Note:** If you're deploying via ArgoCD from Git, make sure dependencies are committed or ArgoCD will download them automatically.

## Step 3: Deploy via ArgoCD CLI

### Option A: Deploy Individual Application (Recommended for First Time)

```bash
# Create the monitoring-stack application
argocd app create -f ci-cd/argocd/applications/monitoring-stack.yaml

# Or create manually with parameters
argocd app create monitoring-stack \
  --repo https://github.com/weipingli8910/k8s-file-upload-lab \
  --path charts/monitoring-stack \
  --dest-server https://kubernetes.default.svc \
  --dest-namespace monitoring \
  --revision main \
  --sync-policy automated \
  --self-heal \
  --auto-prune \
  --helm-set-file values-aws.yaml=charts/monitoring-stack/values-aws.yaml \
  --helm-set namespace.create=false
```

### Option B: Deploy via App-of-Apps (If Already Set Up)

If you have app-of-apps deployed, it should automatically pick up the monitoring-stack application:

```bash
# Check if app-of-apps exists
argocd app get app-of-apps

# Sync app-of-apps to pick up new applications
argocd app sync app-of-apps

# This will automatically create and sync monitoring-stack
```

## Step 4: Sync the Application

```bash
# Sync the monitoring-stack application
argocd app sync monitoring-stack --wait

# Check sync status
argocd app get monitoring-stack
```

## Step 5: Verify Deployment

### Check Application Status

```bash
# Check ArgoCD application status
argocd app get monitoring-stack

# Expected output should show:
# - Sync Status: Synced
# - Health Status: Healthy (or Progressing initially)
```

### Check Kubernetes Resources

```bash
# Check pods in monitoring namespace
kubectl get pods -n monitoring

# Expected pods:
# - prometheus-operator-*
# - prometheus-kube-prometheus-stack-prometheus-*
# - grafana-*
# - alertmanager-kube-prometheus-stack-alertmanager-*

# Check all resources
kubectl get all -n monitoring

# Check PersistentVolumeClaims (storage)
kubectl get pvc -n monitoring

# Check Services
kubectl get svc -n monitoring
```

### Wait for Pods to be Ready

```bash
# Wait for all pods to be ready (this may take 2-5 minutes)
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=kube-prometheus-stack-operator -n monitoring --timeout=300s
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=grafana -n monitoring --timeout=300s
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=prometheus -n monitoring --timeout=300s
```

## Step 6: Access Grafana

### Port Forward to Grafana

```bash
# Get Grafana service name
GRAFANA_SVC=$(kubectl get svc -n monitoring -l app.kubernetes.io/name=grafana -o jsonpath='{.items[0].metadata.name}')

# Port forward Grafana (runs in background)
kubectl port-forward -n monitoring svc/$GRAFANA_SVC 3000:80 &

# Access Grafana at: http://localhost:3000
```

### Login to Grafana

```bash
# Get Grafana admin credentials
kubectl get secret -n monitoring -l app.kubernetes.io/name=grafana -o jsonpath='{.items[0].data}' | jq .

# Or check values.yaml for default credentials:
# Default: admin / admin123
# (Change in production!)

# Login at http://localhost:3000
# Username: admin
# Password: admin123
```

### Verify Grafana Dashboards

1. Open http://localhost:3000
2. Login with admin/admin123
3. Go to **Dashboards** → **Browse**
4. You should see pre-configured Kubernetes dashboards:
   - Kubernetes / Compute Resources / Cluster
   - Kubernetes / Compute Resources / Namespace (Pods)
   - Kubernetes / Compute Resources / Pod
   - And more...

## Step 7: Access Prometheus

### Port Forward to Prometheus

```bash
# Get Prometheus service name
PROMETHEUS_SVC=$(kubectl get svc -n monitoring -l app.kubernetes.io/name=prometheus -o jsonpath='{.items[0].metadata.name}')

# Port forward Prometheus
kubectl port-forward -n monitoring svc/$PROMETHEUS_SVC 9090:9090 &

# Access Prometheus at: http://localhost:9090
```

### Verify Prometheus is Scraping

1. Open http://localhost:9090
2. Go to **Status** → **Targets**
3. You should see targets being scraped:
   - Kubernetes API server
   - Kubernetes nodes
   - Kubernetes pods
   - And more...

### Test Prometheus Queries

In Prometheus UI, try these queries:

```promql
# Check if file-upload-service is being scraped
up{job="file-upload-service"}

# Check pod CPU usage
rate(container_cpu_usage_seconds_total{namespace="file-upload"}[5m])

# Check pod memory usage
container_memory_usage_bytes{namespace="file-upload"}

# Check HTTP request rate
rate(http_requests_total{namespace="file-upload"}[5m])
```

## Step 8: Access Alertmanager

### Port Forward to Alertmanager

```bash
# Get Alertmanager service name
ALERTMANAGER_SVC=$(kubectl get svc -n monitoring -l app.kubernetes.io/name=alertmanager -o jsonpath='{.items[0].metadata.name}')

# Port forward Alertmanager
kubectl port-forward -n monitoring svc/$ALERTMANAGER_SVC 9093:9093 &

# Access Alertmanager at: http://localhost:9093
```

### Verify Alertmanager

1. Open http://localhost:9093
2. Check **Alerts** tab for any active alerts
3. Check **Status** → **Configuration** to see alert rules

## Step 9: Test Monitoring Integration

### Verify ServiceMonitor is Working

The file-upload-service should have a ServiceMonitor that Prometheus picks up:

```bash
# Check if ServiceMonitor exists
kubectl get servicemonitor -n file-upload

# Check Prometheus targets (should show file-upload-service)
# In Prometheus UI: Status → Targets
# Look for: file-upload-service/file-upload-service/0
```

### Generate Some Metrics

```bash
# Get the file-upload-service URL
FILE_UPLOAD_URL=$(kubectl get ingress -n file-upload -o jsonpath='{.items[0].status.loadBalancer.ingress[0].hostname}')

# Or if using port-forward:
kubectl port-forward -n file-upload svc/file-upload-service 8080:80 &

# Generate some traffic
curl http://localhost:8080/health
curl http://localhost:8080/metrics

# Upload a test file (if endpoint is available)
curl -X POST -F "file=@test.txt" http://localhost:8080/api/upload
```

### Verify Metrics in Prometheus

1. Go to Prometheus UI: http://localhost:9090
2. Try querying file-upload-service metrics:
   ```promql
   # HTTP requests
   http_requests_total{namespace="file-upload"}
   
   # Request duration
   http_request_duration_seconds{namespace="file-upload"}
   
   # File upload metrics (if exposed)
   file_upload_total{namespace="file-upload"}
   ```

### Verify Metrics in Grafana

1. Go to Grafana UI: http://localhost:3000
2. Create a new dashboard or use existing ones
3. Add panels with Prometheus queries
4. Visualize file-upload-service metrics

## Step 10: Test Alerts

### Check Alert Rules

```bash
# Check Prometheus rules
kubectl get prometheusrule -n monitoring

# View rule details
kubectl get prometheusrule -n monitoring -o yaml
```

### Trigger a Test Alert (Optional)

You can manually trigger alerts by:

1. **High CPU**: Scale down resources or increase load
2. **High Memory**: Create memory pressure
3. **Service Down**: Delete a pod temporarily
4. **High Error Rate**: Generate errors in the application

### Verify Alerts in Alertmanager

1. Go to Alertmanager UI: http://localhost:9093
2. Check **Alerts** tab
3. You should see alerts if conditions are met

## Troubleshooting

### Issue: Pods Not Starting

```bash
# Check pod status
kubectl get pods -n monitoring

# Check pod logs
kubectl logs -n monitoring -l app.kubernetes.io/name=prometheus-operator
kubectl logs -n monitoring -l app.kubernetes.io/name=grafana

# Check events
kubectl get events -n monitoring --sort-by='.lastTimestamp'
```

### Issue: PVC Not Created

```bash
# Check storage class
kubectl get storageclass

# If gp3 doesn't exist, update values-aws.yaml to use gp2
# Or create gp3 storage class for EKS
```

### Issue: ServiceMonitor Not Discovered

```bash
# Check ServiceMonitor exists
kubectl get servicemonitor -n file-upload

# Check Prometheus CRD
kubectl get prometheus -n monitoring

# Check Prometheus targets
# In Prometheus UI: Status → Service Discovery
```

### Issue: ArgoCD Sync Failing

```bash
# Check ArgoCD application status
argocd app get monitoring-stack

# Check sync logs
argocd app logs monitoring-stack

# Force sync
argocd app sync monitoring-stack --force
```

### Issue: Helm Dependencies Missing

```bash
# Update dependencies locally
cd charts/monitoring-stack
helm dependency update
helm dependency build

# Commit charts/ directory if needed
# Or ensure ArgoCD can download dependencies
```

## Quick Reference Commands

```bash
# Deploy
argocd app create -f ci-cd/argocd/applications/monitoring-stack.yaml
argocd app sync monitoring-stack --wait

# Check status
argocd app get monitoring-stack
kubectl get pods -n monitoring

# Access services
kubectl port-forward -n monitoring svc/kube-prometheus-stack-grafana 3000:80
kubectl port-forward -n monitoring svc/kube-prometheus-stack-prometheus 9090:9090
kubectl port-forward -n monitoring svc/kube-prometheus-stack-alertmanager 9093:9093

# Get credentials
kubectl get secret -n monitoring -l app.kubernetes.io/name=grafana -o jsonpath='{.items[0].data.admin-password}' | base64 -d

# Delete (if needed)
argocd app delete monitoring-stack --cascade
```

## Next Steps

1. ✅ Monitoring stack deployed
2. ✅ Grafana accessible
3. ✅ Prometheus scraping metrics
4. ✅ Alertmanager configured
5. 🔄 Create custom Grafana dashboards for file-upload-service
6. 🔄 Configure alert notifications (Slack, PagerDuty, etc.)
7. 🔄 Set up ServiceMonitor for file-upload-service (if not already done)
8. 🔄 Configure retention policies
9. 🔄 Set up backup for Prometheus data

## Security Notes

⚠️ **Important for Production:**

1. **Change Grafana password**: Update `values.yaml` or use secrets
2. **Enable authentication**: Configure OAuth or LDAP for Grafana
3. **Restrict access**: Use network policies to limit access
4. **Use TLS**: Enable TLS for all services
5. **Rotate credentials**: Regularly rotate admin passwords
6. **Monitor access**: Audit who accesses monitoring tools

