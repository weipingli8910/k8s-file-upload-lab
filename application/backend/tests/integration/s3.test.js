/**
 * Integration tests with real S3 (or LocalStack)
 * These tests require actual S3 access or LocalStack running
 */
const request = require('supertest');
const AWS = require('aws-sdk');
const { createTestApp } = require('../helpers/test-server');

// Use LocalStack or real S3 based on environment
const useLocalStack = process.env.USE_LOCALSTACK === 'true';
const s3Endpoint = useLocalStack ? 'http://localhost:4566' : undefined;
// Generate unique bucket name to avoid conflicts
const bucketSuffix = Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
const s3Bucket = process.env.TEST_S3_BUCKET || `test-file-upload-${bucketSuffix}`;
const awsRegion = process.env.AWS_REGION || 'us-east-1';

// Configure AWS S3
const s3Config = {
  region: awsRegion,
  s3ForcePathStyle: useLocalStack
};

if (s3Endpoint) {
  s3Config.endpoint = s3Endpoint;
  s3Config.accessKeyId = 'test';
  s3Config.secretAccessKey = 'test';
}

const s3 = new AWS.S3(s3Config);

describe('S3 Integration Tests', () => {
  let app;
  const testFiles = [];

  beforeAll(async () => {
    // Check if bucket exists, create if it doesn't
    try {
      await s3.headBucket({ Bucket: s3Bucket }).promise();
      // Bucket exists, we're good
      console.log(`Using existing bucket: ${s3Bucket}`);
    } catch (error) {
      // Bucket doesn't exist, create it
      if (error.code === 'NotFound' || error.statusCode === 404) {
        try {
          await s3.createBucket({ Bucket: s3Bucket }).promise();
          console.log(`Created test bucket: ${s3Bucket}`);
        } catch (createError) {
          // If bucket creation fails (e.g., name taken), skip tests
          if (createError.code === 'BucketAlreadyExists') {
            console.warn(`Bucket ${s3Bucket} already exists. Using existing bucket.`);
          } else {
            throw createError;
          }
        }
      } else {
        throw error;
      }
    }
  });

  beforeEach(() => {
    // Set environment variable for bucket name
    process.env.S3_BUCKET = s3Bucket;
    
    // Create app with real S3 client
    const realS3 = {
      headBucket: (params) => s3.headBucket(params).promise(),
      putObject: (params) => s3.putObject(params).promise(),
      listObjectsV2: (params) => s3.listObjectsV2(params).promise(),
      getSignedUrl: (operation, params) => s3.getSignedUrl(operation, params),
      deleteObject: (params) => s3.deleteObject(params).promise()
    };
    app = createTestApp(realS3);
  });

  afterEach(async () => {
    // Clean up test files
    for (const key of testFiles) {
      try {
        await s3.deleteObject({ Bucket: s3Bucket, Key: key }).promise();
      } catch (error) {
        // Ignore errors
      }
    }
    testFiles.length = 0;
  });

  afterAll(async () => {
    // Clean up: delete all objects in test bucket
    try {
      const objects = await s3.listObjectsV2({ Bucket: s3Bucket }).promise();
      if (objects.Contents && objects.Contents.length > 0) {
        await s3.deleteObjects({
          Bucket: s3Bucket,
          Delete: {
            Objects: objects.Contents.map(obj => ({ Key: obj.Key }))
          }
        }).promise();
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('File Upload Integration', () => {
    it('should upload file to real S3', async () => {
      const fileContent = Buffer.from('integration test file content');
      
      const response = await request(app)
        .post('/api/upload')
        .attach('file', fileContent, 'integration-test.txt')
        .expect(200);

      expect(response.body).toHaveProperty('fileName');
      testFiles.push(response.body.fileName);

      // Verify file exists in S3
      const s3Object = await s3.headObject({
        Bucket: s3Bucket,
        Key: response.body.fileName
      }).promise();

      expect(s3Object).toBeDefined();
      expect(s3Object.ContentLength).toBe(fileContent.length);
    });

    it('should list uploaded files from S3', async () => {
      // Upload a file
      const uploadResponse = await request(app)
        .post('/api/upload')
        .attach('file', Buffer.from('test'), 'list-test.txt')
        .expect(200);

      testFiles.push(uploadResponse.body.fileName);

      // List files
      const listResponse = await request(app)
        .get('/api/files')
        .expect(200);

      expect(listResponse.body.files.length).toBeGreaterThan(0);
      const uploadedFile = listResponse.body.files.find(
        f => f.key === uploadResponse.body.fileName
      );
      expect(uploadedFile).toBeDefined();
    });

    it('should delete file from S3', async () => {
      // Upload a file
      const uploadResponse = await request(app)
        .post('/api/upload')
        .attach('file', Buffer.from('delete test'), 'delete-test.txt')
        .expect(200);

      const fileName = uploadResponse.body.fileName;

      // Delete file
      await request(app)
        .delete(`/api/files/${fileName}`)
        .expect(200);

      // Verify file is deleted from S3
      try {
        await s3.headObject({ Bucket: s3Bucket, Key: fileName }).promise();
        fail('File should have been deleted');
      } catch (error) {
        expect(error.code).toBe('NotFound');
      }
    });
  });

  describe('Readiness Check Integration', () => {
    it('should pass readiness check when S3 is accessible', async () => {
      const response = await request(app)
        .get('/ready')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ready');
    });
  });
});

