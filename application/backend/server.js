const express = require('express');
const multer = require('multer');
const AWS = require('aws-sdk');
const cors = require('cors');
const promClient = require('prom-client');

const app = express();
const port = process.env.PORT || 8080;
const s3Bucket = process.env.S3_BUCKET || 'file-upload-lab';
const awsRegion = process.env.AWS_REGION || 'us-east-1';

// Configure AWS S3
AWS.config.update({ region: awsRegion });
const s3 = new AWS.S3();

// Configure multer for file uploads (in-memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  }
});

// Prometheus metrics
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

const httpRequestTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const fileUploadTotal = new promClient.Counter({
  name: 'file_uploads_total',
  help: 'Total number of file uploads',
  labelNames: ['status']
});

const fileUploadSize = new promClient.Histogram({
  name: 'file_upload_size_bytes',
  help: 'Size of uploaded files in bytes',
  buckets: [1024, 10240, 102400, 1048576, 10485760, 104857600]
});

register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);
register.registerMetric(fileUploadTotal);
register.registerMetric(fileUploadSize);

// Middleware
app.use(cors());
app.use(express.json());

// Request logging and metrics middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route ? req.route.path : req.path;
    
    httpRequestDuration.observe(
      { method: req.method, route, status_code: res.statusCode },
      duration
    );
    
    httpRequestTotal.inc({
      method: req.method,
      route,
      status_code: res.statusCode
    });
  });
  
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Readiness check endpoint
app.get('/ready', async (req, res) => {
  try {
    // Check S3 connectivity
    await s3.headBucket({ Bucket: s3Bucket }).promise();
    res.status(200).json({ status: 'ready', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});

// Metrics endpoint for Prometheus
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Upload file endpoint
app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const file = req.file;
  const fileName = `${Date.now()}-${file.originalname}`;
  
  try {
    const params = {
      Bucket: s3Bucket,
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype,
      Metadata: {
        originalName: file.originalname,
        uploadedAt: new Date().toISOString()
      }
    };

    await s3.putObject(params).promise();
    
    fileUploadTotal.inc({ status: 'success' });
    fileUploadSize.observe(file.size);
    
    res.status(200).json({
      message: 'File uploaded successfully',
      fileName: fileName,
      size: file.size,
      url: `https://${s3Bucket}.s3.${awsRegion}.amazonaws.com/${fileName}`
    });
  } catch (error) {
    console.error('Upload error:', error);
    fileUploadTotal.inc({ status: 'error' });
    res.status(500).json({ error: 'Failed to upload file', message: error.message });
  }
});

// List files endpoint
app.get('/api/files', async (req, res) => {
  try {
    const params = {
      Bucket: s3Bucket,
      MaxKeys: 100
    };

    const data = await s3.listObjectsV2(params).promise();
    
    const files = (data.Contents || []).map(item => ({
      key: item.Key,
      size: item.Size,
      lastModified: item.LastModified,
      url: `https://${s3Bucket}.s3.${awsRegion}.amazonaws.com/${item.Key}`
    }));

    res.status(200).json({ files, count: files.length });
  } catch (error) {
    console.error('List files error:', error);
    res.status(500).json({ error: 'Failed to list files', message: error.message });
  }
});

// Get file endpoint
app.get('/api/files/:key', async (req, res) => {
  try {
    const params = {
      Bucket: s3Bucket,
      Key: req.params.key
    };

    const url = s3.getSignedUrl('getObject', {
      ...params,
      Expires: 3600 // 1 hour
    });

    res.status(200).json({ url });
  } catch (error) {
    console.error('Get file error:', error);
    res.status(500).json({ error: 'Failed to get file', message: error.message });
  }
});

// Delete file endpoint
app.delete('/api/files/:key', async (req, res) => {
  try {
    const params = {
      Bucket: s3Bucket,
      Key: req.params.key
    };

    await s3.deleteObject(params).promise();
    res.status(200).json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ error: 'Failed to delete file', message: error.message });
  }
});

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`File upload service listening on port ${port}`);
  console.log(`S3 Bucket: ${s3Bucket}`);
  console.log(`AWS Region: ${awsRegion}`);
});

