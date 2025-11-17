/**
 * End-to-End tests
 * Tests complete user workflows
 */
const request = require('supertest');
const { createTestApp } = require('../helpers/test-server');
const MockS3 = require('../helpers/mock-s3');

describe('E2E Workflow Tests', () => {
  let app;
  let mockS3;

  beforeEach(() => {
    mockS3 = new MockS3();
    mockS3.createBucket('test-bucket');
    app = createTestApp(mockS3);
  });

  afterEach(() => {
    mockS3.clear();
  });

  describe('Complete File Upload Workflow', () => {
    it('should complete full upload, list, and delete workflow', async () => {
      // Step 1: Check service health
      const healthResponse = await request(app)
        .get('/health')
        .expect(200);
      expect(healthResponse.body.status).toBe('healthy');

      // Step 2: Check readiness
      const readyResponse = await request(app)
        .get('/ready')
        .expect(200);
      expect(readyResponse.body.status).toBe('ready');

      // Step 3: Upload a file
      const fileContent = Buffer.from('E2E test file content');
      const uploadResponse = await request(app)
        .post('/api/upload')
        .attach('file', fileContent, 'e2e-test.txt')
        .expect(200);

      expect(uploadResponse.body).toHaveProperty('fileName');
      expect(uploadResponse.body).toHaveProperty('url');
      const fileName = uploadResponse.body.fileName;

      // Step 4: List files and verify upload
      const listResponse = await request(app)
        .get('/api/files')
        .expect(200);

      const uploadedFile = listResponse.body.files.find(f => f.key === fileName);
      expect(uploadedFile).toBeDefined();
      expect(uploadedFile.size).toBe(fileContent.length);

      // Step 5: Get signed URL
      const urlResponse = await request(app)
        .get(`/api/files/${fileName}`)
        .expect(200);

      expect(urlResponse.body).toHaveProperty('url');
      expect(urlResponse.body.url).toContain(fileName);

      // Step 6: Delete file
      const deleteResponse = await request(app)
        .delete(`/api/files/${fileName}`)
        .expect(200);

      expect(deleteResponse.body.message).toBe('File deleted successfully');

      // Step 7: Verify file is deleted
      const listAfterDelete = await request(app)
        .get('/api/files')
        .expect(200);

      const deletedFile = listAfterDelete.body.files.find(f => f.key === fileName);
      expect(deletedFile).toBeUndefined();
    });

    it('should handle multiple file uploads and list them', async () => {
      const files = [
        { name: 'file1.txt', content: Buffer.from('Content 1') },
        { name: 'file2.txt', content: Buffer.from('Content 2') },
        { name: 'file3.txt', content: Buffer.from('Content 3') }
      ];

      // Upload all files
      const uploadPromises = files.map(file =>
        request(app)
          .post('/api/upload')
          .attach('file', file.content, file.name)
      );

      const uploadResponses = await Promise.all(uploadPromises);
      uploadResponses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // List all files
      const listResponse = await request(app)
        .get('/api/files')
        .expect(200);

      expect(listResponse.body.files.length).toBeGreaterThanOrEqual(files.length);
    });

    it('should track metrics throughout workflow', async () => {
      // Upload a file
      await request(app)
        .post('/api/upload')
        .attach('file', Buffer.from('metrics test'), 'metrics-test.txt')
        .expect(200);

      // Check metrics
      const metricsResponse = await request(app)
        .get('/metrics')
        .expect(200);

      expect(metricsResponse.text).toContain('file_uploads_total');
      expect(metricsResponse.text).toContain('file_upload_size_bytes');
      expect(metricsResponse.text).toContain('http_requests_total');
    });
  });

  describe('Error Handling Workflow', () => {
    it('should handle errors gracefully throughout workflow', async () => {
      // Try to upload without file
      const noFileResponse = await request(app)
        .post('/api/upload')
        .expect(400);
      expect(noFileResponse.body.error).toBe('No file uploaded');

      // Try to get non-existent file
      const errorS3 = {
        getSignedUrl: jest.fn().mockImplementation(() => {
          throw new Error('File not found');
        }),
        headBucket: jest.fn().mockResolvedValue({}),
        putObject: jest.fn().mockResolvedValue({}),
        listObjectsV2: jest.fn().mockResolvedValue({ Contents: [] }),
        deleteObject: jest.fn().mockResolvedValue({})
      };
      app = createTestApp(errorS3);

      const notFoundResponse = await request(app)
        .get('/api/files/nonexistent.txt')
        .expect(500);
      expect(notFoundResponse.body).toHaveProperty('error');
    });
  });
});

