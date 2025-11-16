#!/bin/bash
# Quick script to restart the file upload service deployment

NAMESPACE=${NAMESPACE:-file-upload}
DEPLOYMENT=${DEPLOYMENT:-file-upload-service}

echo "Restarting deployment: $DEPLOYMENT in namespace: $NAMESPACE"

# Method 1: Rollout restart (recommended)
kubectl rollout restart deployment $DEPLOYMENT -n $NAMESPACE

echo "Waiting for rollout to complete..."
kubectl rollout status deployment $DEPLOYMENT -n $NAMESPACE

echo "✅ Deployment restarted!"
echo ""
echo "Check pods:"
kubectl get pods -n $NAMESPACE -l app=$DEPLOYMENT

