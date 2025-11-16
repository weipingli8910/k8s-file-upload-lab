#!/bin/bash
set -e

echo "Deploying monitoring stack using Helm chart..."

# Navigate to chart directory
cd "$(dirname "$0")/../charts/monitoring-stack"

# Update dependencies
echo "Updating Helm dependencies..."
helm dependency update

# Lint chart
echo "Linting Helm chart..."
helm lint . || {
    echo "Error: Chart linting failed"
    exit 1
}

# Create namespace if it doesn't exist (idempotent)
NAMESPACE="monitoring"
echo "Ensuring namespace $NAMESPACE exists..."
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

# Disable namespace creation in template since we create it separately
# Install or upgrade
if helm list -n monitoring | grep -q monitoring-stack; then
    echo "Upgrading existing release..."
    helm upgrade monitoring-stack . \
      -f values-aws.yaml \
      --set namespace.create=false \
      -n monitoring \
      --wait --timeout=10m
else
    echo "Installing new release..."
    helm install monitoring-stack . \
      -f values-aws.yaml \
      --set namespace.create=false \
      -n monitoring \
      --wait --timeout=10m
fi

echo ""
echo "✅ Monitoring stack deployed!"
echo ""
echo "Check status:"
echo "  kubectl get pods -n monitoring"
echo ""
echo "Access Prometheus:"
echo "  kubectl port-forward -n monitoring svc/monitoring-stack-kube-prometheus-prometheus 9090:9090"
echo "  Then open http://localhost:9090"
echo ""
echo "Access Grafana:"
echo "  kubectl port-forward -n monitoring svc/monitoring-stack-grafana 3000:80"
echo "  Username: admin"
echo "  Password: $(kubectl get secret monitoring-stack-grafana -n monitoring -o jsonpath='{.data.admin-password}' 2>/dev/null | base64 -d || echo 'admin123')"
echo ""
echo "Access Alertmanager:"
echo "  kubectl port-forward -n monitoring svc/monitoring-stack-kube-prometheus-alertmanager 9093:9093"

