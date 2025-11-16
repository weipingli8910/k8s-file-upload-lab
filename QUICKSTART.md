# Quick Start Guide

This is a condensed version of the step-by-step guide. For detailed instructions, see [STEP_BY_STEP.md](./STEP_BY_STEP.md).

## Prerequisites Check

```bash
# Verify all tools are installed
aws --version
kubectl version --client
terraform version
docker --version
```

## 1. Setup Environment

```bash
cd /Users/weipingli8910/code/playgrounds/k8s-file-upload-lab

# Set variables
export AWS_REGION=us-east-1
export CLUSTER_NAME=file-upload-cluster
export S3_BUCKET_NAME=file-upload-lab-$(date +%s)

# Verify AWS credentials
aws sts get-caller-identity
```

## 2. Deploy Infrastructure

```bash
cd infrastructure/terraform

# Initialize
terraform init

# Plan (review changes)
terraform plan -var="s3_bucket_name=$S3_BUCKET_NAME"

# Apply (takes 15-20 minutes)
terraform apply -var="s3_bucket_name=$S3_BUCKET_NAME"

# Save outputs
terraform output > ../../outputs.txt

# Configure kubectl
aws eks update-kubeconfig --name $CLUSTER_NAME --region $AWS_REGION
kubectl get nodes
```

## 3. Install ALB Controller

```bash
cd ../../scripts
./install-alb-controller.sh
```

## 4. Deploy Application

```bash
# Use the deployment script
./deploy-app.sh

# Or manually:
cd ../kubernetes
kubectl apply -f namespace.yaml
kubectl apply -f configmap.yaml
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
kubectl apply -f ingress.yaml
kubectl apply -f hpa.yaml
```

## 5. Get Application URL

```bash
# Wait for ALB (2-3 minutes)
kubectl get ingress -n file-upload -w

# Get URL
ALB_URL=$(kubectl get ingress file-upload-ingress -n file-upload -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
echo "Application URL: http://$ALB_URL"

# Test
curl http://$ALB_URL/health
```

## 6. Setup Monitoring (Optional)

```bash
cd ../monitoring

# Create namespace
kubectl create namespace monitoring

# Deploy Prometheus
kubectl apply -f prometheus/

# Deploy Grafana
kubectl apply -f grafana/

# Access Grafana
kubectl port-forward -n monitoring svc/grafana 3000:3000
# Open http://localhost:3000
# Username: admin, Password: admin123
```

## 7. Test File Upload

```bash
# Upload a file
curl -X POST -F "file=@/path/to/test.txt" http://$ALB_URL/api/upload

# List files
curl http://$ALB_URL/api/files
```

## Cleanup

```bash
# Delete application
kubectl delete namespace file-upload

# Delete infrastructure
cd infrastructure/terraform
terraform destroy
```

## Common Commands

```bash
# Check pods
kubectl get pods -n file-upload

# View logs
kubectl logs -n file-upload -l app=file-upload-service --tail=50

# Check HPA
kubectl get hpa -n file-upload

# Scale manually
kubectl scale deployment file-upload-service --replicas=5 -n file-upload

# Port forward to service
kubectl port-forward -n file-upload svc/file-upload-service 8080:80
```

## Next Steps

1. Review [STEP_BY_STEP.md](./STEP_BY_STEP.md) for detailed instructions
2. Setup CI/CD pipelines (see `ci-cd/` directory)
3. Configure monitoring dashboards
4. Review [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) if you encounter issues

