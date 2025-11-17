#!/usr/bin/env node
/**
 * Load Generator for File Upload Service
 * Generates traffic to test the service under load
 */
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Configuration
const config = {
  baseUrl: process.env.SERVICE_URL || 'http://localhost:8080',
  concurrentUsers: parseInt(process.env.CONCURRENT_USERS || '10'),
  requestsPerUser: parseInt(process.env.REQUESTS_PER_USER || '100'),
  requestInterval: parseInt(process.env.REQUEST_INTERVAL || '100'), // ms
  testDuration: parseInt(process.env.TEST_DURATION || '60'), // seconds
  uploadFileSize: parseInt(process.env.UPLOAD_FILE_SIZE || '1024'), // bytes
  enableUploads: process.env.ENABLE_UPLOADS !== 'false'
};

// Statistics
const stats = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  totalLatency: 0,
  minLatency: Infinity,
  maxLatency: 0,
  errors: []
};

// Create test file
function createTestFile(size) {
  const filePath = path.join(__dirname, 'test-file.txt');
  const content = Buffer.alloc(size, 'A');
  fs.writeFileSync(filePath, content);
  return filePath;
}

// Make a request
async function makeRequest(url, method = 'GET', data = null) {
  const start = Date.now();
  try {
    let response;
    if (method === 'GET') {
      response = await axios.get(url);
    } else if (method === 'POST' && data) {
      response = await axios.post(url, data, {
        headers: data.getHeaders()
      });
    }

    const latency = Date.now() - start;
    stats.totalRequests++;
    stats.successfulRequests++;
    stats.totalLatency += latency;
    stats.minLatency = Math.min(stats.minLatency, latency);
    stats.maxLatency = Math.max(stats.maxLatency, latency);

    return { success: true, latency, status: response.status };
  } catch (error) {
    const latency = Date.now() - start;
    stats.totalRequests++;
    stats.failedRequests++;
    stats.totalLatency += latency;
    stats.errors.push({
      url,
      error: error.message,
      status: error.response?.status
    });

    return { success: false, latency, error: error.message };
  }
}

// Generate load for a single user
async function generateLoadForUser(userId) {
  const filePath = createTestFile(config.uploadFileSize);
  const requests = [];

  for (let i = 0; i < config.requestsPerUser; i++) {
    // Health check
    requests.push(
      makeRequest(`${config.baseUrl}/health`)
        .then(() => new Promise(resolve => setTimeout(resolve, config.requestInterval)))
    );

    // Metrics endpoint
    requests.push(
      makeRequest(`${config.baseUrl}/metrics`)
        .then(() => new Promise(resolve => setTimeout(resolve, config.requestInterval)))
    );

    // File upload (if enabled)
    if (config.enableUploads && i % 10 === 0) {
      const formData = new FormData();
      formData.append('file', fs.createReadStream(filePath), `test-${userId}-${i}.txt`);
      requests.push(
        makeRequest(`${config.baseUrl}/api/upload`, 'POST', formData)
          .then(() => new Promise(resolve => setTimeout(resolve, config.requestInterval)))
      );
    }
  }

  await Promise.all(requests);
  fs.unlinkSync(filePath);
}

// Print statistics
function printStats() {
  const avgLatency = stats.totalRequests > 0
    ? stats.totalLatency / stats.totalRequests
    : 0;
  const successRate = stats.totalRequests > 0
    ? (stats.successfulRequests / stats.totalRequests) * 100
    : 0;

  console.log('\n=== Load Test Statistics ===');
  console.log(`Total Requests: ${stats.totalRequests}`);
  console.log(`Successful: ${stats.successfulRequests}`);
  console.log(`Failed: ${stats.failedRequests}`);
  console.log(`Success Rate: ${successRate.toFixed(2)}%`);
  console.log(`Average Latency: ${avgLatency.toFixed(2)}ms`);
  console.log(`Min Latency: ${stats.minLatency === Infinity ? 0 : stats.minLatency}ms`);
  console.log(`Max Latency: ${stats.maxLatency}ms`);
  console.log(`Requests per Second: ${(stats.totalRequests / config.testDuration).toFixed(2)}`);

  if (stats.errors.length > 0) {
    console.log(`\nErrors (first 10):`);
    stats.errors.slice(0, 10).forEach(err => {
      console.log(`  - ${err.url}: ${err.error}`);
    });
  }
}

// Main function
async function main() {
  console.log('Starting Load Generator...');
  console.log(`Configuration:`);
  console.log(`  Service URL: ${config.baseUrl}`);
  console.log(`  Concurrent Users: ${config.concurrentUsers}`);
  console.log(`  Requests per User: ${config.requestsPerUser}`);
  console.log(`  Test Duration: ${config.testDuration}s`);
  console.log(`  Upload File Size: ${config.uploadFileSize} bytes`);
  console.log(`  Enable Uploads: ${config.enableUploads}\n`);

  const startTime = Date.now();
  const endTime = startTime + (config.testDuration * 1000);

  // Generate load with multiple concurrent users
  const userPromises = Array(config.concurrentUsers)
    .fill(null)
    .map((_, i) => generateLoadForUser(i));

  // Run until duration expires
  const interval = setInterval(() => {
    if (Date.now() >= endTime) {
      clearInterval(interval);
    }
  }, 1000);

  await Promise.all(userPromises);
  clearInterval(interval);

  const actualDuration = (Date.now() - startTime) / 1000;
  config.testDuration = actualDuration;

  printStats();
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Load generator error:', error);
    process.exit(1);
  });
}

module.exports = { generateLoadForUser, makeRequest, stats };

