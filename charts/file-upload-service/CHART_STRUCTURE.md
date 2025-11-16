# Helm Chart Structure

## Directory Layout

```
charts/file-upload-service/
├── Chart.yaml                    # Chart metadata
├── values.yaml                    # Default values (all environments)
├── values-aws.yaml                # AWS EKS specific values
├── README.md                        # Quick reference guide
├── HELM_DEPLOYMENT.md             # Detailed deployment guide
├── CHART_STRUCTURE.md             # This file
│
└── templates/                     # Kubernetes manifest templates
    ├── _helpers.tpl                # Template helper functions
    ├── namespace.yaml              # Namespace definition
    ├── configmap.yaml              # Application configuration
    ├── serviceaccount.yaml         # Service account with IRSA
    ├── deployment.yaml             # Main application deployment
    ├── service.yaml                # Kubernetes service
    ├── ingress.yaml                # Ingress/ALB configuration
    ├── hpa.yaml                    # Horizontal Pod Autoscaler
    └── servicemonitor.yaml         # Prometheus ServiceMonitor
```

## Chart Components

### Chart.yaml
- Chart metadata (name, version, description)
- App version
- Chart type

### values.yaml
- Base/default configuration
- All configurable parameters
- Sensible defaults
- Supports AWS, GCP, Azure (via cloudProvider flag)

### values-aws.yaml
- AWS EKS specific overrides
- ALB ingress annotations
- IRSA service account configuration

### Templates

#### _helpers.tpl
Reusable template functions:
- `file-upload-service.name` - Chart name
- `file-upload-service.fullname` - Full resource name
- `file-upload-service.labels` - Standard labels
- `file-upload-service.selectorLabels` - Selector labels
- `file-upload-service.serviceAccountName` - Service account name
- `file-upload-service.namespace` - Namespace name

#### namespace.yaml
- Creates namespace if `namespace.create: true`
- Configurable namespace name

#### configmap.yaml
- Cloud-agnostic configuration
- Adapts based on `cloudProvider` value:
  - AWS: S3_BUCKET, AWS_REGION
  - GCP: GCS_BUCKET, GCP_PROJECT (future)
  - Azure: AZURE_STORAGE_ACCOUNT, AZURE_STORAGE_CONTAINER (future)
- Common: PORT, LOG_LEVEL

#### serviceaccount.yaml
- Service account with IRSA/Workload Identity/Managed Identity support
- Annotations from values
- Conditional creation

#### deployment.yaml
- Main application deployment
- Image, replicas, resources from values
- Environment variables from ConfigMap
- Health checks configurable
- Prometheus annotations (if monitoring enabled)

#### service.yaml
- ClusterIP service
- Ports configurable
- Selector uses helper template

#### ingress.yaml
- Conditional creation (`ingress.enabled`)
- Cloud-specific annotations
- Supports multiple hosts/paths
- ALB/GCE/Application Gateway compatible

#### hpa.yaml
- Conditional creation (`autoscaling.enabled`)
- CPU and memory targets
- Scale up/down behavior configurable

#### servicemonitor.yaml
- Conditional creation (requires Prometheus Operator)
- Scraping interval/timeout configurable
- Prometheus metrics endpoint

## Multi-Cloud Support

The chart is designed to support multiple cloud providers:

### Current: AWS EKS
- `values-aws.yaml` - AWS-specific configuration
- ALB ingress annotations
- IRSA service account

### Future: GCP GKE
- `values-gke.yaml` - GCP-specific configuration
- GCE ingress annotations
- Workload Identity service account

### Future: Azure AKS
- `values-aks.yaml` - Azure-specific configuration
- Application Gateway ingress annotations
- Managed Identity service account

The chart automatically adapts based on:
- `cloudProvider` value in values file
- Conditional templates in configmap.yaml and deployment.yaml

## Key Features

1. **Simple & Clean**: Minimal templating, easy to understand
2. **Flexible**: All values configurable via values files or --set
3. **Multi-Cloud Ready**: Structure supports AWS, GCP, Azure
4. **Production Ready**: Includes HPA, monitoring, health checks
5. **Backward Compatible**: Original k8s manifests still work

## Usage

### Quick Install
```bash
./scripts/deploy-with-helm.sh
```

### Manual Install
```bash
cd charts/file-upload-service
helm install file-upload-service . \
  -f values-aws.yaml \
  --set image.repository=$ECR_URL \
  --set config.s3Bucket=$S3_BUCKET \
  --set serviceAccount.annotations."eks\.amazonaws\.com/role-arn"=$IAM_ROLE_ARN \
  -n file-upload \
  --create-namespace
```

See `HELM_DEPLOYMENT.md` for detailed instructions.

