# Troubleshooting Guide

## Common Issues and Solutions

### 1. Terraform Issues

#### Error: "No valid credential sources found"
**Solution:**
```bash
aws configure
# Or set environment variables:
export AWS_ACCESS_KEY_ID=your-key
export AWS_SECRET_ACCESS_KEY=your-secret
```

#### Error: "S3 bucket name already exists"
**Solution:**
```bash
# Use a unique bucket name
export S3_BUCKET_NAME=file-upload-lab-$(date +%s)-$(whoami)
terraform apply -var="s3_bucket_name=$S3_BUCKET_NAME"
```

#### Error: "Insufficient permissions"
**Solution:**
Ensure your AWS IAM user/role has permissions for:
- EC2 (VPC, subnets, security groups)
- EKS (cluster creation)
- IAM (role creation)
- S3 (bucket creation)
- ECR (repository creation)

### 2. Kubernetes Issues

#### Error: "kubectl: command not found"
**Solution:**
```bash
# macOS
brew install kubectl

# Linux
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
```

#### Error: "Unable to connect to the server"
**Solution:**
```bash
# Update kubeconfig
aws eks update-kubeconfig --name file-upload-cluster --region us-east-1

# Verify connection
kubectl get nodes
```

#### Pods stuck in Pending state
**Solution:**
```bash
# Check pod events
kubectl describe pod <pod-name> -n file-upload

# Common causes:
# - Insufficient resources on nodes
# - Image pull errors
# - Node not ready
```

#### Image pull errors
**Solution:**
```bash
# Verify ECR login
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <ecr-url>

# Check image exists
aws ecr describe-images --repository-name file-upload-service --region us-east-1

# Verify IAM permissions for ECR
```

### 3. Application Issues

#### Service not accessible via ALB
**Solution:**
```bash
# Check ingress status
kubectl get ingress -n file-upload

# Check ALB controller logs
kubectl logs -n kube-system -l app.kubernetes.io/name=aws-load-balancer-controller

# Verify ingress annotations
kubectl describe ingress file-upload-ingress -n file-upload
```

#### 503 Service Unavailable
**Solution:**
```bash
# Check pod status
kubectl get pods -n file-upload

# Check service endpoints
kubectl get endpoints -n file-upload

# Check pod logs
kubectl logs -n file-upload -l app=file-upload-service
```

#### S3 access denied
**Solution:**
```bash
# Verify IAM role annotation
kubectl describe serviceaccount file-upload-service -n file-upload

# Check IAM role policy
aws iam get-role-policy --role-name file-upload-cluster-file-upload-service --policy-name file-upload-cluster-file-upload-s3

# Test S3 access from pod
kubectl exec -n file-upload <pod-name> -- aws s3 ls s3://<bucket-name>
```

### 4. Monitoring Issues

#### Prometheus not scraping metrics
**Solution:**
```bash
# Check ServiceMonitor
kubectl get servicemonitor -n file-upload

# Check Prometheus targets
kubectl port-forward -n monitoring svc/prometheus 9090:9090
# Open http://localhost:9090/targets

# Verify /metrics endpoint
kubectl port-forward -n file-upload svc/file-upload-service 8080:80
curl http://localhost:8080/metrics
```

#### Grafana not accessible
**Solution:**
```bash
# Port forward
kubectl port-forward -n monitoring svc/grafana 3000:3000

# Get admin password
kubectl get secret grafana-admin -n monitoring -o jsonpath='{.data.password}' | base64 -d
```

### 5. CI/CD Issues

#### GitHub Actions: ECR login fails
**Solution:**
- Verify AWS credentials in GitHub Secrets
- Check IAM permissions for ECR
- Verify ECR repository exists

#### Jenkins: Cannot connect to cluster
**Solution:**
```bash
# Configure kubeconfig in Jenkins
# Or use Jenkins Kubernetes plugin
```

#### ArgoCD: Application not syncing
**Solution:**
```bash
# Check ArgoCD application status
argocd app get file-upload-service

# Force sync
argocd app sync file-upload-service

# Check logs
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-application-controller
```

### 6. Performance Issues

#### High CPU/Memory usage
**Solution:**
```bash
# Check resource usage
kubectl top pods -n file-upload

# Adjust HPA
kubectl edit hpa file-upload-hpa -n file-upload

# Scale manually
kubectl scale deployment file-upload-service --replicas=5 -n file-upload
```

#### Slow file uploads
**Solution:**
- Check S3 bucket region (should match EKS region)
- Verify network connectivity
- Check ALB target group health
- Review CloudWatch metrics

### 7. Logging Issues

#### No logs in CloudWatch
**Solution:**
```bash
# Check Fluent Bit pods
kubectl get pods -n logging

# Check Fluent Bit logs
kubectl logs -n logging -l app=fluent-bit

# Verify IAM role for Fluent Bit
kubectl describe serviceaccount fluent-bit -n logging

# Check CloudWatch log group
aws logs describe-log-groups --log-group-name-prefix /aws/eks
```

## Getting Help

1. Check pod logs: `kubectl logs <pod-name> -n <namespace>`
2. Check events: `kubectl get events -n <namespace> --sort-by='.lastTimestamp'`
3. Describe resources: `kubectl describe <resource> <name> -n <namespace>`
4. Check AWS CloudWatch logs and metrics
5. Review Terraform outputs: `terraform output`

## Useful Commands

```bash
# Get ALB URL
kubectl get ingress -n file-upload -o jsonpath='{.items[0].status.loadBalancer.ingress[0].hostname}'

# Port forward to service
kubectl port-forward -n file-upload svc/file-upload-service 8080:80

# View all resources in namespace
kubectl get all -n file-upload

# Check HPA status
kubectl get hpa -n file-upload

# View node resources
kubectl top nodes

# Check service endpoints
kubectl get endpoints -n file-upload

# Debug pod
kubectl exec -it <pod-name> -n file-upload -- /bin/sh
```

