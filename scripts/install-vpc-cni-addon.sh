#!/bin/bash
set -e

CLUSTER_NAME=${CLUSTER_NAME:-file-upload-cluster}
AWS_REGION=${AWS_REGION:-us-east-1}

echo "Installing VPC CNI as EKS add-on..."

# Check if add-on already exists
if aws eks describe-addon --cluster-name $CLUSTER_NAME --addon-name vpc-cni --region $AWS_REGION &>/dev/null; then
  echo "VPC CNI add-on already exists. Updating..."
  aws eks update-addon \
    --cluster-name $CLUSTER_NAME \
    --addon-name vpc-cni \
    --region $AWS_REGION \
    --resolve-conflicts OVERWRITE
else
  echo "Creating VPC CNI add-on..."
  aws eks create-addon \
    --cluster-name $CLUSTER_NAME \
    --addon-name vpc-cni \
    --region $AWS_REGION \
    --resolve-conflicts OVERWRITE
fi

echo "Waiting for add-on to be active..."
aws eks wait addon-active \
  --cluster-name $CLUSTER_NAME \
  --addon-name vpc-cni \
  --region $AWS_REGION

echo "VPC CNI add-on installed successfully!"
kubectl get daemonset aws-node -n kube-system

