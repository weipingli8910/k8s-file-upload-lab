#!/usr/bin/env node
/**
 * Metrics Collector
 * Collects metrics from Prometheus and displays them
 */
const axios = require('axios');

// Configuration
const config = {
  prometheusUrl: process.env.PROMETHEUS_URL || 'http://localhost:9090',
  serviceNamespace: process.env.SERVICE_NAMESPACE || 'file-upload',
  interval: parseInt(process.env.COLLECT_INTERVAL || '5000'), // ms
  duration: parseInt(process.env.COLLECT_DURATION || '60') // seconds
};

// Prometheus query functions
async function queryPrometheus(query) {
  try {
    const response = await axios.get(`${config.prometheusUrl}/api/v1/query`, {
      params: { query }
    });
    return response.data.data.result;
  } catch (error) {
    console.error(`Error querying Prometheus: ${error.message}`);
    return [];
  }
}

// Collect metrics
async function collectMetrics() {
  console.log('Collecting metrics from Prometheus...\n');

  // HTTP Request Rate
  const requestRate = await queryPrometheus(
    `rate(http_requests_total{namespace="${config.serviceNamespace}"}[5m])`
  );
  console.log('=== HTTP Request Rate ===');
  requestRate.forEach(result => {
    console.log(`  ${result.metric.method} ${result.metric.route}: ${parseFloat(result.value[1]).toFixed(2)} req/s`);
  });

  // HTTP Request Duration (p95)
  const requestDuration = await queryPrometheus(
    `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{namespace="${config.serviceNamespace}"}[5m]))`
  );
  console.log('\n=== HTTP Request Duration (p95) ===');
  requestRate.forEach(result => {
    console.log(`  ${result.metric.method} ${result.metric.route}: ${(parseFloat(result.value[1]) * 1000).toFixed(2)}ms`);
  });

  // File Upload Rate
  const uploadRate = await queryPrometheus(
    `rate(file_uploads_total{namespace="${config.serviceNamespace}"}[5m])`
  );
  console.log('\n=== File Upload Rate ===');
  uploadRate.forEach(result => {
    console.log(`  Status ${result.metric.status}: ${parseFloat(result.value[1]).toFixed(2)} uploads/s`);
  });

  // File Upload Size (average)
  const uploadSize = await queryPrometheus(
    `rate(file_upload_size_bytes_sum{namespace="${config.serviceNamespace}"}[5m]) / rate(file_upload_size_bytes_count{namespace="${config.serviceNamespace}"}[5m])`
  );
  console.log('\n=== Average File Upload Size ===');
  uploadSize.forEach(result => {
    const sizeBytes = parseFloat(result.value[1]);
    const sizeKB = (sizeBytes / 1024).toFixed(2);
    console.log(`  Average: ${sizeKB} KB`);
  });

  // Error Rate
  const errorRate = await queryPrometheus(
    `rate(http_requests_total{namespace="${config.serviceNamespace}",status_code=~"5.."}[5m])`
  );
  console.log('\n=== Error Rate ===');
  if (errorRate.length > 0) {
    errorRate.forEach(result => {
      console.log(`  ${result.metric.status_code}: ${parseFloat(result.value[1]).toFixed(2)} errors/s`);
    });
  } else {
    console.log('  No errors detected');
  }

  // Pod CPU Usage
  const cpuUsage = await queryPrometheus(
    `rate(container_cpu_usage_seconds_total{namespace="${config.serviceNamespace}"}[5m]) * 100`
  );
  console.log('\n=== Pod CPU Usage ===');
  cpuUsage.forEach(result => {
    console.log(`  ${result.metric.pod}: ${parseFloat(result.value[1]).toFixed(2)}%`);
  });

  // Pod Memory Usage
  const memoryUsage = await queryPrometheus(
    `container_memory_usage_bytes{namespace="${config.serviceNamespace}"} / container_spec_memory_limit_bytes * 100`
  );
  console.log('\n=== Pod Memory Usage ===');
  memoryUsage.forEach(result => {
    if (result.value[1] !== 'NaN') {
      console.log(`  ${result.metric.pod}: ${parseFloat(result.value[1]).toFixed(2)}%`);
    }
  });
}

// Continuous collection
async function collectContinuously() {
  const endTime = Date.now() + (config.duration * 1000);

  while (Date.now() < endTime) {
    console.log(`\n[${new Date().toISOString()}]`);
    await collectMetrics();
    await new Promise(resolve => setTimeout(resolve, config.interval));
  }
}

// Main function
async function main() {
  console.log('Metrics Collector');
  console.log(`Prometheus URL: ${config.prometheusUrl}`);
  console.log(`Service Namespace: ${config.serviceNamespace}`);
  console.log(`Collection Interval: ${config.interval}ms`);
  console.log(`Duration: ${config.duration}s\n`);

  if (config.duration > 0) {
    await collectContinuously();
  } else {
    await collectMetrics();
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Metrics collector error:', error);
    process.exit(1);
  });
}

module.exports = { collectMetrics, queryPrometheus };

