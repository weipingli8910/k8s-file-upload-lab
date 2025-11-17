/**
 * Unit tests for health endpoints
 */
const request = require('supertest');
const { createTestApp } = require('../helpers/test-server');

describe('Health Endpoints', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
  });

  describe('GET /health', () => {
    it('should return 200 with healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /ready', () => {
    it('should return 200 when S3 is accessible', async () => {
      const mockS3Client = {
        headBucket: jest.fn().mockResolvedValue({})
      };
      // Create a new app with the mock S3 client
      const testApp = createTestApp(mockS3Client);

      const response = await request(testApp)
        .get('/ready')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ready');
      expect(mockS3Client.headBucket).toHaveBeenCalled();
    });

    it('should return 503 when S3 is not accessible', async () => {
      const mockS3Client = {
        headBucket: jest.fn().mockRejectedValue(new Error('S3 not accessible'))
      };
      // Create a new app with the mock S3 client
      const testApp = createTestApp(mockS3Client);

      const response = await request(testApp)
        .get('/ready')
        .expect(503);

      expect(response.body).toHaveProperty('status', 'not ready');
      expect(response.body).toHaveProperty('error');
    });
  });
});

