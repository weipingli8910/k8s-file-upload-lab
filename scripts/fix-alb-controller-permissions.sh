#!/bin/bash
set -e

echo "Fixing AWS Load Balancer Controller IAM permissions..."

CLUSTER_NAME=${CLUSTER_NAME:-file-upload-cluster}
AWS_REGION=${AWS_REGION:-us-east-1}

# Step 1: Apply Terraform to create IAM role
echo "Step 1: Creating IAM role in Terraform..."
cd "$(dirname "$0")/../infrastructure/terraform"

# Check if role exists in Terraform state
if terraform output -raw aws_load_balancer_controller_role_arn &>/dev/null; then
  IAM_ROLE_ARN=$(terraform output -raw aws_load_balancer_controller_role_arn)
  echo "IAM role found: $IAM_ROLE_ARN"
else
  echo "IAM role not found. Applying Terraform to create it..."
  terraform apply -auto-approve -target=aws_iam_role.aws_load_balancer_controller -target=aws_iam_role_policy.aws_load_balancer_controller
  IAM_ROLE_ARN=$(terraform output -raw aws_load_balancer_controller_role_arn)
fi

cd - > /dev/null

# Step 2: Annotate the service account
echo "Step 2: Annotating service account with IAM role..."
kubectl annotate serviceaccount aws-load-balancer-controller \
  eks.amazonaws.com/role-arn=$IAM_ROLE_ARN \
  -n kube-system --overwrite

# Step 3: Restart the pods to pick up the new role
echo "Step 3: Restarting ALB controller pods..."
kubectl rollout restart deployment aws-load-balancer-controller -n kube-system

echo "Waiting for pods to be ready..."
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=aws-load-balancer-controller -n kube-system --timeout=120s

echo "✅ AWS Load Balancer Controller permissions fixed!"
echo "The controller should now be able to create ALBs."
echo ""
echo "Check pod logs:"
echo "kubectl logs -n kube-system -l app.kubernetes.io/name=aws-load-balancer-controller --tail=50"

