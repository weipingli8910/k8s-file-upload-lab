# Testing Guide - File Upload Service

Complete guide for running all tests: unit, component, integration, performance, E2E, and production deployment tests.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Test Structure](#test-structure)
3. [Running Tests](#running-tests)
4. [Test Types](#test-types)
5. [Load Generation](#load-generation)
6. [Metrics Collection](#metrics-collection)
7. [Production Deployment Tests](#production-deployment-tests)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

### Install Dependencies

```bash
cd application/backend
npm install
```

### Environment Variables

Create a `.env` file (optional):

```bash
# For integration tests
USE_LOCALSTACK=true  # Use LocalStack instead of real S3
TEST_S3_BUCKET=test-file-upload-bucket
AWS_REGION=us-east-1

# For load generator
SERVICE_URL=http://localhost:8080
CONCURRENT_USERS=10
REQUESTS_PER_USER=100
TEST_DURATION=60

# For metrics collector
PROMETHEUS_URL=http://localhost:9090
SERVICE_NAMESPACE=file-upload
```

## Test Structure

```
tests/
├── unit/              # Unit tests (fast, isolated)
├── component/         # Component tests (with mocks)
├── integration/       # Integration tests (real services)
├── performance/       # Performance/load tests
├── e2e/              # End-to-end tests
├── load-generator/    # Traffic/load generator
├── metrics-collector/ # Prometheus metrics collector
├── helpers/          # Test helpers and utilities
└── fixtures/         # Test data and files
```

## Running Tests

### Run All Tests

```bash
npm test
```

### Run Specific Test Types

```bash
# Unit tests only (fast)
npm run test:unit

# Component tests
npm run test:component

# Integration tests
npm run test:integration

# Performance tests
npm run test:performance

# E2E tests
npm run test:e2e
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Generate Coverage Report

```bash
npm run test:coverage
```

## Test Types

### 1. Unit Tests

**Purpose:** Test individual functions/modules in isolation

**Location:** `tests/unit/`

**Run:**
```bash
npm run test:unit
```

**What's tested:**
- Health endpoints (`/health`, `/ready`)
- Metrics endpoint (`/metrics`)
- Individual route handlers
- Utility functions

**Example:**
```bash
# Run specific unit test
npm test -- tests/unit/health.test.js
```

### 2. Component Tests

**Purpose:** Test components with mocked dependencies

**Location:** `tests/component/`

**Run:**
```bash
npm run test:component
```

**What's tested:**
- Complete API endpoints with mocked S3
- Request/response flows
- Error handling
- File upload/download workflows

**Example:**
```bash
# Run specific component test
npm test -- tests/component/api.test.js
```

### 3. Integration Tests

**Purpose:** Test with real services (S3, LocalStack, or test accounts)

**Location:** `tests/integration/`

**Prerequisites:**
- S3 bucket access OR LocalStack running
- Set `USE_LOCALSTACK=true` for LocalStack
- Set `TEST_S3_BUCKET` environment variable

**Run:**
```bash
# With LocalStack
USE_LOCALSTACK=true TEST_S3_BUCKET=test-bucket npm run test:integration

# With real S3 (test account)
TEST_S3_BUCKET=your-test-bucket npm run test:integration
```

**What's tested:**
- Real S3 upload/download
- S3 connectivity
- File operations with actual storage

**Setup LocalStack (Optional):**
```bash
# Start LocalStack
docker run -d -p 4566:4566 localstack/localstack

# Create test bucket
aws --endpoint-url=http://localhost:4566 s3 mb s3://test-bucket
```

### 4. Performance Tests

**Purpose:** Validate performance under load

**Location:** `tests/performance/`

**Run:**
```bash
npm run test:performance
```

**What's tested:**
- Response time (health, metrics, upload)
- Concurrent request handling
- Throughput (requests per second)
- Latency under load

**Performance Budgets:**
- Health check: < 100ms
- Metrics endpoint: < 200ms
- Small file upload (1KB): < 500ms
- Medium file upload (100KB): < 2s
- 10 concurrent requests: < 1s
- Throughput: > 50 RPS

### 5. E2E Tests

**Purpose:** Test complete user workflows

**Location:** `tests/e2e/`

**Run:**
```bash
npm run test:e2e
```

**What's tested:**
- Complete upload → list → delete workflow
- Multiple file uploads
- Metrics tracking throughout workflow
- Error handling in complete flows

## Load Generation

### Generate Traffic for Testing

The load generator creates traffic to test the service under load.

**Location:** `tests/load-generator/`

**Run:**
```bash
# Basic usage
npm run load:generate

# With custom configuration
SERVICE_URL=http://your-service-url:8080 \
CONCURRENT_USERS=20 \
REQUESTS_PER_USER=200 \
TEST_DURATION=120 \
npm run load:generate
```

**Configuration Options:**
- `SERVICE_URL`: Service endpoint (default: http://localhost:8080)
- `CONCURRENT_USERS`: Number of concurrent users (default: 10)
- `REQUESTS_PER_USER`: Requests per user (default: 100)
- `REQUEST_INTERVAL`: Interval between requests in ms (default: 100)
- `TEST_DURATION`: Test duration in seconds (default: 60)
- `UPLOAD_FILE_SIZE`: Upload file size in bytes (default: 1024)
- `ENABLE_UPLOADS`: Enable file uploads (default: true)

**Example:**
```bash
# Generate heavy load
SERVICE_URL=http://file-upload-service.example.com \
CONCURRENT_USERS=50 \
REQUESTS_PER_USER=500 \
TEST_DURATION=300 \
UPLOAD_FILE_SIZE=10240 \
npm run load:generate
```

**Output:**
- Total requests
- Success/failure counts
- Success rate
- Average, min, max latency
- Requests per second
- Error details

## Metrics Collection

### Collect Metrics from Prometheus

The metrics collector queries Prometheus and displays key metrics.

**Location:** `tests/metrics-collector/`

**Prerequisites:**
- Prometheus running and accessible
- Service deployed and exposing metrics

**Run:**
```bash
# Single collection
PROMETHEUS_URL=http://localhost:9090 \
SERVICE_NAMESPACE=file-upload \
node tests/metrics-collector/index.js

# Continuous collection (60 seconds)
PROMETHEUS_URL=http://localhost:9090 \
SERVICE_NAMESPACE=file-upload \
COLLECT_INTERVAL=5000 \
COLLECT_DURATION=60 \
node tests/metrics-collector/index.js
```

**Configuration Options:**
- `PROMETHEUS_URL`: Prometheus URL (default: http://localhost:9090)
- `SERVICE_NAMESPACE`: Service namespace (default: file-upload)
- `COLLECT_INTERVAL`: Collection interval in ms (default: 5000)
- `COLLECT_DURATION`: Collection duration in seconds (default: 60, 0 = single collection)

**Collected Metrics:**
- HTTP request rate
- HTTP request duration (p95)
- File upload rate
- Average file upload size
- Error rate
- Pod CPU usage
- Pod memory usage

**Example:**
```bash
# Collect metrics from production Prometheus
PROMETHEUS_URL=https://prometheus.prod.example.com \
SERVICE_NAMESPACE=file-upload-prod \
COLLECT_DURATION=300 \
node tests/metrics-collector/index.js
```

## Production Deployment Tests

### Blue/Green Deployment

**Strategy:** Deploy new version alongside current, switch traffic when ready

**Configuration:** `charts/file-upload-service/values-blue-green.yaml`

**Steps:**

1. **Deploy Blue/Green Application:**
   ```bash
   argocd app create -f ci-cd/argocd/applications/file-upload-service-prod-blue-green.yaml
   ```

2. **Deploy Blue Version (Current Production):**
   ```bash
   argocd app set file-upload-service-prod-blue-green \
     --helm-set image.tag=blue \
     --helm-set traffic.blue=100 \
     --helm-set traffic.green=0
   argocd app sync file-upload-service-prod-blue-green
   ```

3. **Deploy Green Version (New Version):**
   ```bash
   argocd app set file-upload-service-prod-blue-green \
     --helm-set green.image.tag=green \
     --helm-set green.enabled=true
   argocd app sync file-upload-service-prod-blue-green
   ```

4. **Run Smoke Tests on Green:**
   ```bash
   # Get green service URL
   GREEN_URL=$(kubectl get svc -n file-upload-prod -l version=green -o jsonpath='{.items[0].status.loadBalancer.ingress[0].hostname}')
   
   # Run smoke tests
   curl http://$GREEN_URL/health
   curl http://$GREEN_URL/ready
   npm run test:component  # Run component tests against green
   ```

5. **Switch Traffic to Green:**
   ```bash
   argocd app set file-upload-service-prod-blue-green \
     --helm-set service.selector.version=green \
     --helm-set traffic.blue=0 \
     --helm-set traffic.green=100
   argocd app sync file-upload-service-prod-blue-green
   ```

6. **Monitor Green Deployment:**
   ```bash
   # Monitor metrics
   PROMETHEUS_URL=http://prometheus-url \
   SERVICE_NAMESPACE=file-upload-prod \
   node tests/metrics-collector/index.js
   
   # Check pod status
   kubectl get pods -n file-upload-prod -l version=green
   
   # Check logs
   kubectl logs -n file-upload-prod -l version=green --tail=100
   ```

7. **Rollback to Blue (if needed):**
   ```bash
   argocd app set file-upload-service-prod-blue-green \
     --helm-set service.selector.version=blue \
     --helm-set traffic.blue=100 \
     --helm-set traffic.green=0
   argocd app sync file-upload-service-prod-blue-green
   ```

### Canary Deployment

**Strategy:** Gradually roll out new version to a percentage of traffic

**Configuration:** `charts/file-upload-service/values-canary.yaml`

**Prerequisites:**
- Argo Rollouts installed (for advanced canary)
- Prometheus accessible for analysis

**Steps:**

1. **Deploy Canary Application:**
   ```bash
   argocd app create -f ci-cd/argocd/applications/file-upload-service-prod-canary.yaml
   ```

2. **Deploy Canary (10% traffic):**
   ```bash
   argocd app set file-upload-service-prod-canary \
     --helm-set image.tag=canary-v1.2.3 \
     --helm-set canary.weight=10
   argocd app sync file-upload-service-prod-canary
   ```

3. **Monitor Canary (5 minutes):**
   ```bash
   # Collect metrics
   PROMETHEUS_URL=http://prometheus-url \
   SERVICE_NAMESPACE=file-upload-prod \
   COLLECT_DURATION=300 \
   node tests/metrics-collector/index.js
   
   # Check canary pods
   kubectl get pods -n file-upload-prod -l version=canary
   ```

4. **Increase Canary Traffic (25%):**
   ```bash
   argocd app set file-upload-service-prod-canary \
     --helm-set canary.weight=25
   argocd app sync file-upload-service-prod-canary
   ```

5. **Continue Gradual Rollout:**
   ```bash
   # 50% traffic
   argocd app set file-upload-service-prod-canary \
     --helm-set canary.weight=50
   argocd app sync file-upload-service-prod-canary
   
   # Wait and monitor...
   
   # 100% traffic (promote)
   argocd app set file-upload-service-prod-canary \
     --helm-set canary.weight=100
   argocd app sync file-upload-service-prod-canary
   ```

6. **Rollback (if issues detected):**
   ```bash
   argocd app rollback file-upload-service-prod-canary
   ```

## Complete Test Workflow

### Local Development

```bash
# 1. Install dependencies
npm install

# 2. Run unit tests (fast feedback)
npm run test:unit

# 3. Run component tests
npm run test:component

# 4. Run integration tests (if LocalStack/S3 available)
USE_LOCALSTACK=true npm run test:integration

# 5. Check coverage
npm run test:coverage
```

### CI Pipeline (GitHub Actions)

Tests run automatically on:
- Every push to PR
- Merge to develop/main

**Pipeline:**
1. Lint code
2. Run unit tests
3. Run component tests
4. Run integration tests (optional)
5. Build Docker image
6. Security scan
7. Helm lint

### Stage Environment Testing

```bash
# 1. Deploy to stage
argocd app sync file-upload-service-stage

# 2. Run integration tests against stage
SERVICE_URL=https://stage-service-url npm run test:integration

# 3. Run performance tests
SERVICE_URL=https://stage-service-url npm run test:performance

# 4. Generate load
SERVICE_URL=https://stage-service-url \
CONCURRENT_USERS=50 \
TEST_DURATION=300 \
npm run load:generate

# 5. Collect metrics
PROMETHEUS_URL=https://prometheus-stage-url \
SERVICE_NAMESPACE=file-upload-stage \
COLLECT_DURATION=300 \
node tests/metrics-collector/index.js

# 6. Run E2E tests
SERVICE_URL=https://stage-service-url npm run test:e2e
```

### Production Deployment Testing

**Before Deployment:**
```bash
# 1. Run all tests locally
npm test

# 2. Verify stage environment tests passed
# 3. Review metrics from stage
```

**During Blue/Green Deployment:**
```bash
# 1. Deploy green version
# 2. Run smoke tests on green
# 3. Monitor metrics
# 4. Switch traffic
# 5. Monitor production metrics
```

**During Canary Deployment:**
```bash
# 1. Deploy canary (10%)
# 2. Monitor metrics continuously
# 3. Gradually increase traffic
# 4. Promote to 100% if all checks pass
```

## Troubleshooting

### Tests Failing

**Unit/Component Tests:**
```bash
# Clear Jest cache
npm test -- --clearCache

# Run with verbose output
npm test -- --verbose

# Run specific test file
npm test -- tests/unit/health.test.js
```

**Integration Tests:**
```bash
# Check S3/LocalStack connectivity
aws --endpoint-url=http://localhost:4566 s3 ls  # LocalStack
aws s3 ls  # Real S3

# Verify environment variables
echo $USE_LOCALSTACK
echo $TEST_S3_BUCKET
```

**Performance Tests:**
```bash
# Increase timeout
jest --testTimeout=30000

# Run with more verbose output
npm test -- tests/performance/load.test.js --verbose
```

### Load Generator Issues

```bash
# Check service is accessible
curl $SERVICE_URL/health

# Reduce load if service is overwhelmed
CONCURRENT_USERS=5 npm run load:generate

# Check network connectivity
ping $SERVICE_URL
```

### Metrics Collection Issues

```bash
# Verify Prometheus is accessible
curl $PROMETHEUS_URL/api/v1/query?query=up

# Check service namespace
kubectl get pods -n $SERVICE_NAMESPACE

# Verify metrics endpoint
curl $SERVICE_URL/metrics
```

### Deployment Issues

**Blue/Green:**
```bash
# Check both blue and green pods
kubectl get pods -n file-upload-prod -l version=blue
kubectl get pods -n file-upload-prod -l version=green

# Check service selector
kubectl get svc -n file-upload-prod -o yaml | grep selector
```

**Canary:**
```bash
# Check rollout status (if using Argo Rollouts)
kubectl get rollout -n file-upload-prod

# Check canary pods
kubectl get pods -n file-upload-prod -l version=canary
```

## Best Practices

1. **Run unit tests frequently** during development
2. **Run component tests** before committing
3. **Run integration tests** before pushing
4. **Run performance tests** in stage environment
5. **Run E2E tests** before production deployment
6. **Monitor metrics** during and after deployment
7. **Use load generator** to validate under load
8. **Collect metrics** to verify performance

## Next Steps

- [ ] Set up CI/CD pipeline to run tests automatically
- [ ] Configure performance budgets
- [ ] Set up alerting on test failures
- [ ] Create custom Grafana dashboards
- [ ] Configure automated canary analysis
- [ ] Set up test data management
- [ ] Implement test result reporting

