# Monitoring Stack Helm Chart

This Helm chart deploys a complete monitoring stack including Prometheus, Grafana, and Alertmanager using the kube-prometheus-stack.

## Prerequisites

- Kubernetes 1.20+
- Helm 3.0+
- kubectl configured to access your cluster
- For AWS EKS: EBS CSI driver installed (for persistent volumes)

## Installation

### Quick Start (AWS EKS)

```bash
cd charts/monitoring-stack

# Update Helm dependencies
helm dependency update

# Install the monitoring stack
helm install monitoring-stack . \
  -f values-aws.yaml \
  -n monitoring \
  --create-namespace \
  --wait --timeout=10m
```

### Step-by-Step Installation

#### Step 1: Update Dependencies

```bash
cd charts/monitoring-stack
helm dependency update
```

This downloads the kube-prometheus-stack chart.

#### Step 2: Install the Chart

```bash
helm install monitoring-stack . \
  -f values-aws.yaml \
  -n monitoring \
  --create-namespace \
  --wait --timeout=10m
```

#### Step 3: Verify Installation

```bash
# Check pods
kubectl get pods -n monitoring

# Expected output:
# NAME                                                     READY   STATUS    RESTARTS   AGE
# alertmanager-monitoring-stack-kube-prometheus-alertmanager-0   2/2     Running   0          2m
# monitoring-stack-kube-prometheus-operator-xxxxx         1/1     Running   0          2m
# monitoring-stack-kube-prometheus-prometheus-0           2/2     Running   0          2m
# monitoring-stack-grafana-xxxxx                          1/1     Running   0          2m

# Check services
kubectl get svc -n monitoring

# Check CRDs
kubectl get crd | grep monitoring.coreos.com
```

## Accessing the UIs

### Prometheus

```bash
# Port forward
kubectl port-forward -n monitoring svc/monitoring-stack-kube-prometheus-prometheus 9090:9090

# Open http://localhost:9090
```

### Grafana

```bash
# Get admin password
kubectl get secret monitoring-stack-grafana -n monitoring -o jsonpath='{.data.admin-password}' | base64 -d

# Port forward
kubectl port-forward -n monitoring svc/monitoring-stack-grafana 3000:80

# Open http://localhost:3000
# Username: admin
# Password: (from command above, or default: admin123)
```

### Alertmanager

```bash
# Port forward
kubectl port-forward -n monitoring svc/monitoring-stack-kube-prometheus-alertmanager 9093:9093

# Open http://localhost:9093
```

## Configuration

### Key Values

| Parameter | Description | Default |
|-----------|-------------|---------|
| `prometheusOperator.enabled` | Enable kube-prometheus-stack | `true` |
| `kube-prometheus-stack.prometheus.prometheusSpec.retention` | Data retention | `15d` |
| `kube-prometheus-stack.grafana.adminPassword` | Grafana admin password | `admin123` |
| `prometheusRules.enabled` | Enable Prometheus rules | `true` |
| `alertmanagerConfig.enabled` | Enable Alertmanager config | `true` |

### Storage Configuration

For AWS EKS, the chart uses `gp3` storage class by default. To use `gp2`:

```bash
helm upgrade monitoring-stack . \
  -f values-aws.yaml \
  --set kube-prometheus-stack.prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.storageClassName=gp2 \
  -n monitoring
```

## Prometheus Rules

The chart includes pre-configured Prometheus rules for the file-upload-service:

- **HighCPUUsage**: CPU usage above 80%
- **HighMemoryUsage**: Memory usage above 85%
- **HighErrorRate**: Error rate above 1%
- **ServiceDown**: Service not responding
- **HighLatency**: 95th percentile latency above 1s

To customize rules, edit `values.yaml` under `prometheusRules.rules.fileUploadService.groups`.

## Alertmanager Configuration

Alertmanager is configured with routing based on severity:

- **critical**: Routes to critical receiver
- **warning**: Routes to warning receiver
- **default**: Routes to default receiver

To configure webhook notifications, edit `values.yaml` under `alertmanagerConfig.receivers`.

## Upgrading

```bash
# Update dependencies
helm dependency update

# Upgrade
helm upgrade monitoring-stack . \
  -f values-aws.yaml \
  -n monitoring \
  --wait --timeout=10m
```

## Uninstalling

```bash
helm uninstall monitoring-stack -n monitoring
```

**Note:** This removes all monitoring resources. Persistent volumes will remain unless deleted manually.

## Troubleshooting

### Pods Not Starting

```bash
# Check pod status
kubectl describe pod <pod-name> -n monitoring

# Check events
kubectl get events -n monitoring --sort-by='.lastTimestamp'
```

### Storage Issues

```bash
# Check PVCs
kubectl get pvc -n monitoring

# Check storage class
kubectl get storageclass
```

### CRDs Not Installed

```bash
# Check if CRDs exist
kubectl get crd servicemonitors.monitoring.coreos.com

# If not, wait for Prometheus Operator to install them
kubectl wait --for=condition=Established crd servicemonitors.monitoring.coreos.com --timeout=60s
```

## Integration with File Upload Service

After installing the monitoring stack, the file-upload-service ServiceMonitor will be automatically discovered:

```bash
# Check ServiceMonitor
kubectl get servicemonitor -n file-upload

# Check if Prometheus is scraping
# In Prometheus UI: Status -> Targets
# Look for file-upload-service
```

## Production Considerations

1. **Change Grafana password**: Set `kube-prometheus-stack.grafana.adminPassword` to a secure value
2. **Increase storage**: Adjust storage sizes in `values-aws.yaml`
3. **Configure alerting**: Set up webhook receivers in `alertmanagerConfig`
4. **Enable persistence**: Ensure Grafana persistence is enabled
5. **Resource limits**: Adjust resource requests/limits based on cluster size

## Next Steps

1. **Import Grafana dashboards**: Import Kubernetes and application dashboards
2. **Configure alerts**: Set up notification channels (Slack, PagerDuty, etc.)
3. **Set up ServiceMonitors**: Ensure all services have ServiceMonitors
4. **Monitor resources**: Watch Prometheus and Grafana resource usage

