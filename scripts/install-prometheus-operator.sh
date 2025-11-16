#!/bin/bash
set -e

echo "Installing Prometheus Operator..."

# Check if Helm is installed
if ! command -v helm &> /dev/null; then
    echo "Error: Helm is not installed. Please install it first:"
    echo "  brew install helm"
    exit 1
fi

# Create monitoring namespace
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -

# Add Prometheus Helm repo
echo "Adding Prometheus Helm repository..."
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Install kube-prometheus-stack (includes Prometheus Operator)
echo "Installing Prometheus Operator (this may take a few minutes)..."
helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
  -n monitoring \
  --set prometheus.prometheusSpec.retention=15d \
  --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.storageClassName=gp2 \
  --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.accessModes[0]=ReadWriteOnce \
  --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=10Gi \
  --wait --timeout=10m

echo ""
echo "Waiting for CRDs to be ready..."
kubectl wait --for=condition=Established crd servicemonitors.monitoring.coreos.com --timeout=60s || true

echo ""
echo "✅ Prometheus Operator installed!"
echo ""
echo "Check installation:"
echo "  kubectl get pods -n monitoring"
echo ""
echo "Access Prometheus UI:"
echo "  kubectl port-forward -n monitoring svc/prometheus-kube-prometheus-prometheus 9090:9090"
echo "  Then open http://localhost:9090"
echo ""
echo "Access Grafana UI:"
echo "  kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80"
echo "  Username: admin"
echo "  Password: prom-operator (or check with: kubectl get secret prometheus-grafana -n monitoring -o jsonpath='{.data.admin-password}' | base64 -d)"
echo ""
echo "Now you can apply the ServiceMonitor:"
echo "  kubectl apply -f kubernetes/servicemonitor.yaml"

