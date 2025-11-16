# Monitoring Stack Helm Chart Deployment Guide

This guide provides step-by-step instructions for deploying the monitoring stack using Helm chart.

## Prerequisites

Before starting, ensure you have:

1. ✅ Kubernetes cluster (EKS/GKE/AKS) with `kubectl` configured
2. ✅ Helm 3.x installed (`helm version`)
3. ✅ For AWS EKS: EBS CSI driver installed (for persistent volumes)
4. ✅ Sufficient cluster resources (recommended: 4+ nodes, 8GB+ RAM per node)

## Step 1: Verify Prerequisites

### Check kubectl Access

```bash
kubectl get nodes
```

Expected output: List of cluster nodes

### Check Helm Installation

```bash
helm version
```

Expected: `version.BuildInfo{Version:"v3.x.x", ...}`

### Check Storage Class (AWS EKS)

```bash
kubectl get storageclass
```

Expected: `gp2` or `gp3` storage class available

If not available, install EBS CSI driver:
```bash
# For AWS EKS
kubectl apply -k "github.com/kubernetes-sigs/aws-ebs-csi-driver/deploy/kubernetes/overlays/stable/?ref=release-1.28"
```

## Step 2: Navigate to Chart Directory

```bash
cd /Users/weipingli8910/code/playgrounds/k8s-file-upload-lab/charts/monitoring-stack
```

## Step 3: Update Helm Dependencies

The chart depends on `kube-prometheus-stack`. Download it:

```bash
helm dependency update
```

Expected output:
```
Hang tight while we grab the latest from your chart repositories...
...Successfully got an update from the "prometheus-community" chart repository
Update Complete. ⎈Happy Helming!⎈
Saving 1 charts
Downloading kube-prometheus-stack from repo https://prometheus-community.github.io/helm-charts
```

This creates a `charts/` directory with the downloaded chart.

## Step 4: Validate Chart

Before deploying, validate the chart:

```bash
# Lint the chart
helm lint .

# Template the chart (dry-run)
helm template monitoring-stack . \
  -f values-aws.yaml \
  --dry-run --debug | head -50
```

## Step 5: Install the Chart

### Option A: Install with AWS Values (Recommended)

```bash
helm install monitoring-stack . \
  -f values-aws.yaml \
  -n monitoring \
  --create-namespace \
  --wait --timeout=10m
```

**What this does:**
- `-f values-aws.yaml`: Loads AWS-specific configuration
- `-n monitoring`: Deploys to `monitoring` namespace
- `--create-namespace`: Creates namespace if it doesn't exist
- `--wait`: Waits for all resources to be ready
- `--timeout=10m`: Sets timeout to 10 minutes

### Option B: Install with Custom Values

```bash
# Edit values if needed
nano values-aws.yaml

# Install
helm install monitoring-stack . \
  -f values-aws.yaml \
  -n monitoring \
  --create-namespace \
  --wait --timeout=10m
```

## Step 6: Verify Installation

### Check Pods

```bash
kubectl get pods -n monitoring

# Expected output (after a few minutes):
# NAME                                                     READY   STATUS    RESTARTS   AGE
# alertmanager-monitoring-stack-kube-prometheus-alertmanager-0   2/2     Running   0          5m
# monitoring-stack-kube-prometheus-operator-xxxxx         1/1     Running   0          5m
# monitoring-stack-kube-prometheus-prometheus-0           2/2     Running   0          5m
# monitoring-stack-grafana-xxxxx                          1/1     Running   0          5m
```

### Check Services

```bash
kubectl get svc -n monitoring

# Expected:
# NAME                                                     TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)    AGE
# alertmanager-operated                                    ClusterIP   None            <none>        9093/TCP   5m
# monitoring-stack-kube-prometheus-alertmanager            ClusterIP   10.100.x.x      <none>        9093/TCP   5m
# monitoring-stack-kube-prometheus-operator                ClusterIP   10.100.x.x      <none>        8080/TCP   5m
# monitoring-stack-kube-prometheus-prometheus              ClusterIP   10.100.x.x      <none>        9090/TCP   5m
# monitoring-stack-grafana                                 ClusterIP   10.100.x.x      <none>        80/TCP     5m
```

### Check CRDs

```bash
kubectl get crd | grep monitoring.coreos.com

# Expected:
# alertmanagerconfigs.monitoring.coreos.com
# alertmanagers.monitoring.coreos.com
# podmonitors.monitoring.coreos.com
# prometheuses.monitoring.coreos.com
# prometheusrules.monitoring.coreos.com
# servicemonitors.monitoring.coreos.com
```

### Check Persistent Volumes

```bash
kubectl get pvc -n monitoring

# Expected:
# NAME                                                      STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS   AGE
# alertmanager-monitoring-stack-kube-prometheus-alertmanager-db-alertmanager-monitoring-stack-kube-prometheus-alertmanager-0   Bound    pvc-xxxxx   2Gi        RWO            gp3           5m
# monitoring-stack-kube-prometheus-prometheus-db-monitoring-stack-kube-prometheus-prometheus-0   Bound    pvc-xxxxx   20Gi       RWO            gp3           5m
# monitoring-stack-grafana                                  Bound    pvc-xxxxx   10Gi       RWO            gp3           5m
```

## Step 7: Access the UIs

### Prometheus UI

```bash
# Port forward
kubectl port-forward -n monitoring svc/monitoring-stack-kube-prometheus-prometheus 9090:9090

# Open http://localhost:9090 in your browser
```

**Test queries:**
- `up{namespace="file-upload"}` - Check if file-upload-service is up
- `rate(container_cpu_usage_seconds_total{namespace="file-upload"}[5m])` - CPU usage

### Grafana UI

```bash
# Get admin password
kubectl get secret monitoring-stack-grafana -n monitoring -o jsonpath='{.data.admin-password}' | base64 -d
echo ""  # New line

# Port forward
kubectl port-forward -n monitoring svc/monitoring-stack-grafana 3000:80

# Open http://localhost:3000 in your browser
# Username: admin
# Password: (from command above, or default: admin123)
```

**First login:**
1. Login with admin/admin123 (or password from secret)
2. Change password when prompted
3. Explore pre-configured dashboards

### Alertmanager UI

```bash
# Port forward
kubectl port-forward -n monitoring svc/monitoring-stack-kube-prometheus-alertmanager 9093:9093

# Open http://localhost:9093 in your browser
```

## Step 8: Verify Prometheus Rules

```bash
# Check PrometheusRule
kubectl get prometheusrule -n monitoring

# Expected:
# NAME                                          AGE
# monitoring-stack-file-upload-rules           5m

# View the rules
kubectl get prometheusrule monitoring-stack-file-upload-rules -n monitoring -o yaml
```

## Step 9: Verify ServiceMonitor Discovery

After deploying the file-upload-service with its ServiceMonitor:

```bash
# Check ServiceMonitor
kubectl get servicemonitor -n file-upload

# In Prometheus UI: Status -> Targets
# You should see file-upload-service target
```

## Upgrading

### Update Dependencies

```bash
cd charts/monitoring-stack
helm dependency update
```

### Upgrade Chart

```bash
helm upgrade monitoring-stack . \
  -f values-aws.yaml \
  -n monitoring \
  --wait --timeout=10m
```

### Check Upgrade Status

```bash
# Check release status
helm status monitoring-stack -n monitoring

# View upgrade history
helm history monitoring-stack -n monitoring
```

## Configuration Changes

### Change Grafana Password

```bash
# Generate new password
NEW_PASSWORD="your-secure-password"

# Upgrade with new password
helm upgrade monitoring-stack . \
  -f values-aws.yaml \
  --set kube-prometheus-stack.grafana.adminPassword=$NEW_PASSWORD \
  -n monitoring
```

### Increase Storage

```bash
helm upgrade monitoring-stack . \
  -f values-aws.yaml \
  --set kube-prometheus-stack.prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=50Gi \
  -n monitoring
```

### Customize Prometheus Rules

1. Edit `values.yaml` under `prometheusRules.rules.fileUploadService.groups`
2. Upgrade the chart:
   ```bash
   helm upgrade monitoring-stack . \
     -f values-aws.yaml \
     -n monitoring
   ```

## Rolling Back

If something goes wrong:

```bash
# List releases
helm list -n monitoring

# Rollback to previous version
helm rollback monitoring-stack -n monitoring

# Rollback to specific revision
helm rollback monitoring-stack 2 -n monitoring
```

## Uninstalling

To remove the monitoring stack:

```bash
helm uninstall monitoring-stack -n monitoring
```

**Note:** This removes all monitoring resources. Persistent volumes will remain unless deleted manually:

```bash
# Delete PVCs (optional)
kubectl delete pvc -n monitoring --all

# Delete namespace (optional)
kubectl delete namespace monitoring
```

## Troubleshooting

### Pods Stuck in Pending

```bash
# Check pod events
kubectl describe pod <pod-name> -n monitoring

# Common issue: PVC not bound
kubectl get pvc -n monitoring
```

### Storage Class Issues

```bash
# Check available storage classes
kubectl get storageclass

# If gp3 not available, use gp2
helm upgrade monitoring-stack . \
  -f values-aws.yaml \
  --set kube-prometheus-stack.prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.storageClassName=gp2 \
  -n monitoring
```

### CRDs Not Installed

```bash
# Wait for CRDs
kubectl wait --for=condition=Established crd servicemonitors.monitoring.coreos.com --timeout=120s

# Check Prometheus Operator logs
kubectl logs -n monitoring -l app.kubernetes.io/name=prometheus-operator
```

### Prometheus Not Scraping

```bash
# Check ServiceMonitor
kubectl get servicemonitor -A

# Check Prometheus targets
# In Prometheus UI: Status -> Targets
# Look for errors
```

### High Resource Usage

```bash
# Check resource usage
kubectl top pods -n monitoring

# Adjust resources in values.yaml
helm upgrade monitoring-stack . \
  -f values-aws.yaml \
  --set kube-prometheus-stack.prometheus.prometheusSpec.resources.limits.memory=4Gi \
  -n monitoring
```

## Quick Reference

### Common Commands

```bash
# Install
helm install monitoring-stack . -f values-aws.yaml -n monitoring --create-namespace

# Upgrade
helm upgrade monitoring-stack . -f values-aws.yaml -n monitoring

# Uninstall
helm uninstall monitoring-stack -n monitoring

# List releases
helm list -n monitoring

# Get values
helm get values monitoring-stack -n monitoring

# Template (dry-run)
helm template monitoring-stack . -f values-aws.yaml

# Lint
helm lint .
```

### Access UIs

```bash
# Prometheus
kubectl port-forward -n monitoring svc/monitoring-stack-kube-prometheus-prometheus 9090:9090

# Grafana
kubectl port-forward -n monitoring svc/monitoring-stack-grafana 3000:80

# Alertmanager
kubectl port-forward -n monitoring svc/monitoring-stack-kube-prometheus-alertmanager 9093:9093
```

## Next Steps

1. **Import Grafana Dashboards**: Import Kubernetes and application dashboards
2. **Configure Alerts**: Set up webhook receivers for notifications
3. **Monitor Resources**: Watch Prometheus and Grafana resource usage
4. **Set Up ServiceMonitors**: Ensure all services have ServiceMonitors

