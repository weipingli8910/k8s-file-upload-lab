# Step-by-Step Lab Instructions

Follow these steps in order to complete the lab.

## Phase 1: Prerequisites and Setup (15 minutes)

### Step 1.1: Verify Prerequisites
```bash
# Check AWS CLI
aws --version
aws sts get-caller-identity

# Check kubectl
kubectl version --client

# Check Terraform
terraform version

# Check Docker
docker --version
```

### Step 1.2: Set Environment Variables
```bash
export AWS_REGION=us-east-1
export AWS_DEFAULT_REGION=us-east-1
export CLUSTER_NAME=file-upload-cluster
export PROJECT_NAME=k8s-file-upload-lab

# Create a unique S3 bucket name (must be globally unique)
export S3_BUCKET_NAME=file-upload-$(date +%s)
```

### Step 1.3: Clone/Setup Repository
```bash
cd /Users/weipingli8910/code/playgrounds/k8s-file-upload-lab
# Repository is already here, proceed to next step
```

---

## Phase 2: Infrastructure Deployment (30-45 minutes)

### Step 2.1: Review Terraform Configuration
```bash
cd infrastructure/terraform
ls -la
# Review the terraform files
```

### Step 2.2: Initialize Terraform
```bash
terraform init
# This downloads providers and modules
```

### Step 2.3: Plan Infrastructure
```bash
terraform plan -out=tfplan
# Review the plan carefully
# Expected resources:
# - VPC, Subnets, Internet Gateway
# - EKS Cluster
# - Node Groups
# - S3 Bucket
# - IAM Roles
```

### Step 2.4: Apply Infrastructure
```bash
terraform apply tfplan
# Type 'yes' when prompted
# This will take 15-20 minutes
```

### Step 2.5: Save Outputs
```bash
# Terraform will output important values
terraform output > ../../outputs.txt
cat ../../outputs.txt

# Set kubectl context
aws eks update-kubeconfig --name $CLUSTER_NAME --region $AWS_REGION
```

### Step 2.6: Verify Cluster
```bash
kubectl get nodes
# Should show 2-3 nodes in Ready state
kubectl get pods -A
# Should show system pods running
```

---

## Phase 3: Install Kubernetes Add-ons (20 minutes)

### Step 3.1: Install AWS Load Balancer Controller
```bash
cd ../../scripts
./install-alb-controller.sh
# Wait for controller to be ready
kubectl get pods -n kube-system | grep aws-load-balancer
```

### Step 3.2: Install Metrics Server (for HPA)
```bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
kubectl get deployment metrics-server -n kube-system
```

### Step 3.3: Verify Add-ons
```bash
kubectl get pods -n kube-system
# Should see:
# - aws-load-balancer-controller
# - metrics-server
# - coredns
# - vpc-cni
```

---

## Phase 4: Deploy Application (20 minutes)

### Step 4.1: Create Namespace
```bash
cd ../../kubernetes
kubectl apply -f namespace.yaml
kubectl get namespace file-upload
```

### Step 4.2: Create S3 Access Secret
```bash
# Get S3 bucket name from terraform output
S3_BUCKET=$(cd ./infrastructure/terraform && terraform output -raw s3_bucket_name)

# Create secret for S3 access (using IRSA, but we'll create a placeholder)
kubectl create secret generic s3-credentials \
  --from-literal=bucket=$S3_BUCKET \
  --from-literal=region=$AWS_REGION \
  -n file-upload
```

### Step 4.3: Deploy Application
```bash
# Update deployment with S3 bucket name
sed "s/S3_BUCKET_PLACEHOLDER/$S3_BUCKET/g" deployment.yaml | kubectl apply -f -

# Or apply directly if using ConfigMap
kubectl apply -f configmap.yaml
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
```

### Step 4.4: Deploy Ingress (ALB)
```bash
kubectl apply -f ingress.yaml

# Wait for ALB to be created (2-3 minutes)
kubectl get ingress -n file-upload -w
```

### Step 4.5: Get Application URL
```bash
# Get ALB URL
ALB_URL=$(kubectl get ingress file-upload-ingress -n file-upload -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
echo "Application URL: http://$ALB_URL"

# Test the application
curl http://$ALB_URL/health
```

### Step 4.6: Verify Application
```bash
kubectl get pods -n file-upload
kubectl get svc -n file-upload
kubectl logs -n file-upload -l app=file-upload-service --tail=50
```

---

## Phase 5: Setup Monitoring (30 minutes)

### Step 5.1: Install Prometheus Operator
```bash
cd ../monitoring
kubectl create namespace monitoring
kubectl apply -f prometheus-operator.yaml
# Wait for CRDs to be ready
kubectl wait --for=condition=Established crd --all -n monitoring --timeout=60s
```

### Step 5.2: Deploy Prometheus
```bash
kubectl apply -f prometheus/
# Wait for Prometheus to be ready
kubectl get pods -n monitoring -w
```

### Step 5.3: Deploy Grafana
```bash
kubectl apply -f grafana/
# Get Grafana admin password
kubectl get secret grafana-admin -n monitoring -o jsonpath='{.data.password}' | base64 -d
echo ""

# Port forward to access Grafana
kubectl port-forward -n monitoring svc/grafana 3000:3000
# Access at http://localhost:3000
# Username: admin
# Password: (from above)
```

### Step 5.4: Configure ServiceMonitor
```bash
kubectl apply -f servicemonitor.yaml
# Prometheus should start scraping metrics
```

### Step 5.5: Setup Alertmanager
```bash
kubectl apply -f alertmanager/
# Configure alert rules
kubectl apply -f prometheus-rules.yaml
```

### Step 5.6: Verify Monitoring
```bash
# Check Prometheus targets
kubectl port-forward -n monitoring svc/prometheus 9090:9090
# Access at http://localhost:9090
# Go to Status > Targets to see if metrics are being scraped
```

---

## Phase 6: Setup Logging (15 minutes)

### Step 6.1: Install Fluent Bit
```bash
cd ../kubernetes/logging
kubectl create namespace logging
kubectl apply -f fluent-bit/
```

### Step 6.2: Verify Log Collection
```bash
kubectl get pods -n logging
kubectl logs -n logging -l app=fluent-bit --tail=50

# Check CloudWatch Logs
aws logs describe-log-groups --log-group-name-prefix /aws/eks/file-upload
```

### Step 6.3: View Application Logs
```bash
# View logs from application
kubectl logs -n file-upload -l app=file-upload-service --tail=100 -f
```

---

## Phase 7: Setup CI/CD (45 minutes)

### Step 7.1: Build and Push Docker Image
```bash
cd ../../application

# Build image
docker build -t file-upload-service:latest .

# Tag for ECR (get ECR URL from terraform output)
ECR_URL=$(cd ../infrastructure/terraform && terraform output -raw ecr_url)
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_URL

docker tag file-upload-service:latest $ECR_URL:latest
docker push $ECR_URL:latest
```

### Step 7.2: Setup GitHub Actions (Optional)
```bash
cd ../ci-cd/github-actions
# Review the workflow files
# To use:
# 1. Create a GitHub repository
# 2. Add AWS credentials as GitHub Secrets
# 3. Push code to trigger workflow
```

### Step 7.3: Setup Jenkins (Optional)
```bash
cd ../jenkins
# Review Jenkinsfile
# To use:
# 1. Install Jenkins
# 2. Configure AWS credentials
# 3. Create pipeline job
```

### Step 7.4: Install ArgoCD
```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Wait for ArgoCD to be ready
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=argocd-server -n argocd --timeout=300s

# Get admin password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
echo ""

# Port forward to access ArgoCD UI
kubectl port-forward svc/argocd-server -n argocd 8080:443
# Access at https://localhost:8080
# Username: admin
# Password: (from above)
```

### Step 7.5: Create ArgoCD Application
```bash
kubectl apply -f ../kubernetes/argocd-application.yaml

# View in ArgoCD UI or CLI
argocd app list
argocd app get file-upload-service
```

---

## Phase 8: Testing and Validation (20 minutes)

### Step 8.1: Test File Upload
```bash
# Get application URL
ALB_URL=$(kubectl get ingress file-upload-ingress -n file-upload -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

# Test upload
curl -X POST -F "file=@/path/to/test-file.txt" http://$ALB_URL/api/upload

# List files
curl http://$ALB_URL/api/files
```

### Step 8.2: Check Metrics
```bash
# Port forward to Prometheus
kubectl port-forward -n monitoring svc/prometheus 9090:9090

# Query metrics:
# - http_requests_total
# - http_request_duration_seconds
# - container_cpu_usage_seconds_total
# - container_memory_usage_bytes
```

### Step 8.3: Check Logs
```bash
# Application logs
kubectl logs -n file-upload -l app=file-upload-service --tail=100

# CloudWatch logs
aws logs tail /aws/eks/file-upload/file-upload-service --follow
```

### Step 8.4: Test Scaling
```bash
# Generate load
for i in {1..100}; do
  curl http://$ALB_URL/health
done

# Watch HPA scale
kubectl get hpa -n file-upload -w
kubectl get pods -n file-upload -w
```

---

## Phase 9: Cleanup (10 minutes)

### Step 9.1: Delete Application
```bash
kubectl delete namespace file-upload
kubectl delete namespace monitoring
kubectl delete namespace logging
kubectl delete namespace argocd
```

### Step 9.2: Destroy Infrastructure
```bash
cd ../../infrastructure/terraform
terraform destroy
# Type 'yes' when prompted
```

### Step 9.3: Cleanup Local Resources
```bash
# Remove Docker images
docker rmi file-upload-service:latest

# Remove kubectl context
kubectl config delete-context arn:aws:eks:$AWS_REGION:$(aws sts get-caller-identity --query Account --output text):cluster/$CLUSTER_NAME
```

---

## Troubleshooting

### Issue: Terraform fails
- Check AWS credentials: `aws sts get-caller-identity`
- Verify region is correct
- Check IAM permissions

### Issue: kubectl can't connect
- Verify cluster exists: `aws eks describe-cluster --name $CLUSTER_NAME`
- Update kubeconfig: `aws eks update-kubeconfig --name $CLUSTER_NAME --region $AWS_REGION`

### Issue: Pods not starting
- Check events: `kubectl describe pod <pod-name> -n file-upload`
- Check logs: `kubectl logs <pod-name> -n file-upload`
- Verify image exists in ECR

### Issue: ALB not created
- Check AWS Load Balancer Controller logs
- Verify ingress annotation
- Check security groups

### Issue: No metrics
- Verify ServiceMonitor is applied
- Check Prometheus targets
- Verify /metrics endpoint is accessible

---

## Next Steps

1. **Customize Application**: Modify the file upload service code
2. **Add More Metrics**: Define custom metrics for your use case
3. **Setup Alerts**: Configure PagerDuty/Slack notifications
4. **Implement Canary Deployments**: Use ArgoCD Rollouts
5. **Add Security Scanning**: Integrate Trivy/Snyk in CI/CD
6. **Setup Multi-Region**: Deploy to multiple AWS regions

---

## Estimated Costs

- **EKS Control Plane**: $73/month
- **EC2 Instances** (3x t3.large): ~$180/month
- **ALB**: ~$20/month
- **S3 & CloudWatch**: ~$10/month
- **Total**: ~$283/month

**Remember to destroy resources when not in use!**

