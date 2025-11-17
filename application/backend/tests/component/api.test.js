/**
 * Component tests for API endpoints
 * Tests complete request/response flows with mocked dependencies
 */
const request = require('supertest');
const { createTestApp } = require('../helpers/test-server');
const MockS3 = require('../helpers/mock-s3');

describe('API Component Tests', () => {
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

  describe('POST /api/upload', () => {
    it('should upload a file successfully', async () => {
      const fileContent = Buffer.from('test file content');
      
      const response = await request(app)
        .post('/api/upload')
        .attach('file', fileContent, 'test.txt')
        .expect(200);

      expect(response.body).toHaveProperty('message', 'File uploaded successfully');
      expect(response.body).toHaveProperty('fileName');
      expect(response.body).toHaveProperty('size', fileContent.length);
      expect(response.body).toHaveProperty('url');

      // Verify file was stored in mock S3
      const storedFile = mockS3.getObject('test-bucket', response.body.fileName);
      expect(storedFile).toBeDefined();
      expect(storedFile.Body).toEqual(fileContent);
    });

    it('should return 400 when no file is uploaded', async () => {
      const response = await request(app)
        .post('/api/upload')
        .expect(400);

      expect(response.body).toHaveProperty('error', 'No file uploaded');
    });

    it('should handle upload errors gracefully', async () => {
      const errorS3 = {
        putObject: jest.fn().mockRejectedValue(new Error('S3 error')),
        headBucket: jest.fn().mockResolvedValue({})
      };
      app = createTestApp(errorS3);

      const response = await request(app)
        .post('/api/upload')
        .attach('file', Buffer.from('test'), 'test.txt')
        .expect(500);

      expect(response.body).toHaveProperty('error', 'Failed to upload file');
    });
  });

  describe('GET /api/files', () => {
    it('should list files successfully', async () => {
      // Upload some files first
      await request(app)
        .post('/api/upload')
        .attach('file', Buffer.from('file1'), 'file1.txt');

      await request(app)
        .post('/api/upload')
        .attach('file', Buffer.from('file2'), 'file2.txt');

      const response = await request(app)
        .get('/api/files')
        .expect(200);

      expect(response.body).toHaveProperty('files');
      expect(response.body).toHaveProperty('count');
      expect(response.body.files.length).toBeGreaterThan(0);
      expect(response.body.files[0]).toHaveProperty('key');
      expect(response.body.files[0]).toHaveProperty('size');
    });

    it('should return empty list when no files exist', async () => {
      const response = await request(app)
        .get('/api/files')
        .expect(200);

      expect(response.body.files).toEqual([]);
      expect(response.body.count).toBe(0);
    });
  });

  describe('GET /api/files/:key', () => {
    it('should return signed URL for file', async () => {
      // Upload a file first
      const uploadResponse = await request(app)
        .post('/api/upload')
        .attach('file', Buffer.from('test'), 'test.txt')
        .expect(200);

      const fileName = uploadResponse.body.fileName;

      const response = await request(app)
        .get(`/api/files/${fileName}`)
        .expect(200);

      expect(response.body).toHaveProperty('url');
      expect(response.body.url).toContain(fileName);
    });

    it('should handle missing file gracefully', async () => {
      const errorS3 = {
        getSignedUrl: jest.fn().mockImplementation(() => {
          throw new Error('File not found');
        }),
        headBucket: jest.fn().mockResolvedValue({})
      };
      app = createTestApp(errorS3);

      const response = await request(app)
        .get('/api/files/nonexistent.txt')
        .expect(500);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('DELETE /api/files/:key', () => {
    it('should delete file successfully', async () => {
      // Upload a file first
      const uploadResponse = await request(app)
        .post('/api/upload')
        .attach('file', Buffer.from('test'), 'test.txt')
        .expect(200);

      const fileName = uploadResponse.body.fileName;

      const response = await request(app)
        .delete(`/api/files/${fileName}`)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'File deleted successfully');

      // Verify file was deleted
      const storedFile = mockS3.getObject('test-bucket', fileName);
      expect(storedFile).toBeUndefined();
    });
  });
});

