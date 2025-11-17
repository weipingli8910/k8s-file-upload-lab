/**
 * Test server helper - creates a test instance of the Express app
 */
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const promClient = require('prom-client');

// Mock AWS S3
const mockS3 = {
  headBucket: jest.fn(),
  putObject: jest.fn(),
  listObjectsV2: jest.fn(),
  getSignedUrl: jest.fn(),
  deleteObject: jest.fn()
};

// Create test app
function createTestApp(s3Client = mockS3) {
  const app = express();
  const s3Bucket = process.env.S3_BUCKET || 'test-bucket';
  const awsRegion = process.env.AWS_REGION || 'us-east-1';

  // Prometheus metrics - create new registry for each test to avoid conflicts
  const register = new promClient.Registry();
  
  // Use a unique registry name to avoid conflicts
  const registryName = `test-registry-${Date.now()}-${Math.random()}`;
  const testRegister = new promClient.Registry();
  
  // Don't collect default metrics in tests to avoid conflicts
  // promClient.collectDefaultMetrics({ register: testRegister });

  const httpRequestDuration = new promClient.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.1, 0.5, 1, 2, 5],
    registers: [testRegister]
  });

  const httpRequestTotal = new promClient.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [testRegister]
  });

  const fileUploadTotal = new promClient.Counter({
    name: 'file_uploads_total',
    help: 'Total number of file uploads',
    labelNames: ['status'],
    registers: [testRegister]
  });

  const fileUploadSize = new promClient.Histogram({
    name: 'file_upload_size_bytes',
    help: 'Size of uploaded files in bytes',
    buckets: [1024, 10240, 102400, 1048576, 10485760, 104857600],
    registers: [testRegister]
  });

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
      // Handle both promise() pattern and direct promise
      const result = s3Client.headBucket({ Bucket: s3Bucket });
      await (result.promise ? result.promise() : result);
      res.status(200).json({ status: 'ready', timestamp: new Date().toISOString() });
    } catch (error) {
      res.status(503).json({ status: 'not ready', error: error.message });
    }
  });

  // Metrics endpoint
  app.get('/metrics', async (req, res) => {
    res.set('Content-Type', testRegister.contentType);
    res.end(await testRegister.metrics());
  });

  // Upload file endpoint
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 100 * 1024 * 1024 // 100MB limit
    }
  });

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

      // Handle both promise() pattern and direct promise
      const putResult = s3Client.putObject(params);
      await (putResult.promise ? putResult.promise() : putResult);
      
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

      // Handle both promise() pattern and direct promise
      const listResult = s3Client.listObjectsV2(params);
      const data = await (listResult.promise ? listResult.promise() : listResult);
      
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

      const url = s3Client.getSignedUrl('getObject', {
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

      // Handle both promise() pattern and direct promise
      const deleteResult = s3Client.deleteObject(params);
      await (deleteResult.promise ? deleteResult.promise() : deleteResult);
      res.status(200).json({ message: 'File deleted successfully' });
    } catch (error) {
      console.error('Delete file error:', error);
      res.status(500).json({ error: 'Failed to delete file', message: error.message });
    }
  });

  return app; // Return app directly for easier use in tests
}

module.exports = {
  createTestApp,
  mockS3
};

