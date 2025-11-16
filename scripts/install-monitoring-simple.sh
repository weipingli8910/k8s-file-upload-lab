#!/bin/bash
set -e

echo "Installing simplified Prometheus (without Operator)..."

# Create monitoring namespace
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -

# Deploy Prometheus
echo "Deploying Prometheus..."
kubectl apply -f monitoring/prometheus/

# Wait for Prometheus to be ready
echo "Waiting for Prometheus to be ready..."
kubectl wait --for=condition=ready pod -l app=prometheus -n monitoring --timeout=120s || true

echo ""
echo "✅ Prometheus installed (simplified version)"
echo ""
echo "Note: This simplified version does NOT include ServiceMonitor CRD."
echo "For ServiceMonitor support, use: ./scripts/install-prometheus-operator.sh"
echo ""
echo "Access Prometheus:"
echo "  kubectl port-forward -n monitoring svc/prometheus 9090:9090"
echo "  Then open http://localhost:9090"

