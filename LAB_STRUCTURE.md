# Lab Structure

Complete file structure of the EKS File Upload Lab.

```
k8s-file-upload-lab/
├── README.md                          # Main documentation
├── STEP_BY_STEP.md                    # Detailed step-by-step guide
├── QUICKSTART.md                      # Quick start guide
├── TROUBLESHOOTING.md                 # Troubleshooting guide
├── LAB_STRUCTURE.md                   # This file
├── .gitignore                         # Git ignore rules
│
├── infrastructure/                    # Infrastructure as Code
│   └── terraform/
│       ├── main.tf                    # Main Terraform configuration
│       ├── variables.tf               # Variable definitions
│       ├── outputs.tf                  # Output values
│       ├── terraform.tfvars.example    # Example variables file
│       └── modules/
│           ├── vpc/                    # VPC module
│           │   ├── main.tf
│           │   ├── variables.tf
│           │   └── outputs.tf
│           └── eks/                   # EKS module
│               ├── main.tf
│               ├── variables.tf
│               └── outputs.tf
│
├── kubernetes/                        # Kubernetes manifests
│   ├── namespace.yaml                 # Namespace definition
│   ├── configmap.yaml                 # Configuration
│   ├── deployment.yaml                # Application deployment
│   ├── service.yaml                   # Service definition
│   ├── ingress.yaml                   # ALB Ingress
│   ├── hpa.yaml                       # Horizontal Pod Autoscaler
│   ├── servicemonitor.yaml            # Prometheus ServiceMonitor
│   ├── argocd-application.yaml        # ArgoCD application
│   └── logging/
│       └── fluent-bit.yaml            # Fluent Bit DaemonSet
│
├── application/                       # Application source code
│   ├── docker-compose.yml             # Local development
│   ├── backend/                       # Node.js backend
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── server.js                  # Main application
│   │   └── .dockerignore
│   └── frontend/                      # HTML/JS frontend
│       ├── Dockerfile
│       └── index.html                 # Web UI
│
├── monitoring/                        # Monitoring stack
│   ├── prometheus-operator.yaml        # Prometheus Operator notes
│   ├── prometheus/
│   │   └── prometheus.yaml            # Prometheus deployment
│   ├── grafana/
│   │   └── grafana.yaml               # Grafana deployment
│   ├── alertmanager/
│   │   └── alertmanager.yaml          # Alertmanager deployment
│   └── prometheus-rules.yaml          # Alerting rules
│
├── ci-cd/                             # CI/CD configurations
│   ├── github-actions/
│   │   └── ci.yml                     # GitHub Actions workflow
│   └── jenkins/
│       └── Jenkinsfile                # Jenkins pipeline
│
└── scripts/                           # Helper scripts
    ├── setup.sh                       # Initial setup script
    ├── install-alb-controller.sh      # ALB controller installation
    └── deploy-app.sh                  # Application deployment script
```

## Key Components

### Infrastructure (Terraform)
- **VPC**: Custom VPC with public/private subnets
- **EKS**: Managed Kubernetes cluster
- **S3**: File storage bucket
- **ECR**: Container registry
- **IAM**: Roles and policies for service accounts

### Application
- **Backend**: Node.js/Express service with S3 integration
- **Frontend**: Simple HTML/JS UI for file uploads
- **Metrics**: Prometheus metrics endpoint
- **Health Checks**: Liveness and readiness probes

### Kubernetes Resources
- **Deployment**: Application pods with resource limits
- **Service**: ClusterIP service
- **Ingress**: ALB integration
- **HPA**: Auto-scaling based on CPU/memory
- **ServiceMonitor**: Prometheus scraping configuration

### Monitoring
- **Prometheus**: Metrics collection
- **Grafana**: Dashboards and visualization
- **Alertmanager**: Alert routing and notifications
- **Fluent Bit**: Log collection to CloudWatch

### CI/CD
- **GitHub Actions**: CI pipeline with testing and scanning
- **Jenkins**: CD pipeline with deployment automation
- **ArgoCD**: GitOps deployment (optional)

## Deployment Flow

1. **Infrastructure** → Terraform creates AWS resources
2. **Kubernetes** → Manifests deploy application
3. **Monitoring** → Prometheus/Grafana collect metrics
4. **Logging** → Fluent Bit sends logs to CloudWatch
5. **CI/CD** → Automated testing and deployment

## File Sizes

- **Terraform**: ~500 lines
- **Kubernetes**: ~300 lines
- **Application**: ~400 lines
- **Monitoring**: ~200 lines
- **CI/CD**: ~150 lines
- **Total**: ~1550 lines of code

## Estimated Setup Time

- Infrastructure: 20-30 minutes
- Application: 10-15 minutes
- Monitoring: 15-20 minutes
- CI/CD: 20-30 minutes
- **Total**: ~1.5-2 hours

## Prerequisites

- AWS Account
- AWS CLI configured
- kubectl installed
- Terraform installed
- Docker installed
- Basic Kubernetes knowledge

## Next Steps

1. Review [README.md](./README.md)
2. Follow [QUICKSTART.md](./QUICKSTART.md) for quick setup
3. Use [STEP_BY_STEP.md](./STEP_BY_STEP.md) for detailed instructions
4. Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) if issues arise

